import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { useQuery } from "@tanstack/react-query";
import { type AidboxClientR5, useAidboxClient } from "../../../AidboxClient";
import type { ValueSet } from "../types";
import type {
	CodeSystemNodeData,
	GraphEdge,
	GraphEdgeKind,
	GraphNode,
	GraphNodeData,
	UnresolvedNodeData,
	ValueSetGraph,
	ValueSetNodeData,
} from "./types";

const COL_WIDTH = 540;
const ROW_HEIGHT = 320;

type RawConcept = unknown;

type RawValueSet = {
	resourceType: "ValueSet";
	id?: string;
	url?: string;
	version?: string;
	name?: string;
	title?: string;
	description?: string;
	status?: string;
	compose?: {
		include?: Array<{
			system?: string;
			version?: string;
			valueSet?: string[];
		}>;
		exclude?: Array<{
			system?: string;
			version?: string;
			valueSet?: string[];
		}>;
	};
};

type RawCodeSystem = {
	resourceType: "CodeSystem";
	id?: string;
	url?: string;
	version?: string;
	name?: string;
	title?: string;
	description?: string;
	status?: string;
	content?: string;
	count?: number;
	valueSet?: string;
	supplements?: string;
	concept?: RawConcept[];
};

function buildCanonical(url?: string, version?: string): string {
	if (!url) return "";
	return version ? `${url}|${version}` : url;
}

function splitCanonical(canonical: string): { url: string; version?: string } {
	const idx = canonical.indexOf("|");
	if (idx < 0) return { url: canonical };
	return { url: canonical.slice(0, idx), version: canonical.slice(idx + 1) };
}

