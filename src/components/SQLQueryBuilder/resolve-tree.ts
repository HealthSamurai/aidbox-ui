import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { useQuery } from "@tanstack/react-query";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import type { SQLLibrary, SQLParameter } from "./types";

export type ResolvedSource = {
	libraryId: string | undefined;
	libraryName: string;
	libraryTitle: string | undefined;
	libraryDescription: string | undefined;
	canonical: string;
};

export type ResolvedParameter = {
	name: string;
	type: string | undefined;
	sources: ResolvedSource[];
};

export type ParameterConflict = {
	name: string;
	variants: Array<{ type: string | undefined; source: ResolvedSource }>;
};

export type ResolvedParameterTree = {
	inherited: ResolvedParameter[];
	conflicts: ParameterConflict[];
	unresolved: string[];
	cycles: string[][];
};

function dependsOnCanonicals(library: SQLLibrary): string[] {
	return (library.relatedArtifact ?? [])
		.filter((ra) => ra.type === "depends-on")
		.map((ra) => ra.resource)
		.filter((r): r is string => !!r);
}

function libraryKey(lib: { id?: string; url?: string }): string | null {
	if (lib.id) return `id:${lib.id}`;
	if (lib.url) return `url:${lib.url}`;
	return null;
}

function splitCanonicalVersion(canonical: string): {
	url: string;
	version: string | undefined;
} {
	const idx = canonical.indexOf("|");
	if (idx < 0) return { url: canonical, version: undefined };
	return { url: canonical.slice(0, idx), version: canonical.slice(idx + 1) };
}

async function fetchLibraryByCanonical(
	client: AidboxClientR5,
	canonical: string,
): Promise<SQLLibrary | null> {
	const relativeMatch = canonical.match(/^Library\/([^/?#]+)$/);
	if (relativeMatch) {
		const result = await client.request<SQLLibrary>({
			method: "GET",
			url: `/fhir/Library/${relativeMatch[1]}`,
		});
		if (result.isErr()) return null;
		return result.value.resource;
	}

	const { url, version } = splitCanonicalVersion(canonical);
	const params: Array<[string, string]> = [
		["url", url],
		["_count", "1"],
	];
	if (version) params.push(["version", version]);
	const result = await client.request<Bundle>({
		method: "GET",
		url: "/fhir/Library",
		params,
	});
	if (result.isErr()) return null;
	const entry = result.value.resource.entry?.[0];
	const resource = entry?.resource as SQLLibrary | undefined;
	if (!resource || resource.resourceType !== "Library") return null;
	return resource;
}

function pushParameter(
	acc: Map<string, ResolvedParameter>,
	conflicts: Map<string, ParameterConflict>,
	param: SQLParameter,
	source: ResolvedSource,
) {
	const name = param.name;
	if (!name) return;
	const existing = acc.get(name);
	if (!existing) {
		acc.set(name, { name, type: param.type, sources: [source] });
		return;
	}
	existing.sources.push(source);
	if (existing.type !== param.type) {
		const conflict = conflicts.get(name) ?? {
			name,
			variants: existing.sources.slice(0, -1).map((s) => ({
				type: existing.type,
				source: s,
			})),
		};
		conflict.variants.push({ type: param.type, source });
		conflicts.set(name, conflict);
	}
}

async function resolveParameterTreeImpl(
	client: AidboxClientR5,
	rootLibrary: SQLLibrary,
): Promise<ResolvedParameterTree> {
	const visited = new Set<string>();
	const rootKey = libraryKey(rootLibrary);
	if (rootKey) visited.add(rootKey);

	const accumulated = new Map<string, ResolvedParameter>();
	const conflicts = new Map<string, ParameterConflict>();
	const unresolved: string[] = [];
	const cycles: string[][] = [];

	let frontier: Array<{ canonical: string; path: string[] }> =
		dependsOnCanonicals(rootLibrary).map((canonical) => ({
			canonical,
			path: [rootKey ?? "root"],
		}));

	while (frontier.length > 0) {
		const fetched = await Promise.all(
			frontier.map(async (node) => {
				const lib = await fetchLibraryByCanonical(client, node.canonical);
				return { node, lib };
			}),
		);

		const nextFrontier: typeof frontier = [];
		for (const { node, lib } of fetched) {
			if (!lib) {
				unresolved.push(node.canonical);
				continue;
			}
			const key = libraryKey(lib) ?? `canonical:${node.canonical}`;
			if (visited.has(key)) {
				cycles.push([...node.path, key]);
				continue;
			}
			visited.add(key);

			const source: ResolvedSource = {
				libraryId: lib.id,
				libraryName: lib.name ?? lib.id ?? node.canonical,
				libraryTitle: lib.title,
				libraryDescription: lib.description,
				canonical: node.canonical,
			};
			for (const param of lib.parameter ?? []) {
				pushParameter(accumulated, conflicts, param, source);
			}

			for (const childCanonical of dependsOnCanonicals(lib)) {
				nextFrontier.push({
					canonical: childCanonical,
					path: [...node.path, key],
				});
			}
		}
		frontier = nextFrontier;
	}

	return {
		inherited: Array.from(accumulated.values()),
		conflicts: Array.from(conflicts.values()),
		unresolved,
		cycles,
	};
}

const EMPTY_TREE: ResolvedParameterTree = {
	inherited: [],
	conflicts: [],
	unresolved: [],
	cycles: [],
};

export function useResolvedParameterTree(library: SQLLibrary): {
	tree: ResolvedParameterTree;
	isLoading: boolean;
} {
	const client = useAidboxClient();
	const canonicals = dependsOnCanonicals(library);

	const { data, isLoading } = useQuery<ResolvedParameterTree>({
		queryKey: [
			"sqlquery-resolve-tree",
			library.id ?? null,
			library.url ?? null,
			canonicals,
		],
		queryFn: () => resolveParameterTreeImpl(client, library),
		enabled: canonicals.length > 0,
		placeholderData: (prev) => prev,
	});

	return { tree: data ?? EMPTY_TREE, isLoading };
}
