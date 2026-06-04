import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";

export type ValueSetExpansionContains = {
	system?: string;
	code?: string;
	display?: string;
	version?: string;
	inactive?: boolean;
};

export type ValueSetExpansion = {
	identifier?: string;
	timestamp?: string;
	total?: number;
	offset?: number;
	contains?: ValueSetExpansionContains[];
};

export type ValueSetIncludeConcept = {
	code?: string;
	display?: string;
};

export type ValueSetIncludeFilter = {
	property?: string;
	op?: string;
	value?: string;
};

export type ValueSetInclude = {
	system?: string;
	version?: string;
	concept?: ValueSetIncludeConcept[];
	filter?: ValueSetIncludeFilter[];
	valueSet?: string[];
};

export type ValueSetCompose = {
	include?: ValueSetInclude[];
	exclude?: ValueSetInclude[];
};

export type ValueSetStatus = "draft" | "active" | "retired" | "unknown";

export type ValueSet = Resource & {
	resourceType: "ValueSet";
	url?: string;
	version?: string;
	title?: string;
	status?: ValueSetStatus;
	description?: string;
	compose?: ValueSetCompose;
	expansion?: ValueSetExpansion;
};
