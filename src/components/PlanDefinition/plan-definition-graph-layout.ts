import type {
	PlanDefinitionGraphEdge,
	PlanDefinitionRuleItem,
} from "./plan-definition-graph-model";

export const GRAPH_CARD_WIDTH = 320;
export const GRAPH_GAP = 24;
const PORT_GAP = 8;
const LANE_GAP = 20;

export type GraphPoint = { x: number; y: number };
/** Vertical position of a rule port, in layout coordinates. */
export type GraphAnchor = { y: number };
export type GraphSide = "left" | "right";
export type GraphItem = PlanDefinitionRuleItem & {
	anchor: string;
	height: number;
};
export type GraphForm = {
	key: string;
	index: number;
	y: number;
	height: number;
	headingHeight: number;
	anchor: string;
	message?: string;
	items: GraphItem[];
};
export type GraphRoute = {
	edge: PlanDefinitionGraphEdge;
	side: GraphSide;
	lane: number;
	laneX: number;
	sourceAnchor: string;
	targetAnchor: string;
	sourceOffset: number;
	targetOffset: number;
};

const anchorKey = (key: string, kind: "form" | "item", linkId?: string) =>
	JSON.stringify([key, kind, linkId]);

/** Rounded orthogonal paths stay outside the form column. */
export function graphEdgePath(
	source: GraphPoint,
	target: GraphPoint,
	laneX: number,
) {
	const direction = Math.sign(target.y - source.y) || 1;
	const side = Math.sign(laneX - source.x) || 1;
	const radius = Math.min(6, Math.abs(target.y - source.y) / 2);
	return `M ${source.x} ${source.y} H ${laneX - side * radius} Q ${laneX} ${source.y} ${laneX} ${source.y + direction * radius} V ${target.y - direction * radius} Q ${laneX} ${target.y} ${laneX - side * radius} ${target.y} H ${target.x}`;
}

type Interval = { top: number; bottom: number };
const overlaps = (a: Interval, b: Interval) =>
	a.top <= b.bottom && b.top <= a.bottom;
const crosses = (a: Interval, b: Interval) =>
	(a.top < b.top && b.top < a.bottom && a.bottom < b.bottom) ||
	(b.top < a.top && a.top < b.bottom && b.bottom < a.bottom);

function assignLanes(
	intervals: Array<Interval & { side?: GraphSide; lane: number }>,
) {
	for (const side of ["left", "right"] as const) {
		const assigned: typeof intervals = [];
		for (const edge of [...intervals]
			.reverse()
			.filter((edge) => edge.side === side)) {
			edge.lane =
				Math.max(
					-1,
					...assigned
						.filter((other) => overlaps(edge, other))
						.map((other) => other.lane),
				) + 1;
			assigned.push(edge);
		}
	}
}

