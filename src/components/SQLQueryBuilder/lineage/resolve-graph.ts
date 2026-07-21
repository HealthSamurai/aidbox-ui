import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { useQuery } from "@tanstack/react-query";
import type { Edge, Node } from "@xyflow/react";
import { type AidboxClientR5, useAidboxClient } from "../../../AidboxClient";
import { type SQLLibrary, sqlLibraryKind } from "../types";
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
			libraryKind: sqlLibraryKind(lib),
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
			libraryKind: sqlLibraryKind(lib),
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

// Horizontal spacing between columns.
const COL_WIDTH = 560;
// Vertical gap kept between neighbouring sibling subtrees in the SQL tree.
const SUBTREE_GAP = 56;
// Vertical gap between nodes stacked in the fixed resource / view columns.
const COLUMN_V_GAP = 40;

// Fixed left-hand columns: resource tables, then view definitions. Everything
// to the right of them is the SQL dependency tree.
const RESOURCE_COL_X = 0;
const VIEW_COL_X = COL_WIDTH;
const SQL_COL_START = COL_WIDTH * 2;

// Approximate rendered heights (px) of node chrome, used to reserve enough
// vertical room per node so that tall nodes don't overlap their siblings.
const HEADER_H = 61;
const ROW_H = 25;
const FOOTER_H = 29;
const EMPTY_BODY_H = 32;

function countViewColumns(selects: ViewSelect[]): number {
	let total = 0;
	const walk = (list: ViewSelect[]) => {
		for (const s of list) {
			total += (s.column ?? []).length;
			if (s.select) walk(s.select);
			if (s.unionAll) walk(s.unionAll);
		}
	};
	walk(selects);
	return total;
}

function estimateNodeHeight(node: ResolvedNode): number {
	if (node.kind === "resource-type") return HEADER_H;
	if (node.kind === "view-definition") {
		const cols = countViewColumns(node.data.select);
		return HEADER_H + (cols > 0 ? cols * ROW_H : EMPTY_BODY_H) + FOOTER_H;
	}
	const d = node.data;
	if (d.libraryKind === "sql-view") return HEADER_H + FOOTER_H;
	const own = new Set(d.parameters.map((p) => p.name));
	const paramCount =
		d.parameters.length +
		d.inheritedParameters.filter((p) => !own.has(p.name)).length;
	return (
		HEADER_H + (paramCount > 0 ? paramCount * ROW_H : EMPTY_BODY_H) + FOOTER_H
	);
}

// Reduce the SQL sub-graph to a spanning tree: every SQL node keeps a single
// parent — the consuming SQL node closest to the root.
function buildSqlParentOf(
	edges: Edge[],
	depthById: Map<string, number>,
	kindById: Map<string, LineageNodeData["kind"]>,
): Map<string, string> {
	const parentOf = new Map<string, string>();
	for (const e of edges) {
		if (
			kindById.get(e.source) !== "sql-query" ||
			kindById.get(e.target) !== "sql-query"
		) {
			continue;
		}
		// edge: source (dependency) → target (consumer / closer to root)
		const current = parentOf.get(e.source);
		if (current === undefined) {
			parentOf.set(e.source, e.target);
			continue;
		}
		const curDepth = depthById.get(current) ?? 0;
		const newDepth = depthById.get(e.target) ?? 0;
		if (newDepth < curDepth) parentOf.set(e.source, e.target);
	}
	return parentOf;
}

function childrenFromParents(
	parentOf: Map<string, string>,
): Map<string, string[]> {
	const treeChildren = new Map<string, string[]>();
	for (const [child, parent] of parentOf) {
		const list = treeChildren.get(parent) ?? [];
		list.push(child);
		treeChildren.set(parent, list);
	}
	return treeChildren;
}

