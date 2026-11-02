import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { AidboxClientR5 } from "../../AidboxClient";
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

export type TerminologyResource = {
	resourceType: TerminologyKind;
	id: string;
	url?: string;
	version?: string;
	name?: string;
	title?: string;
	description?: string;
	status?: string;
};

const ELEMENTS = "id,url,version,name,title,description,status";

async function fetchOne(
	client: AidboxClientR5,
	kind: TerminologyKind,
	canonical: string,
): Promise<TerminologyResource | null> {
	const idx = canonical.indexOf("|");
	const url = idx < 0 ? canonical : canonical.slice(0, idx);
	const params: Array<[string, string]> = [
		["url", url],
		["_count", "1"],
		["_elements", ELEMENTS],
	];
	if (idx >= 0) params.push(["version", canonical.slice(idx + 1)]);
	const result = await client.request<Bundle>({
		method: "GET",
		url: `/fhir/${kind}`,
		params,
	});
	if (result.isErr()) return null;
	const r = result.value.resource.entry?.[0]?.resource as
		| TerminologyResource
		| undefined;
	return r?.resourceType === kind ? r : null;
}

/** The ValueSet or ConceptMap `canonical` (`url` or `url|version`) resolves to. */
export async function fetchTerminologyByCanonical(
	client: AidboxClientR5,
	canonical: string,
): Promise<TerminologyResource | null> {
	const [vs, cm] = await Promise.all(
		TERMINOLOGY_KINDS.map((k) => fetchOne(client, k, canonical)),
	);
	return vs ?? cm ?? null;
}
