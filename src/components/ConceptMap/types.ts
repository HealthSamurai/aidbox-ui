import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";

export type ConceptMapTarget = {
	code?: string;
	display?: string;
	relationship?: string; // R5+
	equivalence?: string; // R4
	comment?: string;
};

export type ConceptMapElement = {
	code?: string;
	display?: string;
	noMap?: boolean;
	target?: ConceptMapTarget[];
};

export type ConceptMapUnmapped = {
	mode?: string;
	code?: string;
	display?: string;
	url?: string; // R4
	otherMap?: string; // R5+
	valueSet?: string; // R5+
	relationship?: string; // R5+
	comment?: string; // R6+
};

export type ConceptMapGroup = {
	source?: string;
	sourceVersion?: string;
	target?: string;
	targetVersion?: string;
	element?: ConceptMapElement[];
	unmapped?: ConceptMapUnmapped;
};

export type ConceptMap = Resource & {
	resourceType: "ConceptMap";
	url?: string;
	version?: string;
	name?: string;
	title?: string;
	status?: "draft" | "active" | "retired" | "unknown";
	description?: string;
	// R4 source[x] / target[x] (scope of the whole map)
	sourceUri?: string;
	sourceCanonical?: string;
	targetUri?: string;
	targetCanonical?: string;
	// R5 sourceScope[x] / targetScope[x]
	sourceScopeUri?: string;
	sourceScopeCanonical?: string;
	targetScopeUri?: string;
	targetScopeCanonical?: string;
	group?: ConceptMapGroup[];
};
