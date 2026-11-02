import * as HSComp from "@health-samurai/react-components";
import { Maximize2, Minimize2, PanelBottomClose } from "lucide-react";
import * as React from "react";
import { useLocalStorage } from "../../hooks";
import { DataTableFooter } from "../data-table/footer";
import { EmptyState } from "../empty-state";
import { ChartPanel } from "../notebook-chart/chart-panel";
import { useSQLQueryContext } from "./context";
import { ExplainTab } from "./explain-tab";
import { SQLTab } from "./sql-tab";

const DEFAULT_PAGE_SIZE = 30;
const PAGE_SIZE_STORAGE_KEY = "sqlquery-builder:result-page-size";
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

function formatCellValue(value: unknown): string {
	if (value === null || value === undefined) return "—";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

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

	const rows = runResult.rows;

	if (viewMode === "list") {
		return (
			<div className="h-full overflow-auto divide-y divide-border-secondary">
				{rows.map((row, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: row order is stable
						key={i}
						className="grid gap-x-4 px-6 py-3"
						style={{ gridTemplateColumns: "max-content 1fr" }}
					>
						{runResult.columns.map((col, j) => (
							<div key={col} className="contents">
								<div className="py-1 px-2 text-right text-text-secondary typo-label text-sm whitespace-nowrap">
									{col}
								</div>
								<div className="py-1 px-2 min-w-0 typo-code">
									{formatCellValue(row[j])}
								</div>
							</div>
						))}
					</div>
				))}
			</div>
		);
	}

	return (
		<HSComp.Table zebra stickyHeader className="typo-code">
			<HSComp.TableHeader className="z-0">
				<HSComp.TableRow>
					{runResult.columns.map((col) => (
						<HSComp.TableHead key={col}>{col}</HSComp.TableHead>
					))}
					<HSComp.TableHead className="w-full p-0" />
				</HSComp.TableRow>
			</HSComp.TableHeader>
			<HSComp.TableBody>
				{rows.map((row, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: row order is stable
					<HSComp.TableRow key={i} zebra index={i}>
						{runResult.columns.map((col, j) => (
							<HSComp.TableCell key={col}>
								{formatCellValue(row[j])}
							</HSComp.TableCell>
						))}
						<HSComp.TableCell className="p-0" />
					</HSComp.TableRow>
				))}
			</HSComp.TableBody>
		</HSComp.Table>
	);
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
	const { runResult, runDuration, runPageRef } = useSQLQueryContext();
	const [page, setPage] = React.useState(1);
	const [pageSize, setPageSize] = useLocalStorage<number>({
		key: PAGE_SIZE_STORAGE_KEY,
		getInitialValueInEffect: false,
		defaultValue: DEFAULT_PAGE_SIZE,
	});
	const [activeTab, setActiveTab] = React.useState<ResultTab>("result");
	const [viewMode, setViewMode] = useLocalStorage<ViewMode>({
		key: VIEW_MODE_STORAGE_KEY,
		getInitialValueInEffect: false,
		defaultValue: "table",
	});

	// Reset to page 1 when a completely new result arrives (RUN button).
	const prevResultRef = React.useRef(runResult);
	React.useEffect(() => {
		if (runResult !== prevResultRef.current) {
			prevResultRef.current = runResult;
		}
	}, [runResult]);

	// Server-side pagination without a server-reported total: if the current
	// page is full (rows === pageSize), assume there is at least one more page.
	const rowCount = runResult?.rows.length ?? 0;
	const hasMore = rowCount === pageSize;
	// Synthesise a total that lets DataTableFooter show the right page count.
	// When the page is full we pretend there's one more page worth of rows.
	const total =
		rowCount === 0 && page === 1
			? 0
			: hasMore
				? page * pageSize + 1
				: (page - 1) * pageSize + rowCount;

	const handlePageChange = React.useCallback(
		(newPage: number) => {
			setPage(newPage);
			runPageRef.current(newPage, pageSize);
		},
		[pageSize, runPageRef],
	);

	const handlePageSizeChange = React.useCallback(
		(size: number) => {
			setPageSize(size);
			setPage(1);
			runPageRef.current(1, size);
		},
		[setPageSize, runPageRef],
	);

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
					{total > 0 && viewMode !== "chart" && (
						<DataTableFooter
							total={total}
							currentPage={page}
							pageSize={pageSize}
							selectedCount={0}
							onPageChange={handlePageChange}
							onPageSizeChange={handlePageSizeChange}
						/>
					)}
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
