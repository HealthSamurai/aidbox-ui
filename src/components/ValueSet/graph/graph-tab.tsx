import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useMutation } from "@tanstack/react-query";
import {
	Background,
	Controls,
	type Edge,
	MarkerType,
	type Node,
	ReactFlow,
	useEdgesState,
	useNodesState,
} from "@xyflow/react";
import { PanelBottomOpen } from "lucide-react";
import * as React from "react";
import { type AidboxClientR5, useAidboxClient } from "../../../AidboxClient";
import { useLocalStorage } from "../../../hooks";
import { cleanEmptyValues } from "../../../utils/clean-empty-values";
import { EmptyState } from "../../empty-state";
import { useValueSetContext } from "../context";
import type { ValueSet } from "../types";
import { GraphDetailPanel } from "./detail-panel";
import { ExpandResultPanel } from "./expand-result-panel";
import { nodeTypes } from "./nodes";
import { useValueSetGraph } from "./resolve-graph";
import {
	type ConceptRow,
	GraphRunContext,
	type GraphRunContextValue,
	type GraphRunResult,
	type RunTarget,
} from "./run-context";
import type { GraphEdgeData, GraphNodeData } from "./types";

import "@xyflow/react/dist/style.css";

type FlowNode = Node<GraphNodeData>;
type FlowEdge = Edge<GraphEdgeData>;

const DIM_COLOR = "#d4d4d8";

const EDGE_COLORS: Record<string, string> = {
	include: "#52c41a",
	exclude: "#ff4d4f",
	supplements: "#722ed1",
};

const EDGE_LABELS: Record<string, string> = {
	include: "include",
	exclude: "exclude",
	supplements: "supplements",
};

const DEFAULT_RESULT_HEIGHT = 320;
const MIN_RESULT_HEIGHT = 120;
const MAX_RESULT_HEIGHT = 800;

const DEFAULT_DETAILS_WIDTH = 440;
const MIN_DETAILS_WIDTH = 280;
const MAX_DETAILS_WIDTH = 800;

function collectConnectedEdges(edges: FlowEdge[], rootId: string): Set<string> {
	const bySource = new Map<string, FlowEdge[]>();
	const byTarget = new Map<string, FlowEdge[]>();
	for (const e of edges) {
		const s = bySource.get(e.source) ?? [];
		s.push(e);
		bySource.set(e.source, s);
		const t = byTarget.get(e.target) ?? [];
		t.push(e);
		byTarget.set(e.target, t);
	}
	const result = new Set<string>();

	const seenDown = new Set<string>();
	const dQ: string[] = [rootId];
	while (dQ.length > 0) {
		const id = dQ.shift();
		if (!id || seenDown.has(id)) continue;
		seenDown.add(id);
		for (const e of bySource.get(id) ?? []) {
			result.add(e.id);
			dQ.push(e.target);
		}
	}

	const seenUp = new Set<string>();
	const uQ: string[] = [rootId];
	while (uQ.length > 0) {
		const id = uQ.shift();
		if (!id || seenUp.has(id)) continue;
		seenUp.add(id);
		for (const e of byTarget.get(id) ?? []) {
			result.add(e.id);
			uQ.push(e.source);
		}
	}
	return result;
}

function defaultEdgeColor(edge: FlowEdge): string {
	const kind = edge.data?.edgeKind;
	if (kind && EDGE_COLORS[kind]) return EDGE_COLORS[kind] as string;
	return DIM_COLOR;
}