/** Order defines the track; rule intervals determine sides, lanes, and ports. */
export function planDefinitionGraphLayout(
	keys: string[],
	items: PlanDefinitionRuleItem[][],
	connections: PlanDefinitionGraphEdge[],
	messages: Array<string | undefined> = [],
) {
	const endpoints = connections.map((edge) => ({
		edge,
		sourceAnchor: anchorKey(
			keys[edge.sourceIndex] ?? String(edge.sourceIndex),
			edge.sourceLinkId === undefined ? "form" : "item",
			edge.sourceLinkId,
		),
		targetAnchor:
			edge.targetLinkId === undefined
				? anchorKey(keys[edge.targetIndex] ?? String(edge.targetIndex), "form")
				: anchorKey(
						keys[edge.targetIndex] ?? String(edge.targetIndex),
						"item",
						edge.targetLinkId,
					),
	}));
	const counts = new Map<string, number>();
	for (const edge of endpoints)
		for (const key of [edge.sourceAnchor, edge.targetAnchor])
			counts.set(key, (counts.get(key) ?? 0) + 1);
	const anchors = new Map<string, GraphAnchor>();
	let y = 24;
	const forms: GraphForm[] = keys.map((key, index) => {
		const anchor = anchorKey(key, "form");
		const headingHeight = Math.max(
			56,
			((counts.get(anchor) ?? 0) + 1) * PORT_GAP,
		);
		anchors.set(anchor, { y: y + 1 + headingHeight / 2 });
		const message = messages[index];
		let offset = 1 + headingHeight;
		const formItems = items[index] ?? [];
		const hasBody = formItems.length > 0 || Boolean(message);
		if (hasBody) offset += 16;
		if (message) offset += 32;
		const rows = formItems.map((item, itemIndex) => {
			const anchor = anchorKey(key, "item", item.linkId);
			const height = Math.max(40, ((counts.get(anchor) ?? 0) + 1) * PORT_GAP);
			anchors.set(anchor, { y: y + offset + height / 2 });
			offset += height + (itemIndex < formItems.length - 1 ? 8 : 0);
			return { ...item, anchor, height };
		});
		const height = offset + (hasBody ? 16 : 0) + 1;
		const form = {
			key,
			index,
			y,
			height,
			headingHeight,
			anchor,
			message,
			items: rows,
		};
		y += height + GRAPH_GAP;
		return form;
	});
	const pending = endpoints.flatMap((endpoint) => {
		const source = anchors.get(endpoint.sourceAnchor);
		const target = anchors.get(endpoint.targetAnchor);
		if (!source || !target) return [];
		return [
			{
				...endpoint,
				top: Math.min(source.y, target.y),
				bottom: Math.max(source.y, target.y),
				source,
				target,
				side: undefined as GraphSide | undefined,
				lane: 0,
				sourceOffset: 0,
				targetOffset: 0,
			},
		];
	});
	type Pending = (typeof pending)[number];
	const cost = (candidate: Pending, side: GraphSide) => {
		const sameSide = pending.filter(
			(other) => other !== candidate && other.side === side,
		);
		return (
			sameSide.reduce(
				(sum, other) =>
					sum +
					(crosses(candidate, other) ? 100 : 0) +
					(overlaps(candidate, other) ? 2 : 0),
				0,
			) +
			sameSide.length * 0.05 +
			(side === (candidate.edge.kind === "condition" ? "right" : "left")
				? 0
				: 0.1)
		);
	};
	// Put interleaving intervals on opposite sides. Longer intervals get first choice.
	const longestFirst = [...pending].sort(
		(a, b) =>
			b.bottom - b.top - (a.bottom - a.top) ||
			a.edge.id.localeCompare(b.edge.id),
	);
	for (const edge of longestFirst)
		edge.side = cost(edge, "left") < cost(edge, "right") ? "left" : "right";
	for (let pass = 0; pass < 4; pass++) {
		let changed = false;
		for (const edge of longestFirst) {
			const other = edge.side === "left" ? "right" : "left";
			if (cost(edge, other) < cost(edge, edge.side ?? "right") - 0.001) {
				edge.side = other;
				changed = true;
			}
		}
		if (!changed) break;
	}
	// Nested intervals use outer lanes; disjoint intervals can reuse a lane.
	assignLanes(longestFirst);
	// Distinct ports prevent shared item sources and destinations from overpainting.
	const ports = new Map<
		string,
		Array<{
			edge: Pending;
			role: "source" | "target";
			otherY: number;
			y: number;
		}>
	>();
	for (const edge of pending) {
		for (const role of ["source", "target"] as const) {
			const key = JSON.stringify([edge[`${role}Anchor`], edge.side]);
			const group = ports.get(key) ?? [];
			group.push({
				edge,
				role,
				y: edge[role].y,
				otherY: edge[role === "source" ? "target" : "source"].y,
			});
			ports.set(key, group);
		}
	}
	for (const group of ports.values()) {
		group.sort((a, b) => {
			const aDown = a.otherY >= a.y;
			const bDown = b.otherY >= b.y;
			return (
				Number(aDown) - Number(bDown) ||
				(aDown ? b.edge.lane - a.edge.lane : a.edge.lane - b.edge.lane)
			);
		});
		group.forEach(({ edge, role }, index) => {
			edge[`${role}Offset`] = (index - (group.length - 1) / 2) * PORT_GAP;
		});
	}
	const gutter = Math.max(
		56,
		48 + Math.max(0, ...pending.map((edge) => edge.lane)) * LANE_GAP,
	);
	const routes: GraphRoute[] = pending.map((edge) => ({
		edge: edge.edge,
		side: edge.side ?? "right",
		lane: edge.lane,
		laneX:
			edge.side === "left"
				? gutter - 28 - edge.lane * LANE_GAP
				: gutter + GRAPH_CARD_WIDTH + 28 + edge.lane * LANE_GAP,
		sourceAnchor: edge.sourceAnchor,
		targetAnchor: edge.targetAnchor,
		sourceOffset: edge.sourceOffset,
		targetOffset: edge.targetOffset,
	}));
	return {
		forms,
		routes,
		gutter,
		width: GRAPH_CARD_WIDTH + gutter * 2,
		height: forms.length ? y - GRAPH_GAP + 24 : 0,
	};
}
