import type { PlanDefinitionGraphEdge } from "./plan-definition-graph-model";

export type GraphEdgeVisibility = Record<
	PlanDefinitionGraphEdge["kind"],
	boolean
>;

export const GRAPH_MIN_ZOOM = 0.05;
export const GRAPH_MAX_ZOOM = 2;

export type GraphViewportState = {
	x: number;
	y: number;
	k: number;
};

type PlanDefinitionGraphState = {
	edges: GraphEdgeVisibility;
	viewport?: GraphViewportState;
};

export function readPlanDefinitionGraphState(
	key?: string,
): PlanDefinitionGraphState {
	const fallback = { edges: { condition: true, prefill: true } };
	if (!key) return fallback;
	try {
		const stored = JSON.parse(
			localStorage.getItem(key) ?? "null",
		) as Partial<PlanDefinitionGraphState> | null;
		const viewport = stored?.viewport;
		return {
			edges: {
				condition:
					typeof stored?.edges?.condition === "boolean"
						? stored.edges.condition
						: true,
				prefill:
					typeof stored?.edges?.prefill === "boolean"
						? stored.edges.prefill
						: true,
			},
			viewport:
				viewport &&
				[viewport.x, viewport.y, viewport.k].every(Number.isFinite) &&
				viewport.k >= GRAPH_MIN_ZOOM &&
				viewport.k <= GRAPH_MAX_ZOOM
					? { x: viewport.x, y: viewport.y, k: viewport.k }
					: undefined,
		};
	} catch {
		return fallback;
	}
}

export function writePlanDefinitionGraphState(
	key: string | undefined,
	state: PlanDefinitionGraphState,
) {
	if (!key) return;
	try {
		localStorage.setItem(key, JSON.stringify(state));
	} catch {
		// Keep graph interactions available when browser storage is unavailable.
	}
}
