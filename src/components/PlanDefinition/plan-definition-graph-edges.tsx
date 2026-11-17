import { useOperationOutcomeIssues } from "@aidbox-ui/components/Forms/editor/operation-outcome-context";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import {
	type GraphAnchor,
	type GraphForm,
	type GraphRoute,
	graphEdgePath,
} from "./plan-definition-graph-layout";
import type { PlanDefinitionGraphEdge } from "./plan-definition-graph-model";
import type { GraphEdgeVisibility } from "./plan-definition-graph-state";

function ruleLabel(
	edge: PlanDefinitionGraphEdge,
	forms: GraphForm[],
	title: (index: number) => string,
) {
	const kind = edge.kind === "condition" ? "Enable when" : "Prefill";
	const sourceItem =
		forms[edge.sourceIndex]?.items.find(
			(item) => item.linkId === edge.sourceLinkId,
		)?.label ?? "Form answers";
	const targetItem =
		forms[edge.targetIndex]?.items.find(
			(item) => item.linkId === edge.targetLinkId,
		)?.label ?? edge.targetLinkId;
	const destination =
		edge.targetLinkId === undefined
			? title(edge.targetIndex)
			: `${title(edge.targetIndex)}, ${targetItem}`;
	return `${kind}: ${title(edge.sourceIndex)}, ${sourceItem}, to ${destination}. Edit rule`;
}

export function GraphConnections({
	routes,
	forms,
	width,
	height,
	anchors,
	selectedIndex,
	selectedEdgeId,
	visible,
	errors,
	disabled,
	sorting,
	viewportRef,
	title,
	onSelectRule,
}: {
	routes: GraphRoute[];
	forms: GraphForm[];
	width: number;
	height: number;
	anchors?: Record<string, GraphAnchor>;
	selectedIndex: number | null;
	selectedEdgeId?: string;
	visible: GraphEdgeVisibility;
	errors: Record<string, string>;
	disabled: boolean;
	sorting: boolean;
	viewportRef: RefObject<HTMLDivElement | null>;
	title: (index: number) => string;
	onSelectRule: (edge: PlanDefinitionGraphEdge) => void;
}) {
	const layerRef = useRef<HTMLDivElement>(null);
	const svgRef = useRef<SVGSVGElement>(null);
	const focusedBeforePointerDown = useRef<boolean | undefined>(undefined);
	const [hovered, setHovered] = useState<string>();
	useLayoutEffect(() => {
		const layer = layerRef.current;
		const svg = svgRef.current;
		const diagram = layer?.parentElement;
		const viewport = viewportRef.current;
		if (!sorting || !layer || !svg || !diagram || !viewport) return;

		// Drag feedback is a native popover. Its edges must join the top layer
		// above it, while retaining the graph's zoom and viewport clipping.
		const position = () => {
			const bounds = viewport.getBoundingClientRect();
			const origin = diagram.getBoundingClientRect();
			Object.assign(layer.style, {
				position: "fixed",
				inset: "auto",
				left: `${bounds.left}px`,
				top: `${bounds.top}px`,
				width: `${bounds.width}px`,
				height: `${bounds.height}px`,
				overflow: "hidden",
			});
			svg.style.transform = `translate(${origin.left - bounds.left}px, ${origin.top - bounds.top}px) scale(${origin.width / width})`;
		};
		position();
		layer.showPopover?.();
		// Optimistic reordering reopens the dragged form's popover after moving
		// its DOM node. Restore the edge layer above it before the next paint.
		const followDragLayer = (event: Event) => {
			if (
				(event as ToggleEvent).newState === "open" &&
				event.target instanceof Element &&
				event.target.hasAttribute("data-dnd-dragging")
			)
				queueMicrotask(() => {
					if (!layer.matches(":popover-open")) return;
					layer.hidePopover();
					layer.showPopover();
				});
		};
		diagram.addEventListener("beforetoggle", followDragLayer, true);
		const observer = new ResizeObserver(position);
		observer.observe(viewport);
		return () => {
			observer.disconnect();
			diagram.removeEventListener("beforetoggle", followDragLayer, true);
			if (layer.matches(":popover-open")) layer.hidePopover();
			layer.removeAttribute("style");
			svg.style.removeProperty("transform");
		};
	}, [sorting, viewportRef, width]);
	const highlighted = (edge: PlanDefinitionGraphEdge) =>
		selectedEdgeId !== undefined
			? edge.id === selectedEdgeId
			: edge.sourceIndex === selectedIndex ||
				edge.targetIndex === selectedIndex;
	// Keep the DOM order stable so focusing an edge does not change the tab order.
	const visibleRoutes = routes.filter(({ edge }) => visible[edge.kind]);
	return (
		<div
			ref={layerRef}
			popover={sorting ? "manual" : undefined}
			data-test-id="plan-definition-graph__edge-layer"
			className="pointer-events-none absolute inset-0 z-40 m-0 overflow-visible border-0 bg-transparent p-0 text-inherit backdrop:hidden"
		>
			<svg
				ref={svgRef}
				className="pointer-events-none absolute inset-0 origin-top-left overflow-visible"
				width={width}
				height={height}
				aria-label="Form rule connections"
			>
				<title>Form rule connections</title>
				{visibleRoutes.map((route) => (
					<GraphConnection
						key={route.edge.id}
						route={route}
						anchors={anchors}
						label={ruleLabel(route.edge, forms, title)}
						highlighted={highlighted(route.edge)}
						selected={route.edge.id === selectedEdgeId}
						invalid={Boolean(errors[route.edge.path])}
						disabled={disabled}
						sorting={sorting}
						hovered={hovered}
						setHovered={setHovered}
						focusedBeforePointerDown={focusedBeforePointerDown}
						onSelectRule={onSelectRule}
					/>
				))}
			</svg>
		</div>
	);
}

