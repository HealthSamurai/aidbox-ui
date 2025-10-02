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

export interface ViewDefinition {
	resourceType: string;
	resource: string;
	name?: string;
	id: string;
	select: ViewDefinitionSelectItem[];
}

export interface ViewDefinitionContextProps {
	originalId?: string;
	viewDefinition: ViewDefinition | undefined;
	setViewDefinition: (viewDefinition: ViewDefinition) => void;
	isLoadingViewDef: boolean;
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
