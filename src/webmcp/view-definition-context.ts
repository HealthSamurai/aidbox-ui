import type { ViewDefinition } from "@aidbox-ui/fhir-types/org-sql-on-fhir-ig";
import type { OperationOutcome } from "@health-samurai/react-components";

export interface FormTreeSelectItem {
	nodeId: string;
	type: "column" | "forEach" | "forEachOrNull" | "unionAll";
	expression?: string;
	columns?: Array<{ nodeId: string; name: string; path: string }>;
	children?: FormTreeSelectItem[];
}

export interface FormTree {
	name: string | undefined;
	status: string | undefined;
	resourceType: string | undefined;
	constants: Array<{ nodeId: string; name: string; value: string }>;
	where: Array<{ nodeId: string; path: string }>;
	select: FormTreeSelectItem[];
}

export interface ViewDefinitionBuilderActions {
	getViewDefinition: () => ViewDefinition | undefined;
	setViewDefinition: (viewDefinition: ViewDefinition) => void;
	getResourceType: () => string | undefined;
	setResourceType: (resourceType: string) => void;
	run: () => Promise<string>;
	save: () => Promise<void>;
	materialize: (
		type: "view" | "materialized-view" | "table",
	) => Promise<string>;
	delete: () => Promise<void>;
	getRunResults: () => string | undefined;
	getRunError: () => OperationOutcome | undefined;
	isDirty: () => boolean;
	switchBuilderTab: (tab: "form" | "code" | "sql") => void;
	getBuilderTab: () => "form" | "code" | "sql";

	// Instances panel
	toggleInstancesPanel: () => void;
	openInstancesPanel: () => void;
	isInstancesPanelOpen: () => boolean;
	instancesSearch: (query: string) => void;
	instancesGetCurrent: () => string | null;
	instancesGetCount: () => number;
	instancesGetIndex: () => number;
	instancesNext: () => void;
	instancesPrevious: () => void;
	instancesGoToIndex: (index: number) => void;

	// Form tree
	getFormTree: () => FormTree;

	// Properties
	setName: (name: string) => void;
	setStatus: (status: string) => void;

	// Constants
	addConstant: (name?: string, valueString?: string) => string;
	updateConstant: (
		nodeId: string,
		field: "name" | "valueString",
		value: string,
	) => void;
	removeConstant: (nodeId: string) => void;

	// Where
	addWhere: (path?: string) => string;
	updateWhere: (nodeId: string, path: string) => void;
	removeWhere: (nodeId: string) => void;

	// Select
	addSelect: (
		type: "column" | "forEach" | "forEachOrNull" | "unionAll",
		parentNodeId?: string,
	) => string;
	removeSelect: (nodeId: string) => void;
	updateSelectExpression: (nodeId: string, expression: string) => void;

	// Columns
	addColumn: (selectNodeId: string, name?: string, path?: string) => string;
	updateColumn: (
		selectNodeId: string,
		columnNodeId: string,
		field: "name" | "path",
		value: string,
	) => void;
	removeColumn: (selectNodeId: string, columnNodeId: string) => void;
}
