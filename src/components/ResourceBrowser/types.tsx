import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { Snapshot } from "@aidbox-ui/humanize";
import type { AidboxClientR5 } from "../../AidboxClient";

export interface ResourcesPageProps {
	client: AidboxClientR5;
	resourceType: string;
}

export interface ResourcesTabTableData {
	resources: Resource[];
	resourceKeys: string[];
	snapshot?: Snapshot;
}

export interface ResourcesTabTableProps {
	data: ResourcesTabTableData | undefined;
	total: number;
	selectedIds: Set<string>;
	setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export interface ResourcesTabFooterProps {
	total: number;
	currentPage: number;
	pageSize: number;
	selectedIds: Set<string>;
	onPageChange: (page: number) => void;
	onPageSizeChange: (size: number) => void;
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
