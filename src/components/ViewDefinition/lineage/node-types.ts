import {
	ResourceTypeNode,
	SQLQueryNode,
	ViewDefinitionNode,
} from "../../SQLQueryBuilder/lineage/nodes";
import { ExpandPlaceholderNode } from "./expand-node";

export const nodeTypes = {
	"resource-type": ResourceTypeNode,
	"view-definition": ViewDefinitionNode,
	"sql-query": SQLQueryNode,
	"expand-placeholder": ExpandPlaceholderNode,
};
