import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { ViewDefinition } from "@aidbox-ui/fhir-types/org-sql-on-fhir-ig";
import { useQuery } from "@tanstack/react-query";
import { type AidboxClientR5, useAidboxClient } from "../../../AidboxClient";
import type {
	ParamSpec,
	ResourceTypeNodeData,
	SQLQueryNodeData,
	ViewConstant,
	ViewDefinitionNodeData,
	ViewSelect,
} from "../../SQLQueryBuilder/lineage/types";
import type { SQLLibrary } from "../../SQLQueryBuilder/types";
import {
	SQL_QUERY_PROFILE,
	SQL_QUERY_TYPE_CODE,
	SQL_QUERY_TYPE_SYSTEM,
	sqlLibraryKind,
} from "../../SQLQueryBuilder/types";
import type {
	BackrefGraph,
	BackrefGraphState,
	BackrefNode,
	ExpandPlaceholderNodeData,
} from "./types";

const SQL_QUERY_TYPE_TOKEN = `${SQL_QUERY_TYPE_SYSTEM}|${SQL_QUERY_TYPE_CODE}`;

const COL_WIDTH = 560;
const ROW_HEIGHT = 360;
const PLACEHOLDER_X_OFFSET = 480;

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

function dependsOnCanonicals(lib: RawLibrary): string[] {
	return (lib.relatedArtifact ?? [])
		.filter((ra) => ra.type === "depends-on")
		.map((ra) => ra.resource ?? "")
		.filter(Boolean);
}

function splitCanonical(canonical: string): { url: string; version?: string } {
	const idx = canonical.indexOf("|");
	if (idx < 0) return { url: canonical };
	return { url: canonical.slice(0, idx), version: canonical.slice(idx + 1) };
}

