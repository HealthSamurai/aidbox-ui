import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";

export type SQLLibrary = Resource & {
	resourceType: "Library";
	name?: string;
	title?: string;
	status?: "draft" | "active" | "retired" | "unknown";
	meta?: { profile?: string[] };
	type?: { coding?: { system?: string; code?: string }[] };
	relatedArtifact?: SQLDependsOn[];
	parameter?: SQLParameter[];
	content?: SQLContent[];
};

export type SQLDependsOn = {
	type: "depends-on";
	label?: string;
	resource?: string;
	display?: string;
};

export type SQLParameter = {
	name?: string;
	use: "in";
	type?: string;
	documentation?: string;
};

export type SQLContent = {
	contentType?: string;
	data?: string;
};

export const SQL_QUERY_PROFILE =
	"https://sql-on-fhir.org/ig/StructureDefinition/SQLQuery";
export const SQL_QUERY_TYPE_SYSTEM =
	"https://sql-on-fhir.org/ig/CodeSystem/LibraryTypesCodes";
export const SQL_QUERY_TYPE_CODE = "sql-query";

// Types supported by Aidbox SQLQuery runner (sof/core.clj do-streaming-query):
// string/date/dateTime → text (VARCHAR), integer → INTEGER, boolean → BOOLEAN, decimal → NUMERIC
export const FHIR_PARAMETER_TYPES = [
	"string",
	"boolean",
	"integer",
	"decimal",
	"date",
	"dateTime",
] as const;
export type FHIRParameterType = (typeof FHIR_PARAMETER_TYPES)[number];

export const LABEL_REGEX = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
