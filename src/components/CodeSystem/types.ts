import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";

export type CodeSystemConceptProperty = {
	code?: string;
	valueCode?: string;
	valueString?: string;
	valueInteger?: number;
	valueBoolean?: boolean;
	valueDateTime?: string;
	valueDecimal?: number;
};

export type CodeSystemConcept = {
	code?: string;
	display?: string;
	definition?: string;
	property?: CodeSystemConceptProperty[];
	concept?: CodeSystemConcept[];
};

export type CodeSystemStatus = "draft" | "active" | "retired" | "unknown";

export type CodeSystemContent =
	| "not-present"
	| "example"
	| "fragment"
	| "complete"
	| "supplement";

export type CodeSystemHierarchyMeaning =
	| "grouped-by"
	| "is-a"
	| "part-of"
	| "classified-with";

export type CodeSystem = Resource & {
	resourceType: "CodeSystem";
	url?: string;
	version?: string;
	name?: string;
	status?: CodeSystemStatus;
	content?: CodeSystemContent;
	hierarchyMeaning?: CodeSystemHierarchyMeaning;
	description?: string;
	concept?: CodeSystemConcept[];
};