function toOperationOutcome(err: unknown): HSComp.OperationOutcome {
	if (
		typeof err === "object" &&
		err !== null &&
		"resourceType" in err &&
		(err as { resourceType: string }).resourceType === "OperationOutcome"
	) {
		return err as unknown as HSComp.OperationOutcome;
	}
	return {
		resourceType: "OperationOutcome",
		issue: [
			{
				severity: "error",
				code: "exception",
				diagnostics: err instanceof Error ? err.message : String(err),
			},
		],
	};
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

type RawCodeSystem = {
	resourceType: "CodeSystem";
	id?: string;
	concept?: RawConcept[];
};

type RawConcept = {
	code?: string;
	display?: string;
	definition?: string;
	concept?: RawConcept[];
};

async function fetchCodeSystem(
	client: AidboxClientR5,
	target: { csId?: string; url?: string; version?: string },
): Promise<RawCodeSystem> {
	if (target.csId) {
		const r = await client.request<RawCodeSystem>({
			method: "GET",
			url: `/fhir/CodeSystem/${target.csId}`,
		});
		if (r.isErr()) throw r.value.resource;
		return r.value.resource;
	}
	if (!target.url) {
		throw {
			resourceType: "OperationOutcome",
			issue: [
				{
					severity: "error",
					code: "invalid",
					diagnostics: "CodeSystem has no ID or canonical URL",
				},
			],
		};
	}
	const params: Array<[string, string]> = [
		["url", target.url],
		["_count", "1"],
		["_sort", "-_lastUpdated"],
	];
	if (target.version) params.push(["version", target.version]);
	const r = await client.request<Bundle>({
		method: "GET",
		url: "/fhir/CodeSystem",
		params,
	});
	if (r.isErr()) throw r.value.resource;
	const entry = r.value.resource.entry?.[0];
	const cs = entry?.resource as RawCodeSystem | undefined;
	if (!cs) {
		throw {
			resourceType: "OperationOutcome",
			issue: [
				{
					severity: "error",
					code: "not-found",
					diagnostics: `CodeSystem ${target.url} not found`,
				},
			],
		};
	}
	return cs;
}

function flattenConcepts(
	concepts: RawConcept[] | undefined,
	depth = 0,
	parent?: string,
): ConceptRow[] {
	if (!concepts) return [];
	const out: ConceptRow[] = [];
	for (const c of concepts) {
		if (!c.code) continue;
		out.push({
			code: c.code,
			display: c.display,
			definition: c.definition,
			parent,
			depth,
		});
		if (c.concept && c.concept.length > 0) {
			out.push(...flattenConcepts(c.concept, depth + 1, c.code));
		}
	}
	return out;
}

export function ValueSetGraphTab() {
	const client = useAidboxClient();
	const { valueSet } = useValueSetContext();
	const { graph, isLoading } = useValueSetGraph(valueSet);

	const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(graph.nodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>(graph.edges);
	const [selectedId, setSelectedId] = React.useState<string | null>(null);

	const [runningNodeId, setRunningNodeId] = React.useState<string | null>(null);
	const [resultNodeId, setResultNodeId] = React.useState<string | null>(null);
	const [result, setResult] = React.useState<GraphRunResult | null>(null);
	const [error, setError] = React.useState<HSComp.OperationOutcome | null>(
		null,
	);

	const [isResultCollapsed, setIsResultCollapsed] = React.useState(false);
	const [isMaximized, setIsMaximized] = React.useState(false);

	const [resultHeight, setResultHeight] = useLocalStorage<number>({
		key: "valueset-graph:result-height",
		defaultValue: DEFAULT_RESULT_HEIGHT,
		getInitialValueInEffect: false,
	});
	const resultHeightRef = React.useRef(resultHeight);
	resultHeightRef.current = resultHeight;

	const [detailsWidth, setDetailsWidth] = useLocalStorage<number>({
		key: "valueset-graph:details-width",
		defaultValue: DEFAULT_DETAILS_WIDTH,
		getInitialValueInEffect: false,
	});
	const detailsWidthRef = React.useRef(detailsWidth);
	detailsWidthRef.current = detailsWidth;

	const valueSetRef = React.useRef<ValueSet>(valueSet);
	valueSetRef.current = valueSet;

	React.useEffect(() => {
		setNodes(graph.nodes);
		setEdges(graph.edges);
	}, [graph.nodes, graph.edges, setNodes, setEdges]);

	const runStartRef = React.useRef<number>(0);

	const runMutation = useMutation({
		mutationFn: async (target: RunTarget): Promise<GraphRunResult> => {
			setRunningNodeId(target.nodeId);
			setResultNodeId(target.nodeId);
			setError(null);
			setResult(null);
			runStartRef.current = performance.now();
			if (target.kind === "expand") {
				if (target.isRoot) {
					const body = {
						resourceType: "Parameters" as const,
						parameter: [
							{
								name: "valueSet",
								resource: cleanEmptyValues(valueSetRef.current),
							},
						],
					};
					const r = await client.request<ValueSet>({
						method: "POST",
						url: "/fhir/ValueSet/$expand",
						body: JSON.stringify(body),
						headers: { "Content-Type": "application/fhir+json" },
					});
					if (r.isErr()) throw r.value.resource;
					return {
						kind: "expand",
						contains: r.value.resource.expansion?.contains ?? [],
						total: r.value.resource.expansion?.total,
						durationMs: performance.now() - runStartRef.current,
					};
				}
				if (!target.url) {
					throw {
						resourceType: "OperationOutcome",
						issue: [
							{
								severity: "error",
								code: "invalid",
								diagnostics: "ValueSet has no canonical URL",
							},
						],
					};
				}
				const params: Array<[string, string]> = [["url", target.url]];
				if (target.version) params.push(["valueSetVersion", target.version]);
				const r = await client.request<ValueSet>({
					method: "GET",
					url: "/fhir/ValueSet/$expand",
					params,
				});
				if (r.isErr()) throw r.value.resource;
				return {
					kind: "expand",
					contains: r.value.resource.expansion?.contains ?? [],
					total: r.value.resource.expansion?.total,
					durationMs: performance.now() - runStartRef.current,
				};
			}
			const cs = await fetchCodeSystem(client, target);
			return {
				kind: "content",
				rows: flattenConcepts(cs.concept),
				durationMs: performance.now() - runStartRef.current,
			};
		},
		onSuccess: (res) => {
			setRunningNodeId(null);
			setResult(res);
		},
		onError: (err) => {
			setRunningNodeId(null);
			setError(toOperationOutcome(err));
		},
	});

	const run = React.useCallback(
		(target: RunTarget) => {
			if (runMutation.isPending) return;
			setIsResultCollapsed(false);
			setIsMaximized(false);
			runMutation.mutate(target);
		},
		[runMutation],
	);

	const runContextValue = React.useMemo<GraphRunContextValue>(
		() => ({
			runningNodeId,
			resultNodeId,
			result,
			error,
			run,
		}),
		[runningNodeId, resultNodeId, result, error, run],
	);

	const styledEdges = React.useMemo<FlowEdge[]>(() => {
		const baseProps = { type: "default" as const };
		if (!selectedId) {
			return edges.map((e) => {
				const color = defaultEdgeColor(e);
				return {
					...e,
					...baseProps,
					style: { stroke: color, strokeWidth: 1.5 },
					markerEnd: { type: MarkerType.ArrowClosed, color },
				};
			});
		}
		const highlighted = collectConnectedEdges(edges, selectedId);
		return edges.map((e) => {
			const on = highlighted.has(e.id);
			const color = on ? defaultEdgeColor(e) : DIM_COLOR;
			return {
				...e,
				...baseProps,
				style: {
					stroke: on ? color : DIM_COLOR,
					strokeWidth: on ? 2 : 1,
				},
				markerEnd: {
					type: MarkerType.ArrowClosed,
					color: on ? color : DIM_COLOR,
				},
				animated: on,
			};
		});
	}, [edges, selectedId]);

	const presentKinds = React.useMemo(() => {
		const set = new Set<string>();
		for (const e of edges) {
			const k = e.data?.edgeKind;
			if (k) set.add(k);
		}
		return Array.from(set);
	}, [edges]);

	const clearSelection = React.useCallback(() => {
		setSelectedId(null);
		setNodes((nds) =>
			nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
		);
	}, [setNodes]);

	const handleToggleMaximize = React.useCallback(() => {
		setIsMaximized((p) => !p);
	}, []);

	const handleToggleCollapse = React.useCallback(() => {
		setIsResultCollapsed(true);
		setIsMaximized(false);
	}, []);

	const handleClose = React.useCallback(() => {
		setResultNodeId(null);
		setResult(null);
		setError(null);
		setIsResultCollapsed(false);
		setIsMaximized(false);
	}, []);

	React.useEffect(() => {
		if (!isMaximized) return;
		const onEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") setIsMaximized(false);
		};
		document.addEventListener("keydown", onEscape);
		return () => document.removeEventListener("keydown", onEscape);
	}, [isMaximized]);

	const startResize = React.useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			const startY = e.clientY;
			const startH = resultHeightRef.current;
			const prevUserSelect = document.body.style.userSelect;
			const prevCursor = document.body.style.cursor;
			document.body.style.userSelect = "none";
			document.body.style.cursor = "row-resize";
			const onMove = (ev: MouseEvent) => {
				const delta = startY - ev.clientY;
				setResultHeight(
					clamp(startH + delta, MIN_RESULT_HEIGHT, MAX_RESULT_HEIGHT),
				);
			};
			const onUp = () => {
				document.body.style.userSelect = prevUserSelect;
				document.body.style.cursor = prevCursor;
				document.removeEventListener("mousemove", onMove);
				document.removeEventListener("mouseup", onUp);
			};
			document.addEventListener("mousemove", onMove);
			document.addEventListener("mouseup", onUp);
		},
		[setResultHeight],
	);

	const startResizeDetails = React.useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			const startX = e.clientX;
			const startW = detailsWidthRef.current;
			const prevUserSelect = document.body.style.userSelect;
			const prevCursor = document.body.style.cursor;
			document.body.style.userSelect = "none";
			document.body.style.cursor = "col-resize";
			const onMove = (ev: MouseEvent) => {
				const delta = startX - ev.clientX;
				setDetailsWidth(
					clamp(startW + delta, MIN_DETAILS_WIDTH, MAX_DETAILS_WIDTH),
				);
			};
			const onUp = () => {
				document.body.style.userSelect = prevUserSelect;
				document.body.style.cursor = prevCursor;
				document.removeEventListener("mousemove", onMove);
				document.removeEventListener("mouseup", onUp);
			};
			document.addEventListener("mousemove", onMove);
			document.addEventListener("mouseup", onUp);
		},
		[setDetailsWidth],
	);

	if (isLoading && nodes.length === 0) {
		return (
			<div className="flex items-center justify-center h-full w-full text-text-secondary">
				Resolving graph…
			</div>
		);
	}

	if (nodes.length === 0) {
		return (
			<EmptyState
				title="No graph"
				description="This ValueSet has no compose.include / exclude references yet."
			/>
		);
	}

	const selectedData =
		(nodes.find((n) => n.id === selectedId)?.data as
			| GraphNodeData
			| undefined) ?? null;
	const detailsOpen = selectedData !== null;

	const hasResult = resultNodeId !== null;
	const showResult = hasResult && !isResultCollapsed;
	const showResultBar = hasResult && isResultCollapsed && !isMaximized;

	return (
		<GraphRunContext.Provider value={runContextValue}>
			<div className="relative h-full w-full overflow-hidden">
				<div className="absolute inset-0 bg-bg-primary">
					<ReactFlow<FlowNode, FlowEdge>
						nodes={nodes}
						edges={styledEdges}
						onNodesChange={onNodesChange}
						onEdgesChange={onEdgesChange}
						onNodeClick={(_, node) => setSelectedId(node.id)}
						onPaneClick={clearSelection}
						nodeTypes={nodeTypes}
						nodesDraggable={false}
						nodesConnectable={false}
						fitView
						fitViewOptions={{ padding: 0.2 }}
						defaultEdgeOptions={{
							type: "default",
							markerEnd: { type: MarkerType.ArrowClosed },
						}}
						minZoom={0.2}
						proOptions={{ hideAttribution: true }}
					>
						<Background />
						<Controls showFitView={false} />
					</ReactFlow>
				</div>

				{presentKinds.length > 0 && (
					<div className="absolute top-2 right-2 z-10 rounded-md bg-bg-primary border border-border-primary shadow-sm px-2 py-1.5 flex flex-col gap-1">
						<span className="typo-label-tiny text-text-tertiary uppercase">
							Edges
						</span>
						<div className="flex flex-col gap-0.5">
							{presentKinds.map((k) => (
								<div key={k} className="flex items-center gap-2">
									<span
										className="inline-block w-4 h-0.5 rounded-sm"
										style={{ backgroundColor: EDGE_COLORS[k] ?? DIM_COLOR }}
									/>
									<span className="text-xs text-text-primary">
										{EDGE_LABELS[k] ?? k}
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				{detailsOpen && (
					<div
						className="absolute top-0 right-0 bottom-0 z-20 bg-bg-primary border-l border-border-primary shadow-lg"
						style={{ width: detailsWidth }}
					>
						<button
							type="button"
							aria-label="Resize details panel"
							className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-border-link/60 z-10 -translate-x-1/2 bg-transparent border-0 p-0"
							onMouseDown={startResizeDetails}
							style={{ touchAction: "none" }}
						/>
						<GraphDetailPanel data={selectedData} onClose={clearSelection} />
					</div>
				)}

				{showResult && (
					<div
						className={
							isMaximized
								? "absolute inset-0 z-30 bg-bg-primary"
								: "absolute bottom-0 left-0 z-20 bg-bg-primary border-t border-border-primary shadow-lg"
						}
						style={
							isMaximized
								? undefined
								: {
										height: resultHeight,
										right: detailsOpen ? detailsWidth : 0,
									}
						}
					>
						{!isMaximized && (
							<button
								type="button"
								aria-label="Resize result panel"
								className="absolute left-0 right-0 top-0 h-1 cursor-row-resize hover:bg-border-link/60 z-10 -translate-y-1/2 bg-transparent border-0 p-0"
								onMouseDown={startResize}
								style={{ touchAction: "none" }}
							/>
						)}
						<ExpandResultPanel
							isMaximized={isMaximized}
							onToggleMaximize={handleToggleMaximize}
							onToggleCollapse={handleToggleCollapse}
							onClose={handleClose}
						/>
					</div>
				)}

				{showResultBar && (
					<div
						className="absolute bottom-0 left-0 z-20 bg-bg-secondary border-t border-border-primary flex items-center justify-between pl-6 pr-2 h-10"
						style={{ right: detailsOpen ? detailsWidth : 0 }}
					>
						<span className="typo-label text-text-secondary">Expansion</span>
						<HSComp.Tooltip>
							<HSComp.TooltipTrigger asChild>
								<HSComp.Button
									variant="ghost"
									size="small"
									onClick={() => setIsResultCollapsed(false)}
								>
									<PanelBottomOpen className="w-4 h-4" />
								</HSComp.Button>
							</HSComp.TooltipTrigger>
							<HSComp.TooltipContent align="end">Restore</HSComp.TooltipContent>
						</HSComp.Tooltip>
					</div>
				)}
			</div>
		</GraphRunContext.Provider>
	);
}
