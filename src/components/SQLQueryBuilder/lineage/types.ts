export type ColumnInfo = {
	name: string;
	path?: string;
	type?: string;
	description?: string;
	collection?: boolean;
};

export type ViewSelect = {
	column?: ColumnInfo[];
	forEach?: string;
	forEachOrNull?: string;
	repeat?: string;
	where?: { path: string; description?: string }[];
	select?: ViewSelect[];
	unionAll?: ViewSelect[];
};

export type ResourceTypeNodeData = {
	kind: "resource-type";
	resourceType: string;
};

export type ViewConstant = {
	name: string;
	type: string;
	value: string;
};

export type ViewDefinitionNodeData = {
	kind: "view-definition";
	id: string;
	canonical: string;
	name: string;
	title?: string;
	description?: string;
	resourceType: string | undefined;
	constants: ViewConstant[];
	select: ViewSelect[];
	where: { path: string; description?: string }[];
};

export type SQLQueryNodeData = {
	kind: "sql-query";
	id: string;
	canonical: string;
	name: string;
	title?: string;
	description?: string;
	parameters: { name: string; type?: string }[];
	isRoot: boolean;
};

export type LineageNodeData =
	| ResourceTypeNodeData
	| ViewDefinitionNodeData
	| SQLQueryNodeData;
