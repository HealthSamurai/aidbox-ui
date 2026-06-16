import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";

export type SQLLibrary = Resource & {
	resourceType: "Library";
	name?: string;
	title?: string;
	description?: string;
	url?: string;
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

export const SQL_VIEW_PROFILE =
	"https://sql-on-fhir.org/ig/StructureDefinition/SQLView";
export const SQL_VIEW_TYPE_CODE = "sql-view";

export type SqlLibraryKind = "sql-query" | "sql-view";

export type SqlLibraryKindMeta = {
	kind: SqlLibraryKind;
	profile: string;
	typeCode: string;
	label: string;
	urlHistoryKey: string;
	supportsParameters: boolean;
};

export const SQL_LIBRARY_KIND_META: Record<SqlLibraryKind, SqlLibraryKindMeta> =
	{
		"sql-query": {
			kind: "sql-query",
			profile: SQL_QUERY_PROFILE,
			typeCode: SQL_QUERY_TYPE_CODE,
			label: "SQLQuery",
			urlHistoryKey: "sqlquery-library-url-history",
			supportsParameters: true,
		},
		"sql-view": {
			kind: "sql-view",
			profile: SQL_VIEW_PROFILE,
			typeCode: SQL_VIEW_TYPE_CODE,
			label: "SQLView",
			urlHistoryKey: "sqlview-library-url-history",
			supportsParameters: false,
		},
	};

export function sqlLibraryKind(lib: {
	meta?: { profile?: string[] };
	type?: { coding?: { system?: string; code?: string }[] };
}): SqlLibraryKind {
	if (lib.meta?.profile?.includes(SQL_VIEW_PROFILE)) return "sql-view";
	if (lib.type?.coding?.some((c) => c.code === SQL_VIEW_TYPE_CODE)) {
		return "sql-view";
	}
	return "sql-query";
}

export function sqlLibraryKindMeta(
	lib: Parameters<typeof sqlLibraryKind>[0],
): SqlLibraryKindMeta {
	return SQL_LIBRARY_KIND_META[sqlLibraryKind(lib)];
}

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
