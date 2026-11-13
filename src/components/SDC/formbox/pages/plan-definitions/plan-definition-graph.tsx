import type { Questionnaire } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import { Accessibility, Feedback } from "@dnd-kit/dom";
import { RestrictToElement } from "@dnd-kit/dom/modifiers";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { Button, cn, IconButton } from "@health-samurai/react-components";
import {
	CircleAlert,
	Eye,
	Package as PlanDefinitionIcon,
	Plus,
} from "lucide-react";
import {
	type MouseEvent,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	issueMessage,
	useOperationOutcomeError,
	useOperationOutcomeIssues,
} from "../../shared/operation-outcome-context";
import { planDefinitionDragSensors } from "./plan-definition-drag";
import {
	GraphEdgeControls,
	GraphZoomControls,
} from "./plan-definition-graph-controls";
import { GraphConnections } from "./plan-definition-graph-edges";
import { GraphFormBlock } from "./plan-definition-graph-form";
import {
	GRAPH_CARD_WIDTH,
	GRAPH_GAP,
	type GraphAnchor,
	planDefinitionGraphLayout,
} from "./plan-definition-graph-layout";
import {
	type PlanDefinitionGraphEdge,
	planDefinitionGraphEdges,
	planDefinitionRuleItems,
} from "./plan-definition-graph-model";
import {
	readPlanDefinitionGraphState,
	writePlanDefinitionGraphState,
} from "./plan-definition-graph-state";
import {
	GRAPH_INTERACTIVE,
	useGraphViewport,
} from "./plan-definition-graph-viewport";
import type { PlanDefinitionActionDraft } from "./plan-definition-model";

type PlanDefinitionGraphProps = {
	storageKey?: string;
	planDefinitionTitle: string;
	planDefinitionSelected: boolean;
	onSelectPlanDefinition: () => void;
	onQuickLookPlanDefinition: () => void;
	onQuickLook: (questionnaire: Questionnaire) => void;
	actions: PlanDefinitionActionDraft[];
	actionKeys: string[];
	questionnaires: Array<Questionnaire | undefined>;
	selectedIndex: number | null;
	selectedEdgeId?: string;
	errors: Record<string, string>;
	disabled: boolean;
	loading: boolean;
	loadError: boolean;
	onRetry: () => void;
	onSelect: (index: number | null) => void;
	onSelectRule: (edge: PlanDefinitionGraphEdge) => void;
	onAddForms: () => void;
	onReorder: (from: number, to: number) => void;
	onSortingChange: (sorting: boolean) => void;
	onDuplicate: (index: number) => void;
	onDelete: (index: number) => void;
};

