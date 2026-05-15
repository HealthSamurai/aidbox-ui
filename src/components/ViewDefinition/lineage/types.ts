import type { Edge, Node } from "@xyflow/react";
import type {
	LineageNodeData,
	SQLQueryNodeData,
	ViewDefinitionNodeData,
} from "../../SQLQueryBuilder/lineage/types";

export type ExpandPlaceholderNodeData = {
	kind: "expand-placeholder";
	queryNodeId: string;
};

export type BackrefNodeData = LineageNodeData | ExpandPlaceholderNodeData;

export type BackrefNode = Node<BackrefNodeData>;

export type BackrefGraph = {
	nodes: BackrefNode[];
	edges: Edge[];
};

export type BackrefGraphState = {
	rootId: string;
	nodesById: Map<string, BackrefNode>;
	depthById: Map<string, number>;
	edges: Edge[];
};

export type { LineageNodeData, SQLQueryNodeData, ViewDefinitionNodeData };
