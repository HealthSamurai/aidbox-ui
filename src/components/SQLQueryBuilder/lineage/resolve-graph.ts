import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { useQuery } from "@tanstack/react-query";
import type { Edge, Node } from "@xyflow/react";
import { type AidboxClientR5, useAidboxClient } from "../../../AidboxClient";
import type { SQLLibrary } from "../types";
import type {
	LineageNodeData,
	ResourceTypeNodeData,
	SQLQueryNodeData,
	ViewConstant,
	ViewDefinitionNodeData,
	ViewSelect,
} from "./types";

type RawLibrary = SQLLibrary & { description?: string };

type RawSelect = {
	column?: Array<{
		name?: string;
		path?: string;
		type?: string;
		description?: string;
		collection?: boolean;
	}>;
	forEach?: string;
	forEachOrNull?: string;
	repeat?: string;
	where?: Array<{ path?: string; description?: string }>;
	select?: RawSelect[];
	unionAll?: RawSelect[];
};

type RawConstant = { name?: string } & Record<string, unknown>;

type RawViewDefinition = {
	resourceType: "ViewDefinition";
	id?: string;
	url?: string;
	name?: string;
	title?: string;
	description?: string;
	resource?: string;
	constant?: RawConstant[];
	select?: RawSelect[];
	where?: Array<{ path?: string; description?: string }>;
};

type ResolvedNode =
	| { kind: "resource-type"; id: string; data: ResourceTypeNodeData }
	| { kind: "view-definition"; id: string; data: ViewDefinitionNodeData }
	| { kind: "sql-query"; id: string; data: SQLQueryNodeData };

export type LineageGraph = {
	nodes: Node<LineageNodeData>[];
	edges: Edge[];
};

function splitCanonical(canonical: string): { url: string; version?: string } {
	const idx = canonical.indexOf("|");
	if (idx < 0) return { url: canonical };
	return { url: canonical.slice(0, idx), version: canonical.slice(idx + 1) };
}

