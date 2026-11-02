import { useQuery } from "@tanstack/react-query";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import {
	type CanonicalResource,
	resolveCanonicals,
} from "./canonical-resolver";
import { isTerminologyKind, TERMINOLOGY_COLUMNS } from "./terminology";
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

function columnsOf(r: CanonicalResource): SchemaColumn[] | null {
	if (r.resourceType === "ViewDefinition") {
		return flattenColumns(r.select as RawSelect[] | undefined);
	}
	if (isTerminologyKind(r.resourceType)) {
		return TERMINOLOGY_COLUMNS[r.resourceType];
	}
	return null;
}

async function resolveSchemasImpl(
	client: AidboxClientR5,
	library: SQLLibrary,
): Promise<DependsOnSchema[]> {
	const deps = collectDependsOn(library);
	const resolved = await resolveCanonicals(
		client,
		deps.map((d) => d.canonical),
	);
	return deps.flatMap((d) => {
		const r = resolved.get(d.canonical);
		const columns = r ? columnsOf(r) : null;
		if (!columns) return [];
		return [{ label: d.label, canonical: d.canonical, columns }];
	});
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
