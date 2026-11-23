import type { Edge, Node } from "@xyflow/react";
import type { GraphForm, GraphRoute } from "./plan-definition-graph-layout";
import type { PlanDefinitionGraphEdge } from "./plan-definition-graph-model";

export type PackageNodeData = {
	title: string;
	selected: boolean;
	error?: string;
	disabled: boolean;
	onSelect: () => void;
	onQuickLook: () => void;
};

export type FormNodeData = {
	form: GraphForm;
	title: string;
	conditional: boolean;
	selected: boolean;
	invalid: boolean;
	disabled: boolean;
	/** Any form is being dragged: block clicks and menus. */
	sorting: boolean;
	/** This form is being dragged. */
	dragging: boolean;
	onSelect: () => void;
	onQuickLook?: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
	/** Keyboard reordering, -1 moves up and 1 moves down. */
	onMove: (direction: -1 | 1) => void;
};

export type AddFormsNodeData = {
	empty: boolean;
	error?: string;
	disabled: boolean;
	onAdd: () => void;
};

export type PackageNode = Node<PackageNodeData, "package">;
export type FormNode = Node<FormNodeData, "form">;
export type AddFormsNode = Node<AddFormsNodeData, "addForms">;
export type GraphNode = PackageNode | FormNode | AddFormsNode;

export type RuleEdgeData = {
	route: GraphRoute;
	label: string;
	highlighted: boolean;
	selected: boolean;
	invalid: boolean;
	disabled: boolean;
	sorting: boolean;
	onSelectRule: (edge: PlanDefinitionGraphEdge) => void;
};

export type RuleEdge = Edge<RuleEdgeData, "rule">;

/** Handle ids carry the layout anchor, the side, and the handle role. */
export const graphHandleId = (
	anchor: string,
	side: "left" | "right",
	type: "source" | "target",
) => `${anchor}|${side}|${type}`;