export function PlanDefinitionGraph({
	storageKey,
	planDefinitionTitle,
	planDefinitionSelected,
	onSelectPlanDefinition,
	onQuickLookPlanDefinition,
	onQuickLook,
	actions,
	actionKeys,
	questionnaires,
	selectedIndex,
	selectedEdgeId,
	errors,
	disabled,
	loading,
	loadError,
	onRetry,
	onSelect,
	onSelectRule,
	onAddForms,
	onReorder,
	onSortingChange,
	onDuplicate,
	onDelete,
}: PlanDefinitionGraphProps) {
	const packageIssues = useOperationOutcomeIssues(
		/^PlanDefinition(?:$|\.(?!action(?:\.|\[|$)))/,
		{ severity: ["error", "fatal"] },
	);
	const formsError =
		useOperationOutcomeError("PlanDefinition.action") ?? errors.action;
	const formsErrorId = useId();
	const diagramRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLOListElement>(null);
	const [sorting, setSorting] = useState(false);
	const [viewState, setViewState] = useState(() =>
		readPlanDefinitionGraphState(storageKey),
	);
	const visibleEdges = viewState.edges;
	useEffect(() => {
		writePlanDefinitionGraphState(storageKey, viewState);
	}, [storageKey, viewState]);
	const [liveAnchors, setLiveAnchors] = useState<Record<string, GraphAnchor>>();
	const layout = useMemo(() => {
		const connections = planDefinitionGraphEdges(actions).filter(
			(edge) => visibleEdges[edge.kind],
		);
		return planDefinitionGraphLayout(
			actionKeys,
			actions.map((action, index) =>
				planDefinitionRuleItems(
					action,
					questionnaires[index],
					index,
					connections,
				),
			),
			connections,
			actions.map((_, index) =>
				questionnaires[index]
					? undefined
					: loading
						? "Loading items…"
						: "Questionnaire items unavailable.",
			),
		);
	}, [actions, actionKeys, questionnaires, loading, visibleEdges]);
	const lastForm = layout.forms.at(-1);
	const viewport = useGraphViewport({
		width: layout.width,
		// Include the PlanDefinition heading, Add Forms button, and empty-state prompt.
		height: 88 + layout.height + 64 + (actions.length ? 0 : 68),
		nodeBounds: {
			left: (layout.width - GRAPH_CARD_WIDTH) / 2,
			right: (layout.width + GRAPH_CARD_WIDTH) / 2,
			top: 24,
			bottom: lastForm ? 88 + lastForm.y + lastForm.height : 88,
		},
		visibleEdges,
		enabled: true,
		sorting,
		savedViewport: viewState.viewport,
		onViewportChange: (viewport) =>
			setViewState((current) => ({ ...current, viewport })),
	});
	const scale = viewport.transform.k;
	// dnd-kit moves DOM elements optimistically. Follow their actual anchors during a drag.
	useEffect(() => {
		if (!sorting) return;
		let frame = 0;
		const measure = () => {
			const diagram = diagramRef.current;
			if (!diagram) return;
			const origin = diagram.getBoundingClientRect();
			const next: Record<string, GraphAnchor> = {};
			for (const element of diagram.querySelectorAll<HTMLElement>(
				"[data-graph-anchor]",
			)) {
				const key = element.dataset.graphAnchor;
				if (!key || element.closest("[data-dnd-placeholder]")) continue;
				const rect = element.getBoundingClientRect();
				next[key] = {
					left: (rect.left - origin.left) / scale,
					right: (rect.right - origin.left) / scale,
					y: (rect.top + rect.height / 2 - origin.top) / scale,
				};
			}
			setLiveAnchors((current) =>
				JSON.stringify(current) === JSON.stringify(next) ? current : next,
			);
			frame = requestAnimationFrame(measure);
		};
		frame = requestAnimationFrame(measure);
		return () => cancelAnimationFrame(frame);
	}, [sorting, scale]);
	const title = (index: number) =>
		actions[index]?.title || actions[index]?.id || "Untitled form";
	const packageIssue = packageIssues[0];
	const planDefinitionError = packageIssue
		? issueMessage(packageIssue)
		: Object.entries(errors).find(
				([path]) => path !== "action" && !path.startsWith("action."),
			)?.[1];
	const anchors = sorting ? liveAnchors : undefined;
	const addForms = (
		<div
			className="mx-auto flex flex-col gap-2"
			style={{ width: GRAPH_CARD_WIDTH }}
		>
			<IconButton
				variant="ghost"
				className="size-10 self-center rounded-full border border-border-primary bg-bg-primary shadow-sm"
				aria-label="Add Forms"
				title="Add Forms"
				icon={<Plus className="size-4" />}
				data-test-id="plan-definition-editor__add-form-button"
				disabled={disabled || sorting}
				onClick={onAddForms}
				aria-invalid={Boolean(formsError)}
				aria-describedby={formsError ? formsErrorId : undefined}
			/>
			{formsError && (
				<p
					id={formsErrorId}
					role="alert"
					className="text-xs text-text-error-primary"
				>
					{formsError}
				</p>
			)}
		</div>
	);
	const clearSelection = (event: MouseEvent<HTMLDivElement>) => {
		if (
			event.button === 0 &&
			!disabled &&
			!sorting &&
			event.target instanceof Element &&
			!event.target.closest(GRAPH_INTERACTIVE)
		)
			onSelect(null);
	};
	return (
		<div
			className="flex h-full min-h-0 flex-col bg-bg-tertiary"
			data-test-id="plan-definition-graph"
		>
			{loadError && (
				<div className="shrink-0 border-b border-border-secondary bg-bg-primary px-4 py-3">
					<p role="alert" className="text-xs text-text-error-primary">
						Could not load some items.{" "}
						<Button variant="link" size="small" onClick={onRetry}>
							Retry
						</Button>
					</p>
				</div>
			)}
			<div
				ref={viewport.ref}
				className={cn(
					"relative min-h-0 flex-1 touch-none overflow-clip outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-brand",
					viewport.panning ? "cursor-grabbing" : "cursor-grab",
				)}
				role="application"
				aria-label="Package graph"
				aria-description="Drag empty space to pan. Scroll or pinch to zoom. Use arrow keys to pan, plus and minus to zoom, F to fit, and 0 to reset zoom."
				tabIndex={0}
				onClick={clearSelection}
				onKeyDown={viewport.onKeyDown}
				data-test-id="plan-definition-graph__viewport"
			>
				<div
					className="absolute left-0 top-0 origin-top-left"
					style={{
						width: layout.width,
						transform: `translate(${viewport.transform.x}px, ${viewport.transform.y}px) scale(${scale})`,
					}}
					data-test-id="plan-definition-graph__transform"
					data-zoom={scale}
				>
					<div className="mx-auto pt-6" style={{ width: GRAPH_CARD_WIDTH }}>
						<div className="relative">
							<Button
								variant="ghost"
								className={cn(
									"flex h-16 w-full items-center justify-start gap-3 rounded-xl border border-border-primary bg-bg-primary py-0 pr-14 pl-4 text-left shadow-sm hover:bg-bg-primary active:bg-bg-primary",
									!planDefinitionSelected &&
										!planDefinitionError &&
										!disabled &&
										"hover:border-border-primary_hover",
									planDefinitionSelected &&
										"border-border-brand ring-1 ring-border-brand",
									planDefinitionError && "border-border-error",
								)}
								aria-label="Package settings"
								aria-description={planDefinitionTitle || "Untitled package"}
								aria-current={planDefinitionSelected ? "true" : undefined}
								aria-invalid={Boolean(planDefinitionError)}
								title={planDefinitionError ?? "Package settings"}
								disabled={disabled || sorting}
								onClick={onSelectPlanDefinition}
								data-test-id="plan-definition-graph__plan-definition-node-button"
							>
								<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-bg-secondary text-text-secondary">
									<PlanDefinitionIcon className="size-5" />
								</span>
								<span className="min-w-0 flex-1">
									<span className="block text-xs font-normal text-text-secondary">
										Package
									</span>
									<span className="block truncate text-sm font-semibold text-text-primary">
										{planDefinitionTitle || "Untitled package"}
									</span>
								</span>
								{planDefinitionError && (
									<CircleAlert
										className="size-4 shrink-0 text-text-error-primary"
										role="img"
										aria-label="Package has errors"
									/>
								)}
							</Button>
							<IconButton
								variant="ghost"
								className="absolute top-1/2 right-4 -translate-y-1/2"
								aria-label="Quick look at package"
								title="Quick look at package"
								data-test-id="plan-definition-graph__plan-definition-quick-look-button"
								disabled={disabled || sorting}
								onClick={onQuickLookPlanDefinition}
								icon={<Eye className="size-4" />}
							/>
						</div>
					</div>
					<div
						ref={diagramRef}
						className="relative mx-auto"
						style={{ width: layout.width, height: layout.height }}
					>
						<DragDropProvider
							sensors={planDefinitionDragSensors}
							modifiers={[
								RestrictToElement.configure({
									element: () => trackRef.current,
								}),
							]}
							plugins={(defaults) => [
								...defaults,
								Feedback.configure({ dropAnimation: null }),
								Accessibility.configure({
									screenReaderInstructions: {
										draggable:
											"Press Enter to edit this form. Press Space to pick it up, then use the arrow keys to reorder. Press Space to drop or Escape to cancel.",
									},
								}),
							]}
							onDragStart={() => {
								setSorting(true);
								onSortingChange(true);
							}}
							onDragEnd={(event) => {
								setSorting(false);
								setLiveAnchors(undefined);
								onSortingChange(false);
								if (event.canceled) return;
								const { source } = event.operation;
								if (isSortable(source) && source.initialIndex !== source.index)
									onReorder(source.initialIndex, source.index);
							}}
						>
							<ol
								ref={trackRef}
								aria-label="Forms in runtime order"
								className={cn(
									"mx-auto flex flex-col",
									actions.length > 0 && "py-6",
								)}
								style={{ width: GRAPH_CARD_WIDTH, gap: GRAPH_GAP }}
							>
								{layout.forms.map((form) => {
									const questionnaire = questionnaires[form.index];
									return (
										<GraphFormBlock
											key={form.key}
											form={form}
											title={title(form.index)}
											conditional={Boolean(
												actions[form.index]?.condition?.some(
													(condition) =>
														condition.kind === "applicability" &&
														condition.expression?.expression?.trim(),
												),
											)}
											selected={selectedIndex === form.index}
											disabled={disabled}
											sorting={sorting}
											scale={scale}
											invalid={Object.keys(errors).some(
												(path) =>
													path === `action.${form.index}` ||
													path.startsWith(`action.${form.index}.`),
											)}
											onSelect={() => onSelect(form.index)}
											onQuickLook={
												questionnaire
													? () => onQuickLook(questionnaire)
													: undefined
											}
											onDuplicate={() => onDuplicate(form.index)}
											onDelete={() => onDelete(form.index)}
										/>
									);
								})}
							</ol>
						</DragDropProvider>
						<GraphConnections
							routes={layout.routes}
							forms={layout.forms}
							width={layout.width}
							height={layout.height}
							anchors={anchors}
							selectedIndex={selectedIndex}
							selectedEdgeId={selectedEdgeId}
							visible={visibleEdges}
							errors={errors}
							disabled={disabled}
							sorting={sorting}
							viewportRef={viewport.ref}
							title={title}
							onSelectRule={onSelectRule}
						/>
					</div>
					<div className="pb-6">
						{!actions.length && (
							<p className="py-6 text-center text-sm text-text-secondary">
								Add forms to build your package
							</p>
						)}
						{addForms}
					</div>
				</div>
				<GraphEdgeControls
					visible={visibleEdges}
					onChange={(edges) =>
						setViewState((current) => ({ ...current, edges }))
					}
				/>
				<GraphZoomControls
					scale={scale}
					disabled={sorting}
					onZoom={viewport.zoomTo}
					onFit={viewport.fitView}
				/>
			</div>
		</div>
	);
}
