import "@xyflow/react/dist/style.css";
import {
	issueMessage,
	useOperationOutcomeError,
	useOperationOutcomeIssues,
} from "@aidbox-ui/components/Forms/editor/operation-outcome-context";
import type { Questionnaire } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { Button } from "@health-samurai/react-components";
import {
	Controls,
	type EdgeChange,
	type NodeChange,
	Panel,
	ReactFlow,
	ReactFlowProvider,
} from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import { GraphEdgeControls } from "./plan-definition-graph-controls";
import { graphEdgeTypes, ruleLabel } from "./plan-definition-graph-edges";
import {
	GRAPH_CARD_WIDTH,
	GRAPH_GAP,
	type GraphForm,
	planDefinitionGraphLayout,
} from "./plan-definition-graph-layout";
import {
	type PlanDefinitionGraphEdge,
	planDefinitionGraphEdges,
	planDefinitionRuleItems,
} from "./plan-definition-graph-model";
import {
	GRAPH_PACKAGE_HEIGHT,
	graphNodeTypes,
} from "./plan-definition-graph-nodes";
import {
	GRAPH_MAX_ZOOM,
	GRAPH_MIN_ZOOM,
	readPlanDefinitionGraphState,
	writePlanDefinitionGraphState,
} from "./plan-definition-graph-state";
import {
	type GraphNode,
	graphHandleId,
	type RuleEdge,
} from "./plan-definition-graph-types";
import type { PlanDefinitionActionDraft } from "./plan-definition-model";

/** The package node sits 24px from the top; forms follow it. */
const PACKAGE_TOP = 24;
const FORMS_TOP = PACKAGE_TOP + GRAPH_PACKAGE_HEIGHT;
/** React Flow turns off pointer events on nodes that are neither draggable nor
 * selectable; ours handle their own clicks. */
const NODE_STYLE = { pointerEvents: "all" } as const;
/** Keep the 12px inset the edge legend had before React Flow panels. */
const PANEL_STYLE = { margin: 12 };

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

type GraphDrag = { key: string; from: number; to: number; y: number };

const formNodeId = (key: string) => `form:${key}`;

/** Final index of the dragged form: how many other forms sit above its center. */
function dropIndex(forms: GraphForm[], from: number, y: number) {
	const dragged = forms[from];
	if (!dragged) return from;
	const center = y + dragged.height / 2;
	let top = forms[0]?.y ?? 0;
	let index = 0;
	for (const form of forms) {
		if (form.index === from) continue;
		if (center > top + form.height / 2) index++;
		top += form.height + GRAPH_GAP;
	}
	return index;
}

/** Form tops in layout coordinates, previewing the drop position while dragging. */
function formTops(forms: GraphForm[], drag: GraphDrag | null) {
	const order = forms.map((form) => form.index);
	if (drag) {
		order.splice(drag.from, 1);
		order.splice(drag.to, 0, drag.from);
	}
	const tops: number[] = [];
	let top = forms[0]?.y ?? 0;
	for (const index of order) {
		tops[index] = top;
		top += (forms[index]?.height ?? 0) + GRAPH_GAP;
	}
	if (drag) tops[drag.from] = drag.y;
	return tops;
}

export function PlanDefinitionGraph(props: PlanDefinitionGraphProps) {
	return (
		<ReactFlowProvider>
			<PlanDefinitionGraphFlow {...props} />
		</ReactFlowProvider>
	);
}

