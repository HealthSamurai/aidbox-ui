import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";

export interface ResourceInstancesActions {
	switchTab: (tab: string) => void;
	instancesGetSearch: () => string;
	instancesSearch: (query: string) => void;
	instancesGetResults: () => {
		total: number;
		page: number;
		pageSize: number;
		resourceType: string;
		searchQuery: string;
		columns: string[];
		resources: Resource[];
	} | null;
	instancesGetPage: () => { page: number; pageSize: number; total: number };
	instancesGetSelected: () => string[];
	instancesSelect: (ids: string[], selected: boolean) => void;
	instancesDeleteSelected: () => Promise<string[]>;
	instancesExportSelected: () => {
		resourceType: string;
		type: string;
		entry: { resource: Resource }[];
	} | null;
	instancesChangePage: (page: number) => void;
	instancesChangePageSize: (pageSize: number) => void;
	instancesNavigateToResource: (id: string) => void;
	instancesOpenCreatePage: () => void;
	profilesList: () => Promise<
		{ url: string; name: string; version: string; isDefault: boolean }[]
	>;
	profilesSelect: (url: string) => void;
	profilesSelectTab: (
		tab: "differential" | "snapshot" | "fhirschema" | "structuredefinition",
	) => void;
	searchParamsList: () => Promise<
		{
			id: string;
			url: string;
			code: string;
			name: string;
			type: string;
			description: string;
		}[]
	>;
}
