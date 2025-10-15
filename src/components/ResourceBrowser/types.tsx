export interface ResourcesPageProps {
	resourceType: string;
}

export interface ResourcesTabTableProps {
	data: any[];
	resourcesWithKeys: any;
}

export interface ResourcesTabHeaderProps {
	handleSearch: (e: React.FormEvent<HTMLFormElement>) => void;
}

export interface ResourcesPageContext {
	resourceType: string;
}

export interface ResourcesTabContentContext {
	resourcesLoading: boolean;
	schemaLoading: boolean;
}
