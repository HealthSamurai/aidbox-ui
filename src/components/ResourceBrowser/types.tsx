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

export type SortState = {
	column: string;
	direction: "asc" | "desc";
} | null;

export interface ResourcesTabHeaderProps {
	handleSearch: (e: React.FormEvent<HTMLFormElement>) => void;
}

export interface ResourcesPageContext {
	resourceType: string;
}

export interface ResourcesTabContentContext {
	resourcesLoading: boolean;
}
