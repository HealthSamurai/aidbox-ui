import * as HSComp from "@health-samurai/react-components";
import { useMutation } from "@tanstack/react-query";
import {
	Background,
	Controls,
	type Edge,
	MarkerType,
	ReactFlow,
	useEdgesState,
	useNodesState,
} from "@xyflow/react";
import { PanelBottomOpen } from "lucide-react";
import * as React from "react";
import { useAidboxClient } from "../../../AidboxClient";
import { useLocalStorage } from "../../../hooks";
import { EmptyState } from "../../empty-state";
import { LineageDetailPanel } from "../../SQLQueryBuilder/lineage/detail-panel";
import { LineageResultPanel } from "../../SQLQueryBuilder/lineage/lineage-result-panel";
import { NodeSearch } from "../../SQLQueryBuilder/lineage/node-search";
import { persistParamValues } from "../../SQLQueryBuilder/lineage/param-storage";
import {
	LineageRunContext,
	type LineageRunResult,
	type RunQueryArgs,
} from "../../SQLQueryBuilder/lineage/run-context";
import type {
	LineageNodeData,
	ParamSpec,
} from "../../SQLQueryBuilder/lineage/types";
import { ViewDefinitionContext } from "../page";
import { ExpandContext } from "./expand-context";
import { nodeTypes } from "./node-types";
import {
	expandQueryNode,
	stateToGraph,
	useViewDefinitionLineageGraph,
} from "./resolve-graph";
import type { BackrefGraphState, BackrefNode, BackrefNodeData } from "./types";

import "@xyflow/react/dist/style.css";

const HIGHLIGHT_COLOR = "#2378e1";
const DIM_COLOR = "#d4d4d8";

const DEFAULT_DETAILS_WIDTH = 440;
const MIN_DETAILS_WIDTH = 280;
const MAX_DETAILS_WIDTH = 800;

const DEFAULT_RESULT_HEIGHT = 320;
const MIN_RESULT_HEIGHT = 120;
const MAX_RESULT_HEIGHT = 800;

