export interface ResourcesPageProps {
	resourceType: string;
}

export interface ResourcesTabTableProps {
	resources: any[];
}

export interface ResourcesTabHeaderProps {
	handleSearch: (e: React.FormEvent<HTMLFormElement>) => void;
}

export interface ResourcesPageContext {
	resourceType: string;
}

export interface ResourcesTabContentContext {
	resourcesLoading: boolean;
}
