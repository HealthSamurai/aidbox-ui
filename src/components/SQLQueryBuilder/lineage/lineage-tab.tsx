import {
	Background,
	Controls,
	type Edge,
	MarkerType,
	ReactFlow,
	useEdgesState,
	useNodesState,
} from "@xyflow/react";
import * as React from "react";
import { EmptyState } from "../../empty-state";
import { useSQLQueryContext } from "../context";
import { LineageDetailPanel } from "./detail-panel";
import { NodeSearch } from "./node-search";
import { nodeTypes } from "./nodes";
import { useLineageGraph } from "./resolve-graph";
import type { LineageNodeData } from "./types";

import "@xyflow/react/dist/style.css";

const HIGHLIGHT_COLOR = "#2378e1";
const DIM_COLOR = "#d4d4d8";

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

	// Downstream: follow source -> target only.
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

	// Upstream: follow target -> source only.
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

export function LineageTab() {
	const { library } = useSQLQueryContext();
	const { graph, isLoading } = useLineageGraph(library);

	const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);
	const [selectedId, setSelectedId] = React.useState<string | null>(null);

	React.useEffect(() => {
		setNodes(graph.nodes);
		setEdges(graph.edges);
	}, [graph.nodes, graph.edges, setNodes, setEdges]);

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
				description="This Library has no depends-on references yet."
			/>
		);
	}

	const selectedData =
		(nodes.find((n) => n.id === selectedId)?.data as
			| LineageNodeData
			| undefined) ?? null;

	return (
		<div className="relative h-full w-full">
			<div className="h-full w-full bg-bg-primary">
				<ReactFlow
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
					<NodeSearch onSelect={setSelectedId} />
				</ReactFlow>
			</div>
			{selectedData && (
				<div className="absolute top-0 right-0 bottom-0 w-[440px] z-20 border-l border-border-primary shadow-lg bg-bg-primary">
					<LineageDetailPanel data={selectedData} onClose={clearSelection} />
				</div>
			)}
		</div>
	);
}