function GraphConnection({
	route,
	anchors,
	label,
	highlighted,
	selected,
	invalid,
	disabled,
	sorting,
	hovered,
	setHovered,
	focusedBeforePointerDown,
	onSelectRule,
}: {
	route: GraphRoute;
	anchors?: Record<string, GraphAnchor>;
	label: string;
	highlighted: boolean;
	selected: boolean;
	invalid: boolean;
	disabled: boolean;
	sorting: boolean;
	hovered?: string;
	setHovered: (value: string | undefined) => void;
	focusedBeforePointerDown: RefObject<boolean | undefined>;
	onSelectRule: (edge: PlanDefinitionGraphEdge) => void;
}) {
	const { edge } = route;
	const sourceRect = anchors?.[route.sourceAnchor];
	const targetRect = anchors?.[route.targetAnchor];
	const source = sourceRect
		? {
				x: sourceRect[route.side],
				y: sourceRect.y + route.sourceOffset,
			}
		: route.source;
	const target = targetRect
		? {
				x: targetRect[route.side],
				y: targetRect.y + route.targetOffset,
			}
		: route.target;
	const direction = route.side === "left" ? 1 : -1;
	const path = graphEdgePath(
		source,
		{ x: target.x - direction * 4, y: target.y },
		route.laneX,
	);
	const issues = useOperationOutcomeIssues(edge.issuePattern, {
		severity: ["error", "fatal"],
	});
	const kind = invalid || issues.length ? "error" : edge.kind;
	const select = () => {
		if (!disabled && !sorting) onSelectRule(edge);
	};
	return (
		<g
			data-test-id="plan-definition-graph__edge"
			data-edge-kind={edge.kind}
			data-highlighted={highlighted}
			className={
				!highlighted
					? "text-text-disabled"
					: kind === "condition"
						? "text-text-brand-primary"
						: kind === "prefill"
							? "text-text-success-primary"
							: "text-text-error-primary"
			}
		>
			<path
				d={path}
				fill="none"
				stroke="currentColor"
				strokeWidth={hovered === edge.id ? 3 : 1.5}
				strokeDasharray={edge.kind === "prefill" ? "5 4" : undefined}
				data-test-id="plan-definition-graph__edge-path"
			/>
			<path
				d={path}
				fill="none"
				stroke="transparent"
				strokeWidth="14"
				className={
					sorting
						? "pointer-events-none outline-none"
						: "pointer-events-auto cursor-pointer outline-none"
				}
				role="button"
				tabIndex={disabled || sorting ? -1 : 0}
				aria-label={label}
				aria-disabled={disabled || sorting}
				aria-pressed={selected}
				data-test-id="plan-definition-graph__rule-button"
				data-edge-kind={edge.kind}
				data-side={route.side}
				onPointerDown={(event) => {
					focusedBeforePointerDown.current =
						document.activeElement === event.currentTarget;
				}}
				onPointerCancel={() => {
					focusedBeforePointerDown.current = undefined;
				}}
				onClick={() => {
					// A pointer click that just focused this edge already selected it.
					if (focusedBeforePointerDown.current !== false) select();
					focusedBeforePointerDown.current = undefined;
				}}
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						focusedBeforePointerDown.current = undefined;
						select();
					}
				}}
				onPointerEnter={() => setHovered(edge.id)}
				onPointerLeave={() => setHovered(undefined)}
				onFocus={() => {
					setHovered(edge.id);
					select();
				}}
				onBlur={() => setHovered(undefined)}
			>
				<title>{label}</title>
			</path>
			<circle
				cx={source.x}
				cy={source.y}
				r="3.5"
				fill="currentColor"
				stroke="var(--color-bg-primary)"
				strokeWidth="1.5"
				data-test-id="plan-definition-graph__source-port"
				data-side={route.side}
				data-anchor={route.sourceAnchor}
			/>
			<polygon
				points="-4,-4 4,0 -4,4"
				transform={`translate(${target.x} ${target.y}) scale(${direction} 1)`}
				fill="currentColor"
				data-test-id="plan-definition-graph__target-port"
				data-side={route.side}
				data-anchor={route.targetAnchor}
			/>
		</g>
	);
}
