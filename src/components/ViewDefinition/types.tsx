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
	viewDefinition: ViewDefinition | undefined;
	setViewDefinition: (viewDefinition: ViewDefinition) => void;
}

export interface ResourceTypesResponse {
	[key: string]: {
		"default-profile": string;
	};
}