async function fetchByCanonical<T extends RawValueSet | RawCodeSystem>(
	client: AidboxClientR5,
	resourceType: "ValueSet" | "CodeSystem",
	canonical: string,
): Promise<T | null> {
	const relative = canonical.match(/^(ValueSet|CodeSystem)\/([^/?#]+)$/);
	if (relative && relative[1] === resourceType) {
		const result = await client.request<T>({
			method: "GET",
			url: `/fhir/${resourceType}/${relative[2]}`,
		});
		if (result.isErr()) return null;
		return result.value.resource;
	}
	const { url, version } = splitCanonical(canonical);
	if (!url) return null;
	const params: Array<[string, string]> = [
		["url", url],
		["_count", "1"],
		["_sort", "-_lastUpdated"],
	];
	if (version) params.push(["version", version]);
	const result = await client.request<Bundle>({
		method: "GET",
		url: `/fhir/${resourceType}`,
		params,
	});
	if (result.isErr()) return null;
	const entry = result.value.resource.entry?.[0];
	const r = entry?.resource as T | undefined;
	if (!r || r.resourceType !== resourceType) return null;
	return r;
}

function valueSetNodeData(vs: RawValueSet, isRoot: boolean): ValueSetNodeData {
	const include = vs.compose?.include ?? [];
	const exclude = vs.compose?.exclude ?? [];
	let includeSystems = 0;
	let includeValueSets = 0;
	for (const inc of include) {
		if (inc.system) includeSystems++;
		includeValueSets += (inc.valueSet ?? []).length;
	}
	let excludeSystems = 0;
	let excludeValueSets = 0;
	for (const exc of exclude) {
		if (exc.system) excludeSystems++;
		excludeValueSets += (exc.valueSet ?? []).length;
	}
	return {
		kind: "value-set",
		id: vs.id,
		url: vs.url,
		version: vs.version,
		name: vs.name,
		title: vs.title,
		description: vs.description,
		status: vs.status,
		isRoot,
		includeSystems,
		includeValueSets,
		excludeSystems,
		excludeValueSets,
	};
}

function codeSystemNodeData(cs: RawCodeSystem): CodeSystemNodeData {
	return {
		kind: "code-system",
		id: cs.id,
		url: cs.url,
		version: cs.version,
		name: cs.name,
		title: cs.title,
		description: cs.description,
		status: cs.status,
		content: cs.content,
		count: cs.count,
	};
}

function unresolvedNodeData(
	resourceKind: "ValueSet" | "CodeSystem",
	canonical: string,
): UnresolvedNodeData {
	const { url, version } = splitCanonical(canonical);
	return { kind: "unresolved", resourceKind, url, version };
}

function valueSetNodeId(vs: RawValueSet, canonical: string): string {
	return `value-set:${vs.id ?? vs.url ?? canonical}`;
}

function codeSystemNodeId(cs: RawCodeSystem, canonical: string): string {
	return `code-system:${cs.id ?? cs.url ?? canonical}`;
}

function unresolvedNodeId(
	resourceKind: "ValueSet" | "CodeSystem",
	canonical: string,
): string {
	return `unresolved:${resourceKind}:${canonical}`;
}

type QueueItem = {
	canonical: string;
	resourceKind: "ValueSet" | "CodeSystem";
	parentId: string;
	depth: number;
	edgeKind: GraphEdgeKind;
};

type BuildState = {
	nodesById: Map<string, { data: GraphNodeData; type: string }>;
	depthById: Map<string, number>;
	canonicalToId: Map<string, string>;
	edges: GraphEdge[];
	edgeKeys: Set<string>;
};

function setDepth(state: BuildState, id: string, depth: number) {
	const prev = state.depthById.get(id);
	state.depthById.set(id, prev === undefined ? depth : Math.max(prev, depth));
}

function pushEdge(
	state: BuildState,
	source: string,
	target: string,
	edgeKind: GraphEdgeKind,
) {
	const id = `${source}->${target}:${edgeKind}`;
	if (state.edgeKeys.has(id)) return;
	state.edgeKeys.add(id);
	state.edges.push({
		id,
		source,
		target,
		data: { edgeKind },
	});
}

function rootCanonical(vs: RawValueSet): string {
	const canonical = buildCanonical(vs.url, vs.version);
	if (canonical) return canonical;
	if (vs.id) return `ValueSet/${vs.id}`;
	return "ValueSet/root";
}

function processValueSetNode(
	state: BuildState,
	canonical: string,
	vs: RawValueSet,
	isRoot: boolean,
): { id: string; isNew: boolean } {
	const id = valueSetNodeId(vs, canonical);
	if (state.nodesById.has(id)) return { id, isNew: false };
	state.nodesById.set(id, {
		type: "value-set",
		data: valueSetNodeData(vs, isRoot),
	});
	state.canonicalToId.set(canonical, id);
	return { id, isNew: true };
}

function processCodeSystemNode(
	state: BuildState,
	canonical: string,
	cs: RawCodeSystem,
): { id: string; isNew: boolean } {
	const id = codeSystemNodeId(cs, canonical);
	if (state.nodesById.has(id)) return { id, isNew: false };
	state.nodesById.set(id, {
		type: "code-system",
		data: codeSystemNodeData(cs),
	});
	state.canonicalToId.set(canonical, id);
	return { id, isNew: true };
}

function processUnresolvedNode(
	state: BuildState,
	resourceKind: "ValueSet" | "CodeSystem",
	canonical: string,
): { id: string; isNew: boolean } {
	const id = unresolvedNodeId(resourceKind, canonical);
	if (state.nodesById.has(id)) return { id, isNew: false };
	state.nodesById.set(id, {
		type: "unresolved",
		data: unresolvedNodeData(resourceKind, canonical),
	});
	state.canonicalToId.set(canonical, id);
	return { id, isNew: true };
}

function collectComposeDeps(
	vs: RawValueSet,
	parentId: string,
	parentDepth: number,
): QueueItem[] {
	const out: QueueItem[] = [];
	const childDepth = parentDepth + 1;
	for (const inc of vs.compose?.include ?? []) {
		if (inc.system) {
			const canonical = buildCanonical(inc.system, inc.version);
			if (canonical) {
				out.push({
					canonical,
					resourceKind: "CodeSystem",
					parentId,
					depth: childDepth,
					edgeKind: "include",
				});
			}
		}
		for (const vsRef of inc.valueSet ?? []) {
			out.push({
				canonical: vsRef,
				resourceKind: "ValueSet",
				parentId,
				depth: childDepth,
				edgeKind: "include",
			});
		}
	}
	for (const exc of vs.compose?.exclude ?? []) {
		if (exc.system) {
			const canonical = buildCanonical(exc.system, exc.version);
			if (canonical) {
				out.push({
					canonical,
					resourceKind: "CodeSystem",
					parentId,
					depth: childDepth,
					edgeKind: "exclude",
				});
			}
		}
		for (const vsRef of exc.valueSet ?? []) {
			out.push({
				canonical: vsRef,
				resourceKind: "ValueSet",
				parentId,
				depth: childDepth,
				edgeKind: "exclude",
			});
		}
	}
	return out;
}

function collectCodeSystemDeps(
	cs: RawCodeSystem,
	parentId: string,
	parentDepth: number,
): QueueItem[] {
	const out: QueueItem[] = [];
	const childDepth = parentDepth + 1;
	if (cs.supplements) {
		out.push({
			canonical: cs.supplements,
			resourceKind: "CodeSystem",
			parentId,
			depth: childDepth,
			edgeKind: "supplements",
		});
	}
	return out;
}

type FetchKey = { canonical: string; resourceKind: "ValueSet" | "CodeSystem" };

async function fetchUniqueResources(
	client: AidboxClientR5,
	keys: FetchKey[],
): Promise<Map<string, RawValueSet | RawCodeSystem | null>> {
	const dedup = new Map<string, FetchKey>();
	for (const k of keys) {
		const dedupKey = `${k.resourceKind}|${k.canonical}`;
		if (!dedup.has(dedupKey)) dedup.set(dedupKey, k);
	}
	const entries = await Promise.all(
		Array.from(dedup.entries()).map(async ([dedupKey, k]) => {
			const resource =
				k.resourceKind === "ValueSet"
					? await fetchByCanonical<RawValueSet>(client, "ValueSet", k.canonical)
					: await fetchByCanonical<RawCodeSystem>(
							client,
							"CodeSystem",
							k.canonical,
						);
			return [dedupKey, resource] as const;
		}),
	);
	return new Map(entries);
}

async function buildGraph(
	client: AidboxClientR5,
	rootVs: RawValueSet,
): Promise<ValueSetGraph> {
	const rootCan = rootCanonical(rootVs);
	const state: BuildState = {
		nodesById: new Map(),
		depthById: new Map(),
		canonicalToId: new Map(),
		edges: [],
		edgeKeys: new Set(),
	};
	const { id: rootId } = processValueSetNode(state, rootCan, rootVs, true);
	setDepth(state, rootId, 0);

	const fetchedCanonicals = new Set<string>([`ValueSet|${rootCan}`]);
	let frontier: QueueItem[] = collectComposeDeps(rootVs, rootId, 0);

	while (frontier.length > 0) {
		const toFetch = frontier.filter(
			(q) => !fetchedCanonicals.has(`${q.resourceKind}|${q.canonical}`),
		);
		for (const q of toFetch) {
			fetchedCanonicals.add(`${q.resourceKind}|${q.canonical}`);
		}

		const resources = await fetchUniqueResources(client, toFetch);

		const next: QueueItem[] = [];

		for (const q of frontier) {
			const dedupKey = `${q.resourceKind}|${q.canonical}`;
			const resource = resources.get(dedupKey);

			if (resource === undefined) {
				const existingId = state.canonicalToId.get(q.canonical);
				if (existingId) {
					pushEdge(state, q.parentId, existingId, q.edgeKind);
				}
				continue;
			}

			if (!resource) {
				const { id } = processUnresolvedNode(
					state,
					q.resourceKind,
					q.canonical,
				);
				setDepth(state, id, q.depth);
				pushEdge(state, q.parentId, id, q.edgeKind);
				continue;
			}

			if (q.resourceKind === "ValueSet") {
				const vs = resource as RawValueSet;
				const { id, isNew } = processValueSetNode(
					state,
					q.canonical,
					vs,
					false,
				);
				setDepth(state, id, q.depth);
				pushEdge(state, q.parentId, id, q.edgeKind);
				if (isNew) {
					next.push(...collectComposeDeps(vs, id, q.depth));
				}
			} else {
				const cs = resource as RawCodeSystem;
				const { id, isNew } = processCodeSystemNode(state, q.canonical, cs);
				setDepth(state, id, q.depth);
				pushEdge(state, q.parentId, id, q.edgeKind);
				if (isNew) {
					next.push(...collectCodeSystemDeps(cs, id, q.depth));
				}
			}
		}

		frontier = next;
	}

	return layoutGraph(state);
}

function orderColumns(
	state: BuildState,
	byDepth: Map<number, string[]>,
	sortedDepths: number[],
): Map<string, number> {
	const parentsByNode = new Map<string, string[]>();
	const childrenByNode = new Map<string, string[]>();
	for (const e of state.edges) {
		const ps = parentsByNode.get(e.target) ?? [];
		ps.push(e.source);
		parentsByNode.set(e.target, ps);
		const cs = childrenByNode.get(e.source) ?? [];
		cs.push(e.target);
		childrenByNode.set(e.source, cs);
	}

	const indexById = new Map<string, number>();
	for (const depth of sortedDepths) {
		const ids = byDepth.get(depth) ?? [];
		ids.forEach((id, i) => indexById.set(id, i));
	}

	const reorderColumn = (
		ids: string[],
		neighborsByNode: Map<string, string[]>,
	) => {
		const withScore = ids.map((id, originalIdx) => {
			const neighbors = neighborsByNode.get(id) ?? [];
			let sum = 0;
			let cnt = 0;
			for (const n of neighbors) {
				const idx = indexById.get(n);
				if (idx !== undefined) {
					sum += idx;
					cnt++;
				}
			}
			const bary = cnt > 0 ? sum / cnt : originalIdx;
			return { id, bary, originalIdx };
		});
		withScore.sort((a, b) => {
			if (a.bary !== b.bary) return a.bary - b.bary;
			return a.originalIdx - b.originalIdx;
		});
		const sorted = withScore.map((x) => x.id);
		sorted.forEach((id, i) => indexById.set(id, i));
		return sorted;
	};

	const ITERATIONS = 4;
	for (let iter = 0; iter < ITERATIONS; iter++) {
		for (let i = 1; i < sortedDepths.length; i++) {
			const depth = sortedDepths[i];
			if (depth === undefined) continue;
			const ids = byDepth.get(depth) ?? [];
			byDepth.set(depth, reorderColumn(ids, parentsByNode));
		}
		for (let i = sortedDepths.length - 2; i >= 0; i--) {
			const depth = sortedDepths[i];
			if (depth === undefined) continue;
			const ids = byDepth.get(depth) ?? [];
			byDepth.set(depth, reorderColumn(ids, childrenByNode));
		}
	}

	return indexById;
}

function layoutGraph(state: BuildState): ValueSetGraph {
	const byDepth = new Map<number, string[]>();
	for (const [id, depth] of state.depthById) {
		const list = byDepth.get(depth) ?? [];
		list.push(id);
		byDepth.set(depth, list);
	}
	const sortedDepths = Array.from(byDepth.keys()).sort((a, b) => a - b);
	orderColumns(state, byDepth, sortedDepths);

	const nodes: GraphNode[] = [];
	const yById = new Map<string, number>();
	for (const depth of sortedDepths) {
		const ids = byDepth.get(depth) ?? [];
		ids.forEach((id, i) => {
			const entry = state.nodesById.get(id);
			if (!entry) return;
			const x = -depth * COL_WIDTH;
			const y = (i - (ids.length - 1) / 2) * ROW_HEIGHT;
			yById.set(id, y);
			nodes.push({
				id,
				type: entry.type,
				position: { x, y },
				data: entry.data,
			});
		});
	}

	assignHandles(state.edges, yById);

	return { nodes, edges: state.edges };
}

const HANDLE_COUNT = 5;
const HANDLE_TOPS = Array.from(
	{ length: HANDLE_COUNT },
	(_, i) => `${((i + 1) / (HANDLE_COUNT + 1)) * 100}%`,
);

function pickHandleTop(i: number, n: number): string {
	const idx =
		n <= 1
			? Math.floor(HANDLE_COUNT / 2)
			: Math.round((i / (n - 1)) * (HANDLE_COUNT - 1));
	return HANDLE_TOPS[idx] ?? (HANDLE_TOPS[0] as string);
}

function assignHandles(edges: GraphEdge[], yById: Map<string, number>) {
	const outBySrc = new Map<string, GraphEdge[]>();
	const inByTgt = new Map<string, GraphEdge[]>();
	for (const e of edges) {
		const out = outBySrc.get(e.source) ?? [];
		out.push(e);
		outBySrc.set(e.source, out);
		const inc = inByTgt.get(e.target) ?? [];
		inc.push(e);
		inByTgt.set(e.target, inc);
	}
	for (const [, list] of outBySrc) {
		list.sort(
			(a, b) => (yById.get(a.target) ?? 0) - (yById.get(b.target) ?? 0),
		);
		list.forEach((e, i) => {
			e.sourceHandle = `source-${pickHandleTop(i, list.length)}`;
		});
	}
	for (const [, list] of inByTgt) {
		list.sort(
			(a, b) => (yById.get(a.source) ?? 0) - (yById.get(b.source) ?? 0),
		);
		list.forEach((e, i) => {
			e.targetHandle = `target-${pickHandleTop(i, list.length)}`;
		});
	}
}

export function useValueSetGraph(valueSet: ValueSet): {
	graph: ValueSetGraph;
	isLoading: boolean;
} {
	const client = useAidboxClient();
	const composeKey = JSON.stringify(valueSet.compose ?? {});
	const { data, isLoading } = useQuery<ValueSetGraph>({
		queryKey: [
			"valueset-graph",
			valueSet.id ?? null,
			valueSet.url ?? null,
			valueSet.version ?? null,
			composeKey,
		],
		queryFn: () => buildGraph(client, valueSet as RawValueSet),
		placeholderData: (prev) => prev,
		staleTime: Number.POSITIVE_INFINITY,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		refetchOnMount: false,
	});
	return {
		graph: data ?? { nodes: [], edges: [] },
		isLoading,
	};
}
