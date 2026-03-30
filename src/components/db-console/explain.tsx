import {
	Button,
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	TreeView,
	type TreeViewItem,
} from "@health-samurai/react-components";
import { Loader2 } from "lucide-react";

export type PlanNodeMeta = {
	nodeType: string;
	relation?: string;
	actualTime: number;
	actualRows: number;
	planRows: number;
	totalCost: number;
	sharedHitBlocks?: number;
	sharedReadBlocks?: number;
	filter?: string;
	indexName?: string;
	loops: number;
	timePercent: number;
	rowsRemovedByFilter?: number;
	rowsRemovedByJoinFilter?: number;
};

type RawPlanNode = {
	"Node Type": string;
	"Relation Name"?: string;
	"Index Name"?: string;
	Filter?: string;
	"Index Cond"?: string;
	"Hash Cond"?: string;
	"Join Filter"?: string;
	"Merge Cond"?: string;
	"Total Cost": number;
	"Plan Rows": number;
	"Actual Total Time": number;
	"Actual Rows": number;
	"Actual Loops": number;
	"Shared Hit Blocks"?: number;
	"Shared Read Blocks"?: number;
	"Rows Removed by Filter"?: number;
	"Rows Removed by Join Filter"?: number;
	Plans?: RawPlanNode[];
};

export type ExplainJSON = {
	Plan: RawPlanNode;
	"Planning Time": number;
	"Execution Time": number;
};

export type ExplainData = {
	planningTime: number;
	executionTime: number;
	items: Record<string, TreeViewItem<PlanNodeMeta>>;
	allNodeIds: string[];
	rawText: string;
};

export function flattenPlanNode(
	node: RawPlanNode,
	totalExecutionTime: number,
	id: string,
	result: Record<string, TreeViewItem<PlanNodeMeta>>,
	allIds: string[],
): void {
	allIds.push(id);
	const childIds: string[] = [];

	if (node.Plans) {
		node.Plans.forEach((child, i) => {
			const childId = `${id}-${i}`;
			childIds.push(childId);
			flattenPlanNode(child, totalExecutionTime, childId, result, allIds);
		});
	}

	const childrenTime = (node.Plans ?? []).reduce(
		(sum, child) => sum + child["Actual Total Time"] * child["Actual Loops"],
		0,
	);
	const exclusiveTime =
		node["Actual Total Time"] * node["Actual Loops"] - childrenTime;
	const timePercent =
		totalExecutionTime > 0 ? (exclusiveTime / totalExecutionTime) * 100 : 0;

	const filter =
		node.Filter ||
		node["Index Cond"] ||
		node["Hash Cond"] ||
		node["Join Filter"] ||
		node["Merge Cond"];

	result[id] = {
		name: node["Node Type"],
		...(childIds.length > 0 ? { children: childIds } : {}),
		meta: {
			nodeType: node["Node Type"],
			relation: node["Relation Name"],
			actualTime: node["Actual Total Time"],
			actualRows: node["Actual Rows"],
			planRows: node["Plan Rows"],
			totalCost: node["Total Cost"],
			sharedHitBlocks: node["Shared Hit Blocks"],
			sharedReadBlocks: node["Shared Read Blocks"],
			filter,
			indexName: node["Index Name"],
			loops: node["Actual Loops"],
			timePercent,
			rowsRemovedByFilter: node["Rows Removed by Filter"],
			rowsRemovedByJoinFilter: node["Rows Removed by Join Filter"],
		},
	};
}