// Vertical extent of a subtree = max of the node's own height and the stacked
// height of all its children (so a tall node still reserves room).
function subtreeHeight(
	id: string,
	treeChildren: Map<string, string[]>,
	heightById: Map<string, number>,
	cache: Map<string, number>,
): number {
	const cached = cache.get(id);
	if (cached !== undefined) return cached;
	const own = heightById.get(id) ?? EMPTY_BODY_H;
	const children = treeChildren.get(id);
	if (!children || children.length === 0) {
		cache.set(id, own);
		return own;
	}
	let total = SUBTREE_GAP * (children.length - 1);
	for (const c of children) {
		total += subtreeHeight(c, treeChildren, heightById, cache);
	}
	const height = Math.max(own, total);
	cache.set(id, height);
	return height;
}

// Assign the vertical centre of each node so a parent sits centred on the band
// occupied by its children.
function placeSubtree(
	id: string,
	top: number,
	treeChildren: Map<string, string[]>,
	heightById: Map<string, number>,
	cache: Map<string, number>,
	centerYById: Map<string, number>,
): void {
	const band = subtreeHeight(id, treeChildren, heightById, cache);
	centerYById.set(id, top + band / 2);

	const children = treeChildren.get(id);
	if (!children || children.length === 0) return;
	let childrenTotal = SUBTREE_GAP * (children.length - 1);
	for (const c of children) {
		childrenTotal += subtreeHeight(c, treeChildren, heightById, cache);
	}
	let cursor = top + (band - childrenTotal) / 2;
	for (const c of children) {
		placeSubtree(c, cursor, treeChildren, heightById, cache, centerYById);
		cursor += subtreeHeight(c, treeChildren, heightById, cache) + SUBTREE_GAP;
	}
}

function centerAroundZero(
	centerYById: Map<string, number>,
	ids: string[],
): void {
	let min = Number.POSITIVE_INFINITY;
	let max = Number.NEGATIVE_INFINITY;
	for (const id of ids) {
		const y = centerYById.get(id);
		if (y === undefined) continue;
		if (y < min) min = y;
		if (y > max) max = y;
	}
	if (min === Number.POSITIVE_INFINITY) return;
	const mid = (min + max) / 2;
	for (const id of ids) {
		const y = centerYById.get(id);
		if (y !== undefined) centerYById.set(id, y - mid);
	}
}

// Stack nodes into a single vertical column centred around y = 0.
function stackColumn(
	ids: string[],
	heightById: Map<string, number>,
	gap: number,
): Map<string, number> {
	let total = gap * Math.max(0, ids.length - 1);
	for (const id of ids) total += heightById.get(id) ?? EMPTY_BODY_H;
	const centerYById = new Map<string, number>();
	let cursor = -total / 2;
	for (const id of ids) {
		const h = heightById.get(id) ?? EMPTY_BODY_H;
		centerYById.set(id, cursor + h / 2);
		cursor += h + gap;
	}
	return centerYById;
}

function buildOutgoing(edges: Edge[]): Map<string, string[]> {
	const outgoing = new Map<string, string[]>();
	for (const e of edges) {
		const list = outgoing.get(e.source) ?? [];
		list.push(e.target);
		outgoing.set(e.source, list);
	}
	return outgoing;
}

// Average vertical position of the consumers (edge targets) of a node, used to
// order the fixed columns so their nodes follow the nodes that reference them.
function averageConsumerY(
	id: string,
	outgoing: Map<string, string[]>,
	consumerYById: Map<string, number>,
): number {
	const consumers = outgoing.get(id);
	if (!consumers || consumers.length === 0) return 0;
	let sum = 0;
	let count = 0;
	for (const c of consumers) {
		const y = consumerYById.get(c);
		if (y === undefined) continue;
		sum += y;
		count += 1;
	}
	return count === 0 ? 0 : sum / count;
}

// Place each node opposite the consumers that reference it: its centre is the
// average Y of those consumers, then overlaps are resolved by nudging the lower
// node down so the alignment is preserved as closely as possible.
function placeAgainstConsumers(
	ids: string[],
	outgoing: Map<string, string[]>,
	consumerYById: Map<string, number>,
	heightById: Map<string, number>,
	gap: number,
): Map<string, number> {
	const desired = ids
		.map((id) => ({ id, y: averageConsumerY(id, outgoing, consumerYById) }))
		.sort((a, b) => a.y - b.y);
	const centerYById = new Map<string, number>();
	let prevBottom = Number.NEGATIVE_INFINITY;
	for (const { id, y } of desired) {
		const h = heightById.get(id) ?? EMPTY_BODY_H;
		const center = Math.max(y, prevBottom + gap + h / 2);
		centerYById.set(id, center);
		prevBottom = center + h / 2;
	}
	return centerYById;
}

