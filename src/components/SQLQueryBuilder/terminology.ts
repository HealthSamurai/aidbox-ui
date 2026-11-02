import type { SchemaColumn } from "./resolve-schemas";

export type TerminologyKind = "ValueSet" | "ConceptMap";

export const TERMINOLOGY_KINDS: TerminologyKind[] = ["ValueSet", "ConceptMap"];

export function isTerminologyKind(kind: string): kind is TerminologyKind {
	return kind === "ValueSet" || kind === "ConceptMap";
}

// The relation Aidbox reads a ValueSet or ConceptMap dependency as
// (box.fhir.sof.terminology/relation-query): fixed, whatever the resource holds.
export const TERMINOLOGY_COLUMNS: Record<TerminologyKind, SchemaColumn[]> = {
	ValueSet: [
		{ name: "system", type: "uri", description: "Code system of the code" },
		{ name: "version", type: "string", description: "Code system version" },
		{ name: "code", type: "code", description: "Code in the expansion" },
		{ name: "display", type: "string", description: "Display of the code" },
		{
			name: "inactive",
			type: "boolean",
			description: "Whether the code is inactive",
		},
	],
	ConceptMap: [
		{ name: "source_system", type: "uri", description: "Source code system" },
		{
			name: "source_version",
			type: "string",
			description: "Source code system version",
		},
		{ name: "source_code", type: "code", description: "Source code" },
		{
			name: "source_display",
			type: "string",
			description: "Display of the source code",
		},
		{ name: "target_system", type: "uri", description: "Target code system" },
		{
			name: "target_version",
			type: "string",
			description: "Target code system version",
		},
		{
			name: "target_code",
			type: "code",
			description: "Target code; null when the source code has no map",
		},
		{
			name: "target_display",
			type: "string",
			description: "Display of the target code",
		},
		{
			name: "relationship",
			type: "code",
			description: "R5 relationship; an R4 equivalence is translated to it",
		},
	],
};
