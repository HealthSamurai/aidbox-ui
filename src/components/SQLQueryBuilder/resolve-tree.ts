import { useQuery } from "@tanstack/react-query";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import { resolveCanonicals } from "./canonical-resolver";
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

/** Libraries among `canonicals`, one request for the whole level. */
async function fetchLibraries(
	client: AidboxClientR5,
	canonicals: string[],
): Promise<Map<string, SQLLibrary>> {
	const resolved = await resolveCanonicals(client, canonicals);
	const libraries = new Map<string, SQLLibrary>();
	for (const [canonical, r] of resolved) {
		if (r.resourceType === "Library") {
			libraries.set(canonical, r as unknown as SQLLibrary);
		}
	}
	return libraries;
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
		const libraries = await fetchLibraries(
			client,
			frontier.map((node) => node.canonical),
		);

		const nextFrontier: typeof frontier = [];
		for (const node of frontier) {
			const lib = libraries.get(node.canonical);
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
