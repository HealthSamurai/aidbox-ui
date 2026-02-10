import type { ViewDefinition } from "@aidbox-ui/fhir-types/org-sql-on-fhir-ig";
import type {
	OperationOutcome,
	OperationOutcomeIssue,
} from "@health-samurai/react-components";

export interface ViewDefinitionContextProps {
	originalId?: string | undefined;
	viewDefinition: ViewDefinition | undefined;
	setViewDefinition: (viewDefinition: ViewDefinition) => void;
	isLoadingViewDef: boolean;
	runResult: string | undefined;
	setRunResult: (result: string) => void;
	runResultPageSize: number | undefined;
	setRunResultPageSize: (result: number) => void;
	runResultPage: number | undefined;
	setRunResultPage: (result: number) => void;
	runViewDefinition: ViewDefinition | undefined;
	setRunViewDefinition: (viewDefinition: ViewDefinition) => void;
	isDirty: boolean;
	setIsDirty: (isDirty: boolean) => void;
	runError: OperationOutcome | undefined;
	setRunError: (error: OperationOutcome | undefined) => void;
	issueClickRef: React.MutableRefObject<
		((issue: OperationOutcomeIssue) => void) | undefined
	>;
}

export interface ViewDefinitionResourceTypeContextProps {
	viewDefinitionResourceType: string | undefined;
	setViewDefinitionResourceType: (viewDefinitionResourceType: string) => void;
}

export type ViewDefinitionPageTab = "builder" | "edit" | "versions";
export type ViewDefinitionEditorTab = "form" | "code" | "sql";
export type ViewDefinitionEditorMode = "json" | "yaml";

export interface ViewDefinitionEditorContextProps {
	selectedTab: ViewDefinitionEditorTab;
	setSelectedTab: (selectedTab: ViewDefinitionEditorTab) => void;
}

export interface ResourceTypesResponse {
	[key: string]: {
		"default-profile": string;
	};
}

export interface Snapshot {
	type: string | null;
	lvl: number;
	name: string;
	path?: string;
	short?: string;
	desc?: string;
	id: string;
	"union?"?: boolean;
	min?: number | string;
	max?: number | string;
	datatype?: string;
	flags?: string[];
	"extension-url"?: string;
	"extension-coordinate"?: { label: string };
	binding?: { strength: string; valueSet: string };
	"vs-coordinate"?: {
		label: string;
		id: string;
		"package-spec": {
			name: string;
			version: string;
		};
	};
}

export interface Meta {
	type?: string;
	description?: string | undefined;
	min?: number | string;
	max?: number | string;
	short?: string;
	isSummary?: boolean;
	isModifier?: boolean;
	mustSupport?: boolean;
	desc?: string;
	extensionUrl?: string;
	extensionCoordinate?: { label: string };
	binding?: { strength: string; valueSet: string };
	vsCoordinate?: {
		label: string;
		id: string;
		"package-spec": { name: string; version: string };
	};
	lastNode?: boolean;
}
