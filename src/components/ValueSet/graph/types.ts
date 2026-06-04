import type { Edge, Node } from "@xyflow/react";

export type ValueSetNodeData = {
	kind: "value-set";
	id?: string;
	url?: string;
	version?: string;
	name?: string;
	title?: string;
	description?: string;
	status?: string;
	isRoot: boolean;
	includeSystems: number;
	includeValueSets: number;
	excludeSystems: number;
	excludeValueSets: number;
};

export type CodeSystemNodeData = {
	kind: "code-system";
	id?: string;
	url?: string;
	version?: string;
	name?: string;
	title?: string;
	description?: string;
	status?: string;
	content?: string;
	count?: number;
};

export type UnresolvedNodeData = {
	kind: "unresolved";
	resourceKind: "ValueSet" | "CodeSystem";
	url: string;
	version?: string;
};

export type GraphNodeData =
	| ValueSetNodeData
	| CodeSystemNodeData
	| UnresolvedNodeData;

export type GraphEdgeKind = "include" | "exclude" | "supplements";

export type GraphEdgeData = {
	edgeKind: GraphEdgeKind;
};

export type GraphNode = Node<GraphNodeData>;
export type GraphEdge = Edge<GraphEdgeData>;

export type ValueSetGraph = {
	nodes: GraphNode[];
	edges: GraphEdge[];
};