async function fetchLibraryByCanonical(
	client: AidboxClientR5,
	canonical: string,
): Promise<RawLibrary | null> {
	const relative = canonical.match(/^Library\/([^/?#]+)$/);
	if (relative) {
		const result = await client.request<RawLibrary>({
			method: "GET",
			url: `/fhir/Library/${relative[1]}`,
		});
		if (result.isErr()) return null;
		return result.value.resource;
	}
	if (canonical.startsWith("ViewDefinition/")) return null;
	const { url, version } = splitCanonical(canonical);
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
	const lib = entry?.resource as RawLibrary | undefined;
	if (!lib || lib.resourceType !== "Library") return null;
	return lib;
}

async function resolveInheritedParameters(
	client: AidboxClientR5,
	rootLib: RawLibrary,
): Promise<ParamSpec[]> {
	const ownNames = new Set(
		(rootLib.parameter ?? [])
			.map((p) => p.name)
			.filter((n): n is string => Boolean(n)),
	);
	const collected = new Map<string, ParamSpec>();
	const visited = new Set<string>();

	let frontier = dependsOnCanonicals(rootLib);
	while (frontier.length > 0) {
		const toFetch = frontier.filter((c) => !visited.has(c));
		for (const c of toFetch) visited.add(c);
		const libs = await Promise.all(
			toFetch.map((c) => fetchLibraryByCanonical(client, c)),
		);
		const next: string[] = [];
		for (const lib of libs) {
			if (!lib) continue;
			for (const p of lib.parameter ?? []) {
				if (!p.name) continue;
				if (ownNames.has(p.name) || collected.has(p.name)) continue;
				collected.set(p.name, { name: p.name, type: p.type });
			}
			for (const c of dependsOnCanonicals(lib)) {
				if (!visited.has(c)) next.push(c);
			}
		}
		frontier = next;
	}

	return Array.from(collected.values());
}

function isSqlQueryLibrary(lib: RawLibrary): boolean {
	const profiles = lib.meta?.profile ?? [];
	if (profiles.includes(SQL_QUERY_PROFILE)) return true;
	const codings = lib.type?.coding ?? [];
	return codings.some(
		(c) =>
			c.code === "sql-query" &&
			(c.system === undefined ||
				c.system === "https://sql-on-fhir.org/ig/CodeSystem/LibraryTypesCodes"),
	);
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

function viewDefinitionNodeData(vd: RawViewDefinition): ViewDefinitionNodeData {
	return {
		kind: "view-definition",
		id: vd.id ?? "",
		canonical: vd.url ?? "",
		name: vd.name ?? "",
		title: vd.title,
		description: vd.description,
		resourceType: vd.resource,
		constants: normalizeConstants(vd),
		select: (vd.select ?? []).map(normalizeSelect),
		where: (vd.where ?? [])
			.filter((w): w is { path: string; description?: string } =>
				Boolean(w.path),
			)
			.map((w) => ({ path: w.path, description: w.description })),
	};
}

function decodeBase64(b64: string): string {
	try {
		return atob(b64);
	} catch {
		return "";
	}
}

function librarySql(lib: RawLibrary): string {
	const data = lib.content?.[0]?.data;
	return data ? decodeBase64(data) : "";
}

function sqlQueryNodeData(
	lib: RawLibrary,
	inheritedParameters: ParamSpec[] = [],
): SQLQueryNodeData {
	return {
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
		inheritedParameters,
		isRoot: false,
	};
}

function viewNodeId(vd: RawViewDefinition): string {
	return `view-definition:${vd.id ?? vd.url ?? "root"}`;
}

function queryNodeId(lib: RawLibrary): string {
	return `library:${lib.id ?? lib.url ?? Math.random().toString(36)}`;
}

function placeholderNodeId(queryId: string): string {
	return `expand:${queryId}`;
}

function buildBackrefSearchParams(target: {
	resourceType: "ViewDefinition" | "Library";
	id?: string;
	canonical?: string;
}): Array<Array<[string, string]>> {
	const variants: string[] = [];
	if (target.id) variants.push(`${target.resourceType}/${target.id}`);
	if (target.canonical) variants.push(target.canonical);
	const unique = Array.from(new Set(variants));
	return unique.map((value) => [
		["depends-on", value],
		["type", SQL_QUERY_TYPE_TOKEN],
		["_count", "100"],
	]);
}

async function fetchBackrefLibraries(
	client: AidboxClientR5,
	target: {
		resourceType: "ViewDefinition" | "Library";
		id?: string;
		canonical?: string;
	},
): Promise<RawLibrary[]> {
	const variantParams = buildBackrefSearchParams(target);
	if (variantParams.length === 0) return [];
	const results = await Promise.all(
		variantParams.map((params) =>
			client.request<Bundle>({
				method: "GET",
				url: "/fhir/Library",
				params,
			}),
		),
	);
	const byId = new Map<string, RawLibrary>();
	for (const result of results) {
		if (result.isErr()) continue;
		for (const entry of result.value.resource.entry ?? []) {
			const lib = entry.resource as RawLibrary | undefined;
			if (!lib || lib.resourceType !== "Library" || !lib.id) continue;
			if (!isSqlQueryLibrary(lib)) continue;
			byId.set(lib.id, lib);
		}
	}
	return Array.from(byId.values());
}

async function hasBackrefs(
	client: AidboxClientR5,
	target: {
		resourceType: "ViewDefinition" | "Library";
		id?: string;
		canonical?: string;
	},
): Promise<boolean> {
	const variants: string[] = [];
	if (target.id) variants.push(`${target.resourceType}/${target.id}`);
	if (target.canonical) variants.push(target.canonical);
	const unique = Array.from(new Set(variants));
	if (unique.length === 0) return false;
	const results = await Promise.all(
		unique.map((value) =>
			client.request<Bundle & { total?: number }>({
				method: "GET",
				url: "/fhir/Library",
				params: [
					["depends-on", value],
					["type", SQL_QUERY_TYPE_TOKEN],
					["_count", "1"],
					["_elements", "id"],
				],
			}),
		),
	);
	for (const r of results) {
		if (r.isErr()) continue;
		if ((r.value.resource.total ?? 0) > 0) return true;
		if ((r.value.resource.entry ?? []).length > 0) return true;
	}
	return false;
}

function rootViewNode(vd: RawViewDefinition): BackrefNode {
	const id = viewNodeId(vd);
	return {
		id,
		type: "view-definition",
		position: { x: 0, y: 0 },
		data: viewDefinitionNodeData(vd),
	};
}

function backrefQueryNode(
	lib: RawLibrary,
	inheritedParameters: ParamSpec[] = [],
): BackrefNode {
	const id = queryNodeId(lib);
	return {
		id,
		type: "sql-query",
		position: { x: 0, y: 0 },
		data: sqlQueryNodeData(lib, inheritedParameters),
	};
}

function resourceTypeNode(resourceType: string): BackrefNode {
	const data: ResourceTypeNodeData = {
		kind: "resource-type",
		resourceType,
	};
	return {
		id: `resource-type:${resourceType}`,
		type: "resource-type",
		position: { x: 0, y: 0 },
		data,
	};
}

function placeholderNode(queryNode: BackrefNode): BackrefNode {
	const id = placeholderNodeId(queryNode.id);
	const data: ExpandPlaceholderNodeData = {
		kind: "expand-placeholder",
		queryNodeId: queryNode.id,
	};
	return {
		id,
		type: "expand-placeholder",
		position: { x: 0, y: 0 },
		data,
	};
}

function addEdge(state: BackrefGraphState, source: string, target: string) {
	state.edges.push({ id: `${source}->${target}`, source, target });
}

function setDepth(state: BackrefGraphState, id: string, depth: number) {
	const prev = state.depthById.get(id);
	state.depthById.set(id, prev === undefined ? depth : Math.max(prev, depth));
}

function layoutGraph(state: BackrefGraphState): BackrefGraph {
	const byDepth = new Map<number, string[]>();
	const placeholderIds: string[] = [];
	for (const [id, depth] of state.depthById) {
		const node = state.nodesById.get(id);
		if (!node) continue;
		if (node.type === "expand-placeholder") {
			placeholderIds.push(id);
			continue;
		}
		const list = byDepth.get(depth) ?? [];
		list.push(id);
		byDepth.set(depth, list);
	}

	const positionedNodes: BackrefNode[] = [];
	const positionsById = new Map<string, { x: number; y: number }>();
	for (const [depth, ids] of byDepth) {
		ids.forEach((id, i) => {
			const node = state.nodesById.get(id);
			if (!node) return;
			const x = depth * COL_WIDTH;
			const y = (i - (ids.length - 1) / 2) * ROW_HEIGHT;
			const positioned: BackrefNode = { ...node, position: { x, y } };
			positionsById.set(id, { x, y });
			positionedNodes.push(positioned);
		});
	}

	for (const placeholderId of placeholderIds) {
		const node = state.nodesById.get(placeholderId);
		if (!node) continue;
		const data = node.data as ExpandPlaceholderNodeData;
		const targetPos = positionsById.get(data.queryNodeId);
		if (!targetPos) continue;
		positionedNodes.push({
			...node,
			position: {
				x: targetPos.x + PLACEHOLDER_X_OFFSET,
				y: targetPos.y,
			},
		});
	}

	return { nodes: positionedNodes, edges: state.edges };
}

async function attachPlaceholders(
	client: AidboxClientR5,
	state: BackrefGraphState,
	queries: { node: BackrefNode; lib: RawLibrary; depth: number }[],
): Promise<void> {
	if (queries.length === 0) return;
	const presence = await Promise.all(
		queries.map((q) =>
			hasBackrefs(client, {
				resourceType: "Library",
				id: q.lib.id,
				canonical: q.lib.url,
			}),
		),
	);
	queries.forEach((q, i) => {
		if (!presence[i]) return;
		const ph = placeholderNode(q.node);
		state.nodesById.set(ph.id, ph);
		setDepth(state, ph.id, q.depth + 1);
		addEdge(state, q.node.id, ph.id);
	});
}

function attachResourceType(state: BackrefGraphState, vd: RawViewDefinition) {
	if (!vd.resource) return;
	const rt = resourceTypeNode(vd.resource);
	if (!state.nodesById.has(rt.id)) state.nodesById.set(rt.id, rt);
	setDepth(state, rt.id, -1);
	const viewId = viewNodeId(vd);
	addEdge(state, rt.id, viewId);
}

async function buildInitialState(
	client: AidboxClientR5,
	view: RawViewDefinition,
): Promise<BackrefGraphState> {
	const root = rootViewNode(view);
	const state: BackrefGraphState = {
		rootId: root.id,
		nodesById: new Map([[root.id, root]]),
		depthById: new Map([[root.id, 0]]),
		edges: [],
	};

	attachResourceType(state, view);

	const libs = await fetchBackrefLibraries(client, {
		resourceType: "ViewDefinition",
		id: view.id,
		canonical: view.url,
	});

	const inheritedList = await Promise.all(
		libs.map((lib) => resolveInheritedParameters(client, lib)),
	);

	const placed: { node: BackrefNode; lib: RawLibrary; depth: number }[] = [];
	libs.forEach((lib, i) => {
		const node = backrefQueryNode(lib, inheritedList[i] ?? []);
		if (state.nodesById.has(node.id)) return;
		state.nodesById.set(node.id, node);
		setDepth(state, node.id, 1);
		addEdge(state, root.id, node.id);
		placed.push({ node, lib, depth: 1 });
	});

	await attachPlaceholders(client, state, placed);
	return state;
}

export async function expandQueryNode(
	client: AidboxClientR5,
	state: BackrefGraphState,
	queryNodeId: string,
): Promise<BackrefGraphState> {
	const queryNode = state.nodesById.get(queryNodeId);
	if (!queryNode || queryNode.type !== "sql-query") return state;
	const queryDepth = state.depthById.get(queryNodeId) ?? 1;
	const data = queryNode.data as SQLQueryNodeData;

	const placeholderId = placeholderNodeId(queryNodeId);
	if (state.nodesById.has(placeholderId)) {
		state.nodesById.delete(placeholderId);
		state.depthById.delete(placeholderId);
	}
	state.edges = state.edges.filter(
		(e) => e.source !== placeholderId && e.target !== placeholderId,
	);

	const libs = await fetchBackrefLibraries(client, {
		resourceType: "Library",
		id: data.id,
		canonical: data.canonical,
	});

	const inheritedList = await Promise.all(
		libs.map((lib) => resolveInheritedParameters(client, lib)),
	);

	const placed: { node: BackrefNode; lib: RawLibrary; depth: number }[] = [];
	libs.forEach((lib, i) => {
		const node = backrefQueryNode(lib, inheritedList[i] ?? []);
		if (node.id === queryNodeId || state.nodesById.has(node.id)) {
			if (!state.edges.some((e) => e.id === `${queryNodeId}->${node.id}`)) {
				addEdge(state, queryNodeId, node.id);
			}
			return;
		}
		state.nodesById.set(node.id, node);
		setDepth(state, node.id, queryDepth + 1);
		addEdge(state, queryNodeId, node.id);
		placed.push({ node, lib, depth: queryDepth + 1 });
	});

	await attachPlaceholders(client, state, placed);
	return state;
}

export function stateToGraph(state: BackrefGraphState): BackrefGraph {
	return layoutGraph(state);
}

export function useViewDefinitionLineageGraph(
	view: ViewDefinition | undefined,
): {
	state: BackrefGraphState | null;
	graph: BackrefGraph;
	isLoading: boolean;
} {
	const client = useAidboxClient();
	const raw = view as unknown as RawViewDefinition | undefined;
	const { data, isLoading } = useQuery<BackrefGraphState>({
		enabled: Boolean(raw?.id || raw?.url),
		queryKey: [
			"view-definition-lineage-state",
			raw?.id ?? null,
			raw?.url ?? null,
		],
		queryFn: () => {
			if (!raw) throw new Error("view is required");
			return buildInitialState(client, raw);
		},
		placeholderData: (prev) => prev,
		staleTime: Number.POSITIVE_INFINITY,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		refetchOnMount: false,
	});
	return {
		state: data ?? null,
		graph: data ? layoutGraph(data) : { nodes: [], edges: [] },
		isLoading,
	};
}
