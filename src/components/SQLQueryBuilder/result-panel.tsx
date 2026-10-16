import * as HSComp from "@health-samurai/react-components";
import { Maximize2, Minimize2, PanelBottomClose } from "lucide-react";
import * as React from "react";
import { useLocalStorage } from "../../hooks";
import { EmptyState } from "../empty-state";
import { ChartPanel } from "../notebook-chart/chart-panel";
import { useSQLQueryContext } from "./context";
import { ExplainTab } from "./explain-tab";
import { formatRowCount, ResultList, ResultTable } from "./result-table";
import { SQLTab } from "./sql-tab";

const VIEW_MODE_STORAGE_KEY = "sqlquery-builder:result-view-mode";

type ViewMode = "table" | "list" | "chart";
type ResultTab = "result" | "sql" | "explain";

/** Sub-millisecond runs read better as fractions than as a bare 0. */
const formatDuration = (ms: number): string =>
	ms >= 1000
		? `${(ms / 1000).toFixed(2)} s`
		: `${ms.toFixed(ms < 10 ? 1 : 0)} ms`;

const VIEW_MODE_ITEMS: { value: ViewMode; label: string }[] = [
	{ value: "table", label: "Table" },
	{ value: "list", label: "List" },
	{ value: "chart", label: "Chart" },
];

function ResultBody({ viewMode }: { viewMode: ViewMode }) {
	const { runResult, runError, isRunning } = useSQLQueryContext();

	if (isRunning) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				Running…
			</div>
		);
	}

	if (runError) {
		return (
			<HSComp.OperationOutcomeView
				resource={runError}
				className="h-full overflow-auto"
			/>
		);
	}

	if (!runResult) {
		return (
			<EmptyState
				title="No results yet"
				description="Click Run to execute the query"
				grayscale
			/>
		);
	}

	if (runResult.rows.length === 0) {
		return (
			<EmptyState
				title="No results"
				description="The query executed successfully but returned no data"
			/>
		);
	}

	if (viewMode === "chart") {
		return (
			<ChartPanel
				columns={runResult.columns}
				rows={runResult.rows}
				editable
				fullHeight
			/>
		);
	}

	if (viewMode === "list") {
		return <ResultList columns={runResult.columns} rows={runResult.rows} />;
	}

	return <ResultTable columns={runResult.columns} rows={runResult.rows} />;
}

export function ResultPanel({
	isMaximized,
	onToggleMaximize,
	onToggleCollapse,
}: {
	isMaximized: boolean;
	onToggleMaximize: () => void;
	onToggleCollapse: () => void;
}) {
	const { runResult, runDuration } = useSQLQueryContext();
	const [activeTab, setActiveTab] = React.useState<ResultTab>("result");
	const [viewMode, setViewMode] = useLocalStorage<ViewMode>({
		key: VIEW_MODE_STORAGE_KEY,
		getInitialValueInEffect: false,
		defaultValue: "table",
	});

	return (
		<HSComp.Tabs
			value={activeTab}
			onValueChange={(v) => setActiveTab(v as ResultTab)}
			className="h-full"
		>
			<div className="flex flex-col h-full overflow-hidden">
				<div className="flex gap-1 items-center justify-between bg-bg-secondary pr-2 border-b h-10 shrink-0">
					<HSComp.TabsList>
						<HSComp.TabsTrigger value="result">Result</HSComp.TabsTrigger>
						<HSComp.TabsTrigger value="sql">SQL</HSComp.TabsTrigger>
						<HSComp.TabsTrigger value="explain">Explain</HSComp.TabsTrigger>
					</HSComp.TabsList>
					<div className="flex items-center gap-2">
						{runResult && (
							<span className="typo-body-xs text-text-secondary">
								{formatRowCount(runResult.rows.length)}
							</span>
						)}
						{runDuration !== null && (
							<HSComp.Tooltip>
								<HSComp.TooltipTrigger asChild>
									<span className="typo-body-xs text-text-secondary font-mono">
										{formatDuration(runDuration)}
									</span>
								</HSComp.TooltipTrigger>
								<HSComp.TooltipContent align="end">
									Round trip of the last run, network included
								</HSComp.TooltipContent>
							</HSComp.Tooltip>
						)}
						{activeTab === "result" && (
							<HSComp.SegmentControl
								value={viewMode}
								onValueChange={(v) => setViewMode(v as ViewMode)}
								items={VIEW_MODE_ITEMS}
							/>
						)}
						<HSComp.Tooltip>
							<HSComp.TooltipTrigger asChild>
								<HSComp.Button
									variant="ghost"
									size="small"
									onClick={onToggleCollapse}
								>
									<PanelBottomClose className="w-4 h-4" />
								</HSComp.Button>
							</HSComp.TooltipTrigger>
							<HSComp.TooltipContent align="end">
								Collapse
							</HSComp.TooltipContent>
						</HSComp.Tooltip>
						<HSComp.Tooltip>
							<HSComp.TooltipTrigger asChild>
								<HSComp.Button
									variant="ghost"
									size="small"
									onClick={onToggleMaximize}
								>
									{isMaximized ? (
										<Minimize2 className="w-4 h-4" />
									) : (
										<Maximize2 className="w-4 h-4" />
									)}
								</HSComp.Button>
							</HSComp.TooltipTrigger>
							<HSComp.TooltipContent align="end">
								{isMaximized ? "Minimize" : "Maximize"}
							</HSComp.TooltipContent>
						</HSComp.Tooltip>
					</div>
				</div>
				<HSComp.TabsContent
					value="result"
					className="flex-1 min-h-0 flex flex-col"
				>
					<div className="flex-1 min-h-0">
						<ResultBody viewMode={viewMode} />
					</div>
				</HSComp.TabsContent>
				<HSComp.TabsContent value="sql" className="flex-1 min-h-0">
					<SQLTab />
				</HSComp.TabsContent>
				<HSComp.TabsContent value="explain" className="flex-1 min-h-0">
					<ExplainTab />
				</HSComp.TabsContent>
			</div>
		</HSComp.Tabs>
	);
}