async function fetchByCanonical<T>(
	client: AidboxClientR5,
	resourceType: "Library" | "ViewDefinition",
	canonical: string,
): Promise<T | null> {
	const relative = canonical.match(/^(Library|ViewDefinition)\/([^/?#]+)$/);
	if (relative && relative[1] === resourceType) {
		const result = await client.request<T>({
			method: "GET",
			url: `/fhir/${resourceType}/${relative[2]}`,
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
		url: `/fhir/${resourceType}`,
		params,
	});
	if (result.isErr()) return null;
	const entry = result.value.resource.entry?.[0];
	const r = entry?.resource as T | undefined;
	if (!r) return null;
	return r;
}

async function resolveAny(
	client: AidboxClientR5,
	canonical: string,
): Promise<
	| { type: "library"; resource: RawLibrary }
	| { type: "view-definition"; resource: RawViewDefinition }
	| null
> {
	const [lib, vd] = await Promise.all([
		fetchByCanonical<RawLibrary>(client, "Library", canonical),
		fetchByCanonical<RawViewDefinition>(client, "ViewDefinition", canonical),
	]);
	if (lib?.resourceType === "Library")
		return { type: "library", resource: lib };
	if (vd?.resourceType === "ViewDefinition")
		return { type: "view-definition", resource: vd };
	return null;
}

function dependsOnCanonicals(lib: RawLibrary): string[] {
	return (lib.relatedArtifact ?? [])
		.filter((ra) => ra.type === "depends-on")
		.map((ra) => ra.resource ?? "")
		.filter(Boolean);
}

function normalizeSelect(s: RawSelect): ViewSelect {
	return {
		column: (s.column ?? [])
			.filter((c) => c.name)
			.map((c) => ({
				name: c.name as string,
				path: c.path,
				type: c.type,
				description: c.description,
				collection: c.collection,
			})),
		forEach: s.forEach,
		forEachOrNull: s.forEachOrNull,
		repeat: s.repeat,
		where: (s.where ?? [])
			.filter((w) => w.path)
			.map((w) => ({ path: w.path as string, description: w.description })),
		select: (s.select ?? []).map(normalizeSelect),
		unionAll: (s.unionAll ?? []).map(normalizeSelect),
	};
}

function normalizeRootSelects(vd: RawViewDefinition): ViewSelect[] {
	return (vd.select ?? []).map(normalizeSelect);
}

function normalizeRootWhere(
	vd: RawViewDefinition,
): { path: string; description?: string }[] {
	return (vd.where ?? [])
		.filter((w) => w.path)
		.map((w) => ({ path: w.path as string, description: w.description }));
}

function normalizeConstants(vd: RawViewDefinition): ViewConstant[] {
	const out: ViewConstant[] = [];
	for (const c of vd.constant ?? []) {
		if (!c.name) continue;
		for (const key of Object.keys(c)) {
			if (key.startsWith("value")) {
				const type = key.slice("value".length);
				const v = c[key];
				out.push({
					name: c.name,
					type: type.charAt(0).toLowerCase() + type.slice(1),
					value: typeof v === "object" ? JSON.stringify(v) : String(v),
				});
				break;
			}
		}
	}
	return out;
}

function decodeBase64(b64: string): string {
	try {
		return atob(b64);
	} catch {
		return "";
	}
}

function librarySql(lib: { content?: Array<{ data?: string }> }): string {
	const data = lib.content?.[0]?.data;
	return data ? decodeBase64(data) : "";
}

function rootLibraryNode(lib: SQLLibrary): ResolvedNode {
	const id = `library:${lib.id ?? lib.url ?? "root"}`;
	return {
		kind: "sql-query",
		id,
		data: {
			kind: "sql-query",
			id: lib.id ?? "",
			canonical: lib.url ?? "",
			name: lib.name ?? "",
			title: lib.title,
			description: lib.description,
			sql: librarySql(lib),
			parameters: (lib.parameter ?? [])
				.filter((p) => p.name)
				.map((p) => ({ name: p.name as string, type: p.type })),
			inheritedParameters: [],
			isRoot: true,
		},
	};
}

function libraryNode(lib: RawLibrary, canonical: string): ResolvedNode {
	const id = `library:${lib.id ?? canonical}`;
	return {
		kind: "sql-query",
		id,
		data: {
			kind: "sql-query",
			id: lib.id ?? "",
			canonical,
			name: lib.name ?? "",
			title: lib.title,
			description: lib.description,
			sql: librarySql(lib),
			parameters: (lib.parameter ?? [])
				.filter((p) => p.name)
				.map((p) => ({ name: p.name as string, type: p.type })),
			inheritedParameters: [],
			isRoot: false,
		},
	};
}

function viewDefinitionNode(
	vd: RawViewDefinition,
	canonical: string,
): ResolvedNode {
	const id = `view-definition:${vd.id ?? canonical}`;
	return {
		kind: "view-definition",
		id,
		data: {
			kind: "view-definition",
			id: vd.id ?? "",
			canonical,
			name: vd.name ?? "",
			title: vd.title,
			description: vd.description,
			resourceType: vd.resource,
			constants: normalizeConstants(vd),
			select: normalizeRootSelects(vd),
			where: normalizeRootWhere(vd),
		},
	};
}

function resourceTypeNode(resourceType: string): ResolvedNode {
	return {
		kind: "resource-type",
		id: `resource-type:${resourceType}`,
		data: { kind: "resource-type", resourceType },
	};
}

type QItem = { canonical: string; parentId: string; depth: number };

type BuildState = {
	nodesById: Map<string, ResolvedNode>;
	depthById: Map<string, number>;
	edges: Edge[];
	visited: Set<string>;
};

function setDepth(state: BuildState, id: string, depth: number) {
	const prev = state.depthById.get(id);
	state.depthById.set(id, prev === undefined ? depth : Math.max(prev, depth));
}

function pushEdge(state: BuildState, source: string, target: string) {
	state.edges.push({ id: `${source}->${target}`, source, target });
}

function attachResourceType(
	state: BuildState,
	vdNode: ResolvedNode,
	vd: RawViewDefinition,
	depth: number,
) {
	const rt = vd.resource;
	if (!rt) return;
	const rtNode = resourceTypeNode(rt);
	if (!state.nodesById.has(rtNode.id)) state.nodesById.set(rtNode.id, rtNode);
	setDepth(state, rtNode.id, depth);
	pushEdge(state, rtNode.id, vdNode.id);
}

function processResolvedItem(
	state: BuildState,
	item: QItem,
	resolved:
		| { type: "library"; resource: RawLibrary }
		| {
				type: "view-definition";
				resource: RawViewDefinition;
		  },
	next: QItem[],
) {
	const node =
		resolved.type === "library"
			? libraryNode(resolved.resource, item.canonical)
			: viewDefinitionNode(resolved.resource, item.canonical);

	pushEdge(state, node.id, item.parentId);
	if (state.visited.has(node.id)) return;
	state.visited.add(node.id);
	state.nodesById.set(node.id, node);
	setDepth(state, node.id, item.depth);

	if (resolved.type === "library") {
		for (const child of dependsOnCanonicals(resolved.resource)) {
			next.push({
				canonical: child,
				parentId: node.id,
				depth: item.depth + 1,
			});
		}
	} else {
		attachResourceType(state, node, resolved.resource, item.depth + 1);
	}
}

async function buildGraph(
	client: AidboxClientR5,
	root: SQLLibrary,
): Promise<LineageGraph> {
	const rootNode = rootLibraryNode(root);
	const state: BuildState = {
		nodesById: new Map([[rootNode.id, rootNode]]),
		depthById: new Map([[rootNode.id, 0]]),
		edges: [],
		visited: new Set([rootNode.id]),
	};

	let frontier: QItem[] = dependsOnCanonicals(root as RawLibrary).map((c) => ({
		canonical: c,
		parentId: rootNode.id,
		depth: 1,
	}));

	while (frontier.length > 0) {
		const fetched = await Promise.all(
			frontier.map(async (item) => ({
				item,
				resolved: await resolveAny(client, item.canonical),
			})),
		);
		const next: QItem[] = [];
		for (const { item, resolved } of fetched) {
			if (!resolved) continue;
			processResolvedItem(state, item, resolved, next);
		}
		frontier = next;
	}
	const { nodesById, depthById, edges } = state;

	attachInheritedParameters(nodesById, edges);

	return layoutGraph(nodesById, depthById, edges);
}

function collectDeps(
	rootId: string,
	incoming: Map<string, string[]>,
): Set<string> {
	const seen = new Set<string>();
	const queue: string[] = [rootId];
	while (queue.length > 0) {
		const id = queue.shift();
		if (!id) continue;
		for (const src of incoming.get(id) ?? []) {
			if (!seen.has(src)) {
				seen.add(src);
				queue.push(src);
			}
		}
	}
	return seen;
}

function attachInheritedParameters(
	nodesById: Map<string, ResolvedNode>,
	edges: Edge[],
) {
	const incoming = new Map<string, string[]>();
	for (const e of edges) {
		const list = incoming.get(e.target) ?? [];
		list.push(e.source);
		incoming.set(e.target, list);
	}
	for (const node of nodesById.values()) {
		if (node.kind !== "sql-query") continue;
		const depIds = collectDeps(node.id, incoming);
		const ownNames = new Set(node.data.parameters.map((p) => p.name));
		const inheritedByName = new Map<string, { name: string; type?: string }>();
		for (const depId of depIds) {
			const dep = nodesById.get(depId);
			if (!dep || dep.kind !== "sql-query") continue;
			for (const p of dep.data.parameters) {
				if (ownNames.has(p.name) || inheritedByName.has(p.name)) continue;
				inheritedByName.set(p.name, p);
			}
		}
		node.data.inheritedParameters = Array.from(inheritedByName.values());
	}
}

const COL_WIDTH = 560;
const ROW_HEIGHT = 360;

function layoutGraph(
	nodesById: Map<string, ResolvedNode>,
	depthById: Map<string, number>,
	edges: Edge[],
): LineageGraph {
	const byDepth = new Map<number, string[]>();
	for (const [id, depth] of depthById) {
		const list = byDepth.get(depth) ?? [];
		list.push(id);
		byDepth.set(depth, list);
	}

	const nodes: Node<LineageNodeData>[] = [];
	for (const [depth, ids] of byDepth) {
		ids.forEach((id, i) => {
			const resolved = nodesById.get(id);
			if (!resolved) return;
			const x = -depth * COL_WIDTH;
			const y = (i - (ids.length - 1) / 2) * ROW_HEIGHT;
			nodes.push({
				id,
				type: resolved.kind,
				position: { x, y },
				data: resolved.data,
			});
		});
	}

	return { nodes, edges };
}

export function useLineageGraph(library: SQLLibrary): {
	graph: LineageGraph;
	isLoading: boolean;
} {
	const client = useAidboxClient();
	const canonicals = dependsOnCanonicals(library as RawLibrary);
	const { data, isLoading } = useQuery<LineageGraph>({
		queryKey: [
			"sqlquery-lineage-graph",
			library.id ?? null,
			library.url ?? null,
			canonicals,
		],
		queryFn: () => buildGraph(client, library),
		placeholderData: (prev) => prev,
	});
	return {
		graph: data ?? { nodes: [], edges: [] },
		isLoading,
	};
}
