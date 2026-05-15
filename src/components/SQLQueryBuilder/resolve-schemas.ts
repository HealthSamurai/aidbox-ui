import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { useQuery } from "@tanstack/react-query";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import type { SQLLibrary } from "./types";

export type SchemaColumn = {
	name: string;
	path?: string;
	type?: string;
	description?: string;
	collection?: boolean;
};

export type DependsOnSchema = {
	label: string;
	canonical: string;
	columns: SchemaColumn[];
};

type RawSelect = {
	column?: Array<{
		name?: string;
		path?: string;
		type?: string;
		description?: string;
		collection?: boolean;
	}>;
	select?: RawSelect[];
	unionAll?: RawSelect[];
};

type RawViewDefinition = {
	resourceType: "ViewDefinition";
	id?: string;
	url?: string;
	name?: string;
	title?: string;
	select?: RawSelect[];
};

function flattenColumns(selects: RawSelect[] | undefined): SchemaColumn[] {
	const out: SchemaColumn[] = [];
	const seen = new Set<string>();
	const visit = (s: RawSelect) => {
		for (const c of s.column ?? []) {
			if (!c.name || seen.has(c.name)) continue;
			seen.add(c.name);
			out.push({
				name: c.name,
				path: c.path,
				type: c.type,
				description: c.description,
				collection: c.collection,
			});
		}
		for (const child of s.select ?? []) visit(child);
		for (const child of s.unionAll ?? []) visit(child);
	};
	for (const s of selects ?? []) visit(s);
	return out;
}

function splitCanonical(canonical: string): {
	url: string;
	version: string | undefined;
} {
	const idx = canonical.indexOf("|");
	if (idx < 0) return { url: canonical, version: undefined };
	return { url: canonical.slice(0, idx), version: canonical.slice(idx + 1) };
}

async function fetchViewDefinition(
	client: AidboxClientR5,
	canonical: string,
): Promise<RawViewDefinition | null> {
	const relative = canonical.match(/^ViewDefinition\/([^/?#]+)$/);
	if (relative) {
		const result = await client.request<RawViewDefinition>({
			method: "GET",
			url: `/fhir/ViewDefinition/${relative[1]}`,
		});
		if (result.isErr()) return null;
		return result.value.resource;
	}
	const { url, version } = splitCanonical(canonical);
	const params: Array<[string, string]> = [
		["url", url],
		["_count", "1"],
	];
	if (version) params.push(["version", version]);
	const result = await client.request<Bundle>({
		method: "GET",
		url: "/fhir/ViewDefinition",
		params,
	});
	if (result.isErr()) return null;
	const entry = result.value.resource.entry?.[0];
	const resource = entry?.resource as RawViewDefinition | undefined;
	if (!resource || resource.resourceType !== "ViewDefinition") return null;
	return resource;
}

type DependsOnEntry = { label: string; canonical: string };

function collectDependsOn(library: SQLLibrary): DependsOnEntry[] {
	const out: DependsOnEntry[] = [];
	for (const ra of library.relatedArtifact ?? []) {
		if (ra.type !== "depends-on") continue;
		if (!ra.label || !ra.resource) continue;
		out.push({ label: ra.label, canonical: ra.resource });
	}
	return out;
}

async function resolveSchemasImpl(
	client: AidboxClientR5,
	library: SQLLibrary,
): Promise<DependsOnSchema[]> {
	const deps = collectDependsOn(library);
	const resolved = await Promise.all(
		deps.map(async (d) => {
			const vd = await fetchViewDefinition(client, d.canonical);
			if (!vd) return null;
			return {
				label: d.label,
				canonical: d.canonical,
				columns: flattenColumns(vd.select),
			} satisfies DependsOnSchema;
		}),
	);
	return resolved.filter((s): s is DependsOnSchema => s !== null);
}

const EMPTY_SCHEMAS: DependsOnSchema[] = [];

export function useDependsOnSchemas(library: SQLLibrary): {
	schemas: DependsOnSchema[];
	isLoading: boolean;
} {
	const client = useAidboxClient();
	const deps = collectDependsOn(library);
	const queryKey = deps.map((d) => `${d.label}@${d.canonical}`).sort();

	const { data, isLoading } = useQuery<DependsOnSchema[]>({
		queryKey: ["sqlquery-depends-on-schemas", queryKey],
		queryFn: () => resolveSchemasImpl(client, library),
		enabled: deps.length > 0,
		placeholderData: (prev) => prev,
	});

	return { schemas: data ?? EMPTY_SCHEMAS, isLoading };
}