function collectConnectedEdges(edges: Edge[], rootId: string): Set<string> {
	const bySource = new Map<string, Edge[]>();
	const byTarget = new Map<string, Edge[]>();
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

function decodeBase64ToText(b64: string): string {
	const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

function jsonToRunResult(decoded: string): LineageRunResult {
	let arr: unknown;
	try {
		arr = JSON.parse(decoded);
	} catch {
		return { columns: [], rows: [] };
	}
	if (!Array.isArray(arr)) return { columns: [], rows: [] };
	const columnsSet = new Set<string>();
	for (const r of arr as Record<string, unknown>[]) {
		if (r && typeof r === "object") {
			for (const k of Object.keys(r)) columnsSet.add(k);
		}
	}
	const columns = Array.from(columnsSet);
	const rows = (arr as Record<string, unknown>[]).map((r) =>
		columns.map((c) => r[c] ?? null),
	);
	return { columns, rows };
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

type FhirParametersResponse = {
	resourceType: "Parameters";
	parameter?: Array<{
		name?: string;
		part?: Array<{ name?: string; [key: `value${string}`]: unknown }>;
	}>;
};

function capitalizeFirstLetter(s: string): string {
	return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

function buildParamValueEntry(
	name: string,
	type: string,
	raw: string,
): Record<string, unknown> | null {
	if (raw === "" && type !== "boolean") return null;
	const valueField = `value${capitalizeFirstLetter(type)}`;
	let value: unknown = raw;
	if (type === "integer") {
		const n = Number.parseInt(raw, 10);
		if (Number.isNaN(n)) return null;
		value = n;
	} else if (type === "decimal") {
		const n = Number.parseFloat(raw);
		if (Number.isNaN(n)) return null;
		value = n;
	} else if (type === "boolean") {
		value = raw === "true";
	}
	return { name, [valueField]: value };
}

function buildAllParamEntries(
	allParams: ParamSpec[],
	paramValues: Record<string, string>,
): Record<string, unknown>[] {
	const entries: Record<string, unknown>[] = [];
	for (const p of allParams) {
		const type = p.type ?? "string";
		let raw = paramValues[p.name];
		if (raw === undefined) {
			if (type !== "boolean") continue;
			raw = "";
		}
		const entry = buildParamValueEntry(p.name, type, raw);
		if (entry) entries.push(entry);
	}
	return entries;
}

function getPartValue(
	part: { name?: string; [key: string]: unknown } | undefined,
): unknown {
	if (!part) return null;
	for (const key of Object.keys(part)) {
		if (key.startsWith("value")) return part[key];
	}
	return null;
}

function fhirParametersToRunResult(
	body: FhirParametersResponse,
): LineageRunResult {
	const rowParams = (body.parameter ?? []).filter((p) => p.name === "row");
	if (rowParams.length === 0) return { columns: [], rows: [] };
	const columns: string[] = [];
	const seen = new Set<string>();
	for (const rp of rowParams) {
		for (const part of rp.part ?? []) {
			if (part.name && !seen.has(part.name)) {
				seen.add(part.name);
				columns.push(part.name);
			}
		}
	}
	const rows = rowParams.map((rp) => {
		const byName = new Map<string, unknown>();
		for (const part of rp.part ?? []) {
			if (part.name) byName.set(part.name, getPartValue(part));
		}
		return columns.map((c) => byName.get(c) ?? null);
	});
	return { columns, rows };
}

function isLineageNodeData(data: BackrefNodeData): data is LineageNodeData {
	return data.kind !== "expand-placeholder";
}

export function ViewDefinitionLineageTab() {
	const client = useAidboxClient();
	const { viewDefinition } = React.useContext(ViewDefinitionContext);
	const { state: initialState, isLoading } =
		useViewDefinitionLineageGraph(viewDefinition);

	const [state, setState] = React.useState<BackrefGraphState | null>(null);
	const stateRef = React.useRef<BackrefGraphState | null>(null);
	stateRef.current = state;

	React.useEffect(() => {
		if (initialState) setState(initialState);
	}, [initialState]);

	const graph = React.useMemo(
		() => (state ? stateToGraph(state) : { nodes: [], edges: [] }),
		[state],
	);

	const [nodes, setNodes, onNodesChange] = useNodesState<BackrefNode>(
		graph.nodes,
	);
	const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);
	const [selectedId, setSelectedId] = React.useState<string | null>(null);

	const [runningNodeId, setRunningNodeId] = React.useState<string | null>(null);
	const [resultNodeId, setResultNodeId] = React.useState<string | null>(null);
	const [runResult, setRunResult] = React.useState<LineageRunResult | null>(
		null,
	);
	const [runError, setRunError] =
		React.useState<HSComp.OperationOutcome | null>(null);
	const [isResultCollapsed, setIsResultCollapsed] = React.useState(false);
	const [isMaximized, setIsMaximized] = React.useState(false);

	const [expandingNodeId, setExpandingNodeId] = React.useState<string | null>(
		null,
	);

	const [detailsWidth, setDetailsWidth] = useLocalStorage<number>({
		key: "lineage-tab:details-width",
		defaultValue: DEFAULT_DETAILS_WIDTH,
		getInitialValueInEffect: false,
	});
	const [resultHeight, setResultHeight] = useLocalStorage<number>({
		key: "lineage-tab:result-height",
		defaultValue: DEFAULT_RESULT_HEIGHT,
		getInitialValueInEffect: false,
	});
	const detailsWidthRef = React.useRef(detailsWidth);
	detailsWidthRef.current = detailsWidth;
	const resultHeightRef = React.useRef(resultHeight);
	resultHeightRef.current = resultHeight;

	React.useEffect(() => {
		setNodes(graph.nodes);
		setEdges(graph.edges);
	}, [graph.nodes, graph.edges, setNodes, setEdges]);

	const runMutation = useMutation({
		mutationFn: async ({
			nodeId,
			viewId,
		}: {
			nodeId: string;
			viewId: string;
		}) => {
			setRunningNodeId(nodeId);
			setResultNodeId(nodeId);
			setRunError(null);
			setRunResult(null);
			const result = await client.request<{
				contentType: string;
				data: string;
			}>({
				method: "POST",
				url: `/fhir/ViewDefinition/${viewId}/$run`,
				headers: {
					"Content-Type": "application/json",
					Accept: "application/fhir+json",
				},
				body: JSON.stringify({
					resourceType: "Parameters",
					parameter: [
						{ name: "_format", valueCode: "json" },
						{ name: "_limit", valueInteger: 1000 },
						{ name: "_page", valueInteger: 1 },
					],
				}),
			});
			if (result.isErr()) throw result.value.resource;
			return result.value.resource;
		},
		onSuccess: (data) => {
			setRunningNodeId(null);
			setRunResult(jsonToRunResult(decodeBase64ToText(data.data)));
		},
		onError: (err) => {
			setRunningNodeId(null);
			setRunError(toOperationOutcome(err));
		},
	});

	const runView = React.useCallback(
		(nodeId: string, viewId: string) => {
			if (!viewId) return;
			setIsResultCollapsed(false);
			setIsMaximized(false);
			runMutation.mutate({ nodeId, viewId });
		},
		[runMutation],
	);

	const runQueryMutation = useMutation({
		mutationFn: async ({
			nodeId,
			queryId,
			allParams,
			paramValues,
		}: RunQueryArgs) => {
			setRunningNodeId(nodeId);
			setResultNodeId(nodeId);
			setRunError(null);
			setRunResult(null);
			const valueEntries = buildAllParamEntries(allParams, paramValues);
			const topLevelParameters: Record<string, unknown>[] = [
				{ name: "_format", valueCode: "fhir" },
			];
			if (valueEntries.length > 0) {
				topLevelParameters.push({
					name: "parameters",
					resource: {
						resourceType: "Parameters",
						parameter: valueEntries,
					},
				});
			}
			const result = await client.request<FhirParametersResponse>({
				method: "POST",
				url: `/fhir/Library/${queryId}/$sqlquery-run`,
				body: JSON.stringify({
					resourceType: "Parameters",
					parameter: topLevelParameters,
				}),
				headers: { "Content-Type": "application/json" },
			});
			if (result.isErr()) throw result.value.resource;
			return result.value.resource;
		},
		onSuccess: (data, variables) => {
			setRunningNodeId(null);
			setRunResult(fhirParametersToRunResult(data));
			persistParamValues(variables.queryId, variables.paramValues);
		},
		onError: (err) => {
			setRunningNodeId(null);
			setRunError(toOperationOutcome(err));
		},
	});

	const runQuery = React.useCallback(
		(args: RunQueryArgs) => {
			if (!args.queryId) return;
			setIsResultCollapsed(false);
			setIsMaximized(false);
			runQueryMutation.mutate(args);
		},
		[runQueryMutation],
	);

	const styledEdges = React.useMemo<Edge[]>(() => {
		if (!selectedId) {
			return edges.map((e) => ({
				...e,
				style: undefined,
				markerEnd: { type: MarkerType.ArrowClosed },
			}));
		}
		const highlighted = collectConnectedEdges(edges, selectedId);
		return edges.map((e) => {
			const on = highlighted.has(e.id);
			return {
				...e,
				style: {
					stroke: on ? HIGHLIGHT_COLOR : DIM_COLOR,
					strokeWidth: on ? 2 : 1,
				},
				markerEnd: {
					type: MarkerType.ArrowClosed,
					color: on ? HIGHLIGHT_COLOR : DIM_COLOR,
				},
				animated: on,
			};
		});
	}, [edges, selectedId]);

	const clearSelection = React.useCallback(() => {
		setSelectedId(null);
		setNodes((nds) =>
			nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
		);
	}, [setNodes]);

	const clearRunState = React.useCallback(() => {
		setRunResult(null);
		setRunError(null);
		setResultNodeId(null);
		setRunningNodeId(null);
	}, []);

	const handlePaneClick = React.useCallback(() => {
		clearSelection();
		clearRunState();
	}, [clearSelection, clearRunState]);

	const handleNodeClick = React.useCallback(
		(nodeId: string) => {
			const node = nodes.find((n) => n.id === nodeId);
			if (node?.type === "expand-placeholder") return;
			setSelectedId(nodeId);
			if (resultNodeId !== null && resultNodeId !== nodeId) {
				clearRunState();
			}
		},
		[nodes, resultNodeId, clearRunState],
	);

	const handleToggleMaximize = React.useCallback(() => {
		setIsMaximized((p) => !p);
	}, []);

	React.useEffect(() => {
		if (!isMaximized) return;
		const onEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") setIsMaximized(false);
		};
		document.addEventListener("keydown", onEscape);
		return () => document.removeEventListener("keydown", onEscape);
	}, [isMaximized]);

	const startDrag = React.useCallback(
		(e: React.MouseEvent, axis: "x" | "y") => {
			e.preventDefault();
			const startClient = axis === "x" ? e.clientX : e.clientY;
			const startSize =
				axis === "x" ? detailsWidthRef.current : resultHeightRef.current;
			const prevUserSelect = document.body.style.userSelect;
			const prevCursor = document.body.style.cursor;
			document.body.style.userSelect = "none";
			document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
			const onMove = (ev: MouseEvent) => {
				const delta = startClient - (axis === "x" ? ev.clientX : ev.clientY);
				if (axis === "x") {
					setDetailsWidth(
						clamp(startSize + delta, MIN_DETAILS_WIDTH, MAX_DETAILS_WIDTH),
					);
				} else {
					setResultHeight(
						clamp(startSize + delta, MIN_RESULT_HEIGHT, MAX_RESULT_HEIGHT),
					);
				}
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
		[setDetailsWidth, setResultHeight],
	);

	const runContextValue = React.useMemo(
		() => ({
			runningNodeId,
			resultNodeId,
			runResult,
			runError,
			runView,
			runQuery,
		}),
		[runningNodeId, resultNodeId, runResult, runError, runView, runQuery],
	);

	const handleExpand = React.useCallback(
		async (queryNodeId: string) => {
			const current = stateRef.current;
			if (!current || expandingNodeId) return;
			setExpandingNodeId(queryNodeId);
			try {
				const next = await expandQueryNode(client, current, queryNodeId);
				setState({
					rootId: next.rootId,
					nodesById: new Map(next.nodesById),
					depthById: new Map(next.depthById),
					edges: [...next.edges],
				});
			} finally {
				setExpandingNodeId(null);
			}
		},
		[client, expandingNodeId],
	);

	const expandContextValue = React.useMemo(
		() => ({ expandingNodeId, expand: handleExpand }),
		[expandingNodeId, handleExpand],
	);

	if (isLoading && nodes.length === 0) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				Resolving lineage…
			</div>
		);
	}

	if (nodes.length === 0) {
		return (
			<EmptyState
				title="No lineage"
				description="This ViewDefinition is not referenced by any SQLQuery yet."
			/>
		);
	}

	const selectedNode = nodes.find((n) => n.id === selectedId);
	const selectedData =
		selectedNode && isLineageNodeData(selectedNode.data as BackrefNodeData)
			? (selectedNode.data as LineageNodeData)
			: null;

	const hasResult = resultNodeId !== null;
	const detailsOpen = selectedData !== null;
	const showResult = hasResult && !isResultCollapsed;
	const showResultBar = hasResult && isResultCollapsed && !isMaximized;

	return (
		<LineageRunContext.Provider value={runContextValue}>
			<ExpandContext.Provider value={expandContextValue}>
				<div className="relative h-full w-full overflow-hidden">
					<div className="absolute inset-0 bg-bg-primary">
						<ReactFlow<BackrefNode>
							nodes={nodes}
							edges={styledEdges}
							onNodesChange={onNodesChange}
							onEdgesChange={onEdgesChange}
							onNodeClick={(_, node) => handleNodeClick(node.id)}
							onPaneClick={handlePaneClick}
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
							<NodeSearch onSelect={handleNodeClick} />
						</ReactFlow>
					</div>

					{detailsOpen && (
						<div
							className="absolute top-0 right-0 bottom-0 z-20 bg-bg-primary border-l border-border-primary shadow-lg"
							style={{ width: detailsWidth }}
						>
							<button
								type="button"
								aria-label="Resize details panel"
								className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-border-link/60 z-10 -translate-x-1/2 bg-transparent border-0 p-0"
								onMouseDown={(e) => startDrag(e, "x")}
								style={{ touchAction: "none" }}
							/>
							<LineageDetailPanel
								data={selectedData}
								onClose={clearSelection}
							/>
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
									onMouseDown={(e) => startDrag(e, "y")}
									style={{ touchAction: "none" }}
								/>
							)}
							<LineageResultPanel
								isMaximized={isMaximized}
								onToggleMaximize={handleToggleMaximize}
								onToggleCollapse={() => setIsResultCollapsed(true)}
							/>
						</div>
					)}

					{showResultBar && (
						<div
							className="absolute bottom-0 left-0 z-20 bg-bg-secondary border-t border-border-primary flex items-center justify-between pl-6 pr-2 h-10"
							style={{ right: detailsOpen ? detailsWidth : 0 }}
						>
							<span className="typo-label text-text-secondary">Result</span>
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
								<HSComp.TooltipContent align="end">
									Restore
								</HSComp.TooltipContent>
							</HSComp.Tooltip>
						</div>
					)}
				</div>
			</ExpandContext.Provider>
		</LineageRunContext.Provider>
	);
}