function nodePlacement(
	id: string,
	kind: LineageNodeData["kind"],
	depthById: Map<string, number>,
	maxSqlDepth: number,
	columnYById: {
		sql: Map<string, number>;
		view: Map<string, number>;
		resource: Map<string, number>;
	},
): { x: number; centerY: number } {
	if (kind === "resource-type") {
		return { x: RESOURCE_COL_X, centerY: columnYById.resource.get(id) ?? 0 };
	}
	if (kind === "view-definition") {
		return { x: VIEW_COL_X, centerY: columnYById.view.get(id) ?? 0 };
	}
	// SQL nodes: rank increases towards the root, so the root sits furthest right.
	const rank = maxSqlDepth - (depthById.get(id) ?? 0);
	return {
		x: SQL_COL_START + rank * COL_WIDTH,
		centerY: columnYById.sql.get(id) ?? 0,
	};
}

function layoutGraph(
	nodesById: Map<string, ResolvedNode>,
	depthById: Map<string, number>,
	edges: Edge[],
): LineageGraph {
	const heightById = new Map<string, number>();
	const kindById = new Map<string, LineageNodeData["kind"]>();
	const sqlIds: string[] = [];
	const viewIds: string[] = [];
	const resourceIds: string[] = [];
	for (const [id, resolved] of nodesById) {
		heightById.set(id, estimateNodeHeight(resolved));
		kindById.set(id, resolved.kind);
		if (resolved.kind === "sql-query") sqlIds.push(id);
		else if (resolved.kind === "view-definition") viewIds.push(id);
		else resourceIds.push(id);
	}

	// SQL nodes form a tidy tree growing rightwards, root furthest right.
	const sqlParentOf = buildSqlParentOf(edges, depthById, kindById);
	const sqlChildren = childrenFromParents(sqlParentOf);
	const cache = new Map<string, number>();
	const sqlCenterY = new Map<string, number>();
	let sqlTop = 0;
	for (const id of sqlIds) {
		if (sqlParentOf.has(id)) continue;
		placeSubtree(id, sqlTop, sqlChildren, heightById, cache, sqlCenterY);
		sqlTop += subtreeHeight(id, sqlChildren, heightById, cache) + SUBTREE_GAP;
	}
	centerAroundZero(sqlCenterY, sqlIds);

	let maxSqlDepth = 0;
	for (const id of sqlIds) {
		maxSqlDepth = Math.max(maxSqlDepth, depthById.get(id) ?? 0);
	}

	// Views and resources: single vertical columns, ordered to follow the nodes
	// that consume them so the connecting edges stay readable.
	const outgoing = buildOutgoing(edges);
	const orderedViews = [...viewIds].sort(
		(a, b) =>
			averageConsumerY(a, outgoing, sqlCenterY) -
			averageConsumerY(b, outgoing, sqlCenterY),
	);
	const viewCenterY = stackColumn(orderedViews, heightById, COLUMN_V_GAP);
	// Draw each resource table opposite the view definition(s) that reference it.
	const resourceCenterY = placeAgainstConsumers(
		resourceIds,
		outgoing,
		viewCenterY,
		heightById,
		COLUMN_V_GAP,
	);

	const columnYById = {
		sql: sqlCenterY,
		view: viewCenterY,
		resource: resourceCenterY,
	};
	const nodes: Node<LineageNodeData>[] = [];
	for (const [id, resolved] of nodesById) {
		const height = heightById.get(id) ?? EMPTY_BODY_H;
		const { x, centerY } = nodePlacement(
			id,
			resolved.kind,
			depthById,
			maxSqlDepth,
			columnYById,
		);
		nodes.push({
			id,
			type: resolved.kind,
			position: { x, y: centerY - height / 2 },
			data: resolved.data,
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