function PlanNodeView({ meta }: { meta: PlanNodeMeta }) {
	const timeColorClass =
		meta.timePercent > 66
			? "text-text-error-primary"
			: meta.timePercent > 33
				? "text-text-warning-primary"
				: "text-text-success-primary";

	const label = [
		meta.nodeType,
		meta.relation && `on ${meta.relation}`,
		meta.indexName && `using ${meta.indexName}`,
	]
		.filter(Boolean)
		.join(" ");

	const actualTimeTotal = meta.actualTime * meta.loops;
	const hasBuffers =
		(meta.sharedHitBlocks != null && meta.sharedHitBlocks > 0) ||
		(meta.sharedReadBlocks != null && meta.sharedReadBlocks > 0);
	const hasRowsRemoved =
		(meta.rowsRemovedByFilter != null && meta.rowsRemovedByFilter > 0) ||
		(meta.rowsRemovedByJoinFilter != null && meta.rowsRemovedByJoinFilter > 0);
	const hasSecondLine = meta.filter || hasBuffers || hasRowsRemoved;

	return (
		<div className="flex flex-col gap-0.5 py-0.5 min-w-0">
			<div className="flex items-center gap-3">
				<span className="text-sm font-medium text-text-primary">{label}</span>
				<span className="text-xs text-text-secondary">
					{actualTimeTotal.toFixed(2)}ms · {meta.actualRows} rows
					{meta.loops > 1 && ` · ${meta.loops} loops`}
					{meta.planRows !== meta.actualRows && (
						<span className="text-text-warning-primary">
							{" "}
							(est. {meta.planRows})
						</span>
					)}
				</span>
				<span className={`text-xs font-medium ${timeColorClass}`}>
					{meta.timePercent.toFixed(1)}%
				</span>
			</div>
			{hasSecondLine && (
				<div className="text-xs text-text-tertiary flex gap-3">
					{meta.filter && (
						<span className="truncate max-w-md" title={meta.filter}>
							Filter: {meta.filter}
						</span>
					)}
					{hasRowsRemoved && (
						<span className="text-text-warning-primary">
							{meta.rowsRemovedByFilter != null &&
								meta.rowsRemovedByFilter > 0 &&
								`Removed by filter: ${meta.rowsRemovedByFilter}`}
							{meta.rowsRemovedByFilter != null &&
								meta.rowsRemovedByFilter > 0 &&
								meta.rowsRemovedByJoinFilter != null &&
								meta.rowsRemovedByJoinFilter > 0 &&
								" · "}
							{meta.rowsRemovedByJoinFilter != null &&
								meta.rowsRemovedByJoinFilter > 0 &&
								`Removed by join filter: ${meta.rowsRemovedByJoinFilter}`}
						</span>
					)}
					{hasBuffers && (
						<span>
							Hit: {meta.sharedHitBlocks ?? 0} · Read:{" "}
							{meta.sharedReadBlocks ?? 0}
						</span>
					)}
				</div>
			)}
		</div>
	);
}

function SingleExplainView({
	result,
	viewMode,
}: {
	result: ExplainData | string;
	viewMode: "visual" | "raw";
}) {
	if (typeof result === "string") {
		return (
			<div className="flex-1 overflow-auto p-6">
				<pre className="text-sm whitespace-pre-wrap font-mono text-text-primary">
					{result}
				</pre>
			</div>
		);
	}

	return (
		<div className="relative flex flex-col flex-1 min-h-0">
			<div className="flex-1 overflow-auto pl-2 pr-6 py-4">
				{viewMode === "visual" ? (
					<>
						<div className="flex gap-4 text-xs text-text-tertiary mb-3 pl-3">
							<span>Execution: {result.executionTime.toFixed(2)}ms</span>
							<span>Planning: {result.planningTime.toFixed(2)}ms</span>
						</div>
						<TreeView<PlanNodeMeta>
							rootItemId="root"
							items={result.items}
							defaultExpandedItems={result.allNodeIds}
							disableHover
							customItemView={(item) => {
								const meta = item.getItemData()?.meta;
								if (!meta) return item.getItemData()?.name;
								return <PlanNodeView meta={meta} />;
							}}
						/>
					</>
				) : (
					<pre className="text-sm whitespace-pre-wrap font-mono text-text-primary pl-3">
						{result.rawText}
					</pre>
				)}
			</div>
		</div>
	);
}

export function ExplainContent({
	results,
	error,
	isLoading,
	onCancel,
	viewMode,
}: {
	results: (ExplainData | string)[] | null;
	error: string | null;
	isLoading: boolean;
	onCancel: () => void;
	viewMode: "visual" | "raw";
}) {
	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center flex-1 gap-3 text-text-secondary">
				<div className="flex items-center">
					<Loader2 className="animate-spin mr-2" size={16} />
					Running EXPLAIN ANALYZE…
				</div>
				<Button variant="secondary" size="small" onClick={onCancel}>
					Cancel
				</Button>
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-6">
				<pre className="text-sm text-text-error-primary whitespace-pre-wrap font-mono">
					{error}
				</pre>
			</div>
		);
	}

	if (!results) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary bg-bg-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">No plan yet</div>
					<div className="text-sm">
						Run a query first, then switch to this tab
					</div>
				</div>
			</div>
		);
	}

	if (results.length === 1) {
		const r = results[0];
		if (!r) return null;
		return (
			<div className="flex flex-col flex-1 min-h-0">
				<SingleExplainView result={r} viewMode={viewMode} />
			</div>
		);
	}

	return (
		<ResizablePanelGroup direction="vertical">
			{results.flatMap((result, index) => {
				const key = `explain-${index}`;
				const panel = (
					<ResizablePanel key={`panel-${key}`} minSize={10}>
						<div className="flex flex-col h-full min-h-0">
							<div className="flex-none flex items-center px-4 py-1 border-b bg-bg-secondary">
								<span className="text-xs text-text-tertiary">
									Query {index + 1}
								</span>
							</div>
							<SingleExplainView result={result} viewMode={viewMode} />
						</div>
					</ResizablePanel>
				);
				if (index === 0) return [panel];
				return [<ResizableHandle key={`handle-${key}`} />, panel];
			})}
		</ResizablePanelGroup>
	);
}