function PlanDefinitionGraphFlow({
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
	const [drag, setDrag] = useState<GraphDrag | null>(null);
	const sorting = drag !== null;
	const [measured, setMeasured] = useState<
		Record<string, { width: number; height: number }>
	>({});
	const [viewState, setViewState] = useState(() =>
		readPlanDefinitionGraphState(storageKey),
	);
	const visibleEdges = viewState.edges;
	useEffect(() => {
		writePlanDefinitionGraphState(storageKey, viewState);
	}, [storageKey, viewState]);
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
	const title = (index: number) =>
		actions[index]?.title || actions[index]?.id || "Untitled form";
	const packageIssue = packageIssues[0];
	const planDefinitionError = packageIssue
		? issueMessage(packageIssue)
		: Object.entries(errors).find(
				([path]) => path !== "action" && !path.startsWith("action."),
			)?.[1];

	const tops = formTops(layout.forms, drag);
	const nodes: GraphNode[] = [
		{
			id: "package",
			type: "package",
			position: { x: layout.gutter, y: PACKAGE_TOP },
			draggable: false,
			selectable: false,
			style: NODE_STYLE,
			measured: measured.package,
			data: {
				title: planDefinitionTitle,
				selected: planDefinitionSelected,
				error: planDefinitionError,
				disabled: disabled || sorting,
				onSelect: onSelectPlanDefinition,
				onQuickLook: onQuickLookPlanDefinition,
			},
		},
		...layout.forms.map((form): GraphNode => {
			const questionnaire = questionnaires[form.index];
			return {
				id: formNodeId(form.key),
				type: "form",
				position: {
					x: layout.gutter,
					y: FORMS_TOP + (tops[form.index] ?? form.y),
				},
				width: GRAPH_CARD_WIDTH,
				height: form.height,
				measured: { width: GRAPH_CARD_WIDTH, height: form.height },
				draggable: !disabled,
				selectable: false,
				style: NODE_STYLE,
				zIndex: drag?.key === form.key ? 10 : 0,
				data: {
					form,
					title: title(form.index),
					conditional: Boolean(
						actions[form.index]?.condition?.some(
							(condition) =>
								condition.kind === "applicability" &&
								condition.expression?.expression?.trim(),
						),
					),
					selected: selectedIndex === form.index,
					invalid: Object.keys(errors).some(
						(path) =>
							path === `action.${form.index}` ||
							path.startsWith(`action.${form.index}.`),
					),
					disabled,
					sorting,
					dragging: drag?.key === form.key,
					onSelect: () => onSelect(form.index),
					onQuickLook: questionnaire
						? () => onQuickLook(questionnaire)
						: undefined,
					onDuplicate: () => onDuplicate(form.index),
					onDelete: () => onDelete(form.index),
					onMove: (direction) => {
						const to = form.index + direction;
						if (!disabled && to >= 0 && to < layout.forms.length)
							onReorder(form.index, to);
					},
				},
			};
		}),
		{
			id: "add-forms",
			type: "addForms",
			position: {
				x: layout.gutter,
				y: FORMS_TOP + (layout.forms.length ? layout.height : 0),
			},
			draggable: false,
			selectable: false,
			style: NODE_STYLE,
			measured: measured["add-forms"],
			data: {
				empty: !actions.length,
				error: formsError,
				disabled: disabled || sorting,
				onAdd: onAddForms,
			},
		},
	];

	const highlighted = (edge: PlanDefinitionGraphEdge) =>
		selectedEdgeId !== undefined
			? edge.id === selectedEdgeId
			: edge.sourceIndex === selectedIndex ||
				edge.targetIndex === selectedIndex;
	const edges: RuleEdge[] = layout.routes
		.filter(({ edge }) => visibleEdges[edge.kind])
		.flatMap((route) => {
			const sourceKey = actionKeys[route.edge.sourceIndex];
			const targetKey = actionKeys[route.edge.targetIndex];
			if (sourceKey === undefined || targetKey === undefined) return [];
			const selected = route.edge.id === selectedEdgeId;
			const interactive = !disabled && !sorting;
			const label = ruleLabel(route.edge, layout.forms, title);
			return [
				{
					id: route.edge.id,
					type: "rule",
					source: formNodeId(sourceKey),
					target: formNodeId(targetKey),
					sourceHandle: graphHandleId(route.sourceAnchor, route.side, "source"),
					targetHandle: graphHandleId(route.targetAnchor, route.side, "target"),
					// React Flow makes the edge a button: it focuses it, and a click,
					// Enter or Space selects it, which onEdgesChange turns into the rule.
					selectable: interactive,
					focusable: interactive,
					selected,
					ariaRole: "button",
					ariaLabel: label,
					className: "group",
					domAttributes: {
						"aria-pressed": selected,
						"aria-disabled": !interactive,
						"data-test-id": "plan-definition-graph__rule-button",
						"data-edge-kind": route.edge.kind,
						"data-side": route.side,
					},
					// Edges paint above the cards, as their ports sit on card borders.
					zIndex: 20,
					data: {
						route,
						label,
						highlighted: highlighted(route.edge),
						invalid: Boolean(errors[route.edge.path]),
						interactive,
					},
				},
			];
		});

	const onEdgesChange = (changes: EdgeChange<RuleEdge>[]) => {
		const picked = changes.find(
			(change) => change.type === "select" && change.selected,
		);
		const route =
			picked &&
			"id" in picked &&
			layout.routes.find(({ edge }) => edge.id === picked.id);
		// Unselecting is left to the pane click, which clears the selection.
		if (route) onSelectRule(route.edge);
	};

	const onNodesChange = (changes: NodeChange<GraphNode>[]) => {
		const sizes: typeof measured = {};
		for (const change of changes) {
			if (change.type === "dimensions" && change.dimensions)
				sizes[change.id] = change.dimensions;
			if (
				change.type === "position" &&
				change.dragging &&
				change.position &&
				drag &&
				change.id === formNodeId(drag.key)
			) {
				const y = change.position.y - FORMS_TOP;
				setDrag(
					(current) =>
						current && {
							...current,
							y,
							to: dropIndex(layout.forms, current.from, y),
						},
				);
			}
		}
		if (Object.keys(sizes).length)
			setMeasured((current) =>
				Object.entries(sizes).every(
					([id, size]) =>
						current[id]?.width === size.width &&
						current[id]?.height === size.height,
				)
					? current
					: { ...current, ...sizes },
			);
	};

	const saved = viewState.viewport;
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
				className="relative min-h-0 flex-1"
				data-test-id="plan-definition-graph__viewport"
			>
				<ReactFlow<GraphNode, RuleEdge>
					nodes={nodes}
					edges={edges}
					nodeTypes={graphNodeTypes}
					edgeTypes={graphEdgeTypes}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					onNodeDragStart={(_, node) => {
						if (node.type !== "form") return;
						const { form } = node.data;
						setDrag({
							key: form.key,
							from: form.index,
							to: form.index,
							y: form.y,
						});
						onSortingChange(true);
					}}
					onNodeDragStop={() => {
						if (!drag) return;
						setDrag(null);
						onSortingChange(false);
						if (drag.from !== drag.to) onReorder(drag.from, drag.to);
					}}
					onPaneClick={() => {
						if (!disabled && !sorting) onSelect(null);
					}}
					onMoveEnd={(_, viewport) =>
						setViewState((current) => ({
							...current,
							viewport: { x: viewport.x, y: viewport.y, k: viewport.zoom },
						}))
					}
					defaultViewport={
						saved ? { x: saved.x, y: saved.y, zoom: saved.k } : undefined
					}
					fitView={!saved}
					fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
					minZoom={GRAPH_MIN_ZOOM}
					maxZoom={GRAPH_MAX_ZOOM}
					nodesConnectable={false}
					nodesFocusable={false}
					elevateNodesOnSelect={false}
					deleteKeyCode={null}
					selectionKeyCode={null}
					multiSelectionKeyCode={null}
					zoomOnDoubleClick={false}
					proOptions={{ hideAttribution: true }}
					data-test-id="plan-definition-graph__transform"
				>
					<Panel position="top-right" style={PANEL_STYLE}>
						<GraphEdgeControls
							visible={visibleEdges}
							onChange={(edges) =>
								setViewState((current) => ({ ...current, edges }))
							}
						/>
					</Panel>
					<Controls showFitView={false} />
				</ReactFlow>
			</div>
		</div>
	);
}
