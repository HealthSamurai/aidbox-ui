export interface ViewDefinitionSelectItem {
	column?: Array<{
		name: string;
		path: string;
		type?: string;
	}>;
	forEach?: string;
	forEachOrNull?: string;
	unionAll?: ViewDefinitionSelectItem[];
	select?: ViewDefinitionSelectItem[];
}

export interface ViewDefinitionConstant {
	name: string;
	valueString?: string;
}

export interface ViewDefinitionWhere {
	path: string;
}

export interface ViewDefinition {
	resourceType: string;
	resource: string;
	name?: string;
	id?: string;
	select?: ViewDefinitionSelectItem[];
	constant?: ViewDefinitionConstant[];
	where?: ViewDefinitionWhere[];
	title?: string;
	description?: string;
	status?: string;
	url?: string;
	publisher?: string;
	copyright?: string;
	experimental?: boolean;
	fhirVersion?: string[] | undefined;
	identifier?: {
		system?: string;
		value?: string;
	}[];
}

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
}

export interface ViewDefinitionResourceTypeContextProps {
	viewDefinitionResourceType: string | undefined;
	setViewDefinitionResourceType: (viewDefinitionResourceType: string) => void;
}

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
