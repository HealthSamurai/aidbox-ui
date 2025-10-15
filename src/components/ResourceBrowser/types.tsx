export interface ResourcesPageProps {
	resourceType: string;
}

export interface ResourcesTabTableProps {
	data:
		| {
				resources: any[];
				resourceKeys: any;
				snapshot: any;
		  }
		| undefined;
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
