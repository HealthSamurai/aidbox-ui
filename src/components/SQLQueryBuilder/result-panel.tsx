import * as HSComp from "@health-samurai/react-components";
import { Maximize2, Minimize2, PanelBottomClose } from "lucide-react";
import * as React from "react";
import { useLocalStorage } from "../../hooks";
import { DataTableFooter } from "../data-table/footer";
import { EmptyState } from "../empty-state";
import { ChartPanel } from "../notebook-chart/chart-panel";
import { useSQLQueryContext } from "./context";
import { SQLTab } from "./sql-tab";

const DEFAULT_PAGE_SIZE = 30;
const PAGE_SIZE_STORAGE_KEY = "sqlquery-builder:result-page-size";
const VIEW_MODE_STORAGE_KEY = "sqlquery-builder:result-view-mode";

type ViewMode = "table" | "list" | "chart";

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

function ResultBody({
	page,
	pageSize,
	viewMode,
}: {
	page: number;
	pageSize: number;
	viewMode: ViewMode;
}) {
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

	const start = (page - 1) * pageSize;
	const visibleRows = runResult.rows.slice(start, start + pageSize);

	if (viewMode === "list") {
		return (
			<div className="h-full overflow-auto divide-y divide-border-secondary">
				{visibleRows.map((row, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: row order is stable
						key={start + i}
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
				{visibleRows.map((row, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: row order is stable
					<HSComp.TableRow key={start + i} zebra index={start + i}>
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
	const { runResult } = useSQLQueryContext();
	const [page, setPage] = React.useState(1);
	const [pageSize, setPageSize] = useLocalStorage<number>({
		key: PAGE_SIZE_STORAGE_KEY,
		getInitialValueInEffect: false,
		defaultValue: DEFAULT_PAGE_SIZE,
	});
	const [activeTab, setActiveTab] = React.useState<"result" | "sql">("result");
	const [viewMode, setViewMode] = useLocalStorage<ViewMode>({
		key: VIEW_MODE_STORAGE_KEY,
		getInitialValueInEffect: false,
		defaultValue: "table",
	});
	const total = runResult?.rows.length ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	React.useEffect(() => {
		setPage(1);
	}, []);

	React.useEffect(() => {
		if (page > totalPages) setPage(totalPages);
	}, [page, totalPages]);

	return (
		<HSComp.Tabs
			value={activeTab}
			onValueChange={(v) => setActiveTab(v as "result" | "sql")}
			className="h-full"
		>
			<div className="flex flex-col h-full overflow-hidden">
				<div className="flex gap-1 items-center justify-between bg-bg-secondary pr-2 border-b h-10 shrink-0">
					<HSComp.TabsList>
						<HSComp.TabsTrigger value="result">Result</HSComp.TabsTrigger>
						<HSComp.TabsTrigger value="sql">SQL</HSComp.TabsTrigger>
					</HSComp.TabsList>
					<div className="flex items-center gap-2">
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
						<ResultBody page={page} pageSize={pageSize} viewMode={viewMode} />
					</div>
					{total > 0 && viewMode !== "chart" && (
						<DataTableFooter
							total={total}
							currentPage={page}
							pageSize={pageSize}
							selectedCount={0}
							onPageChange={setPage}
							onPageSizeChange={(size) => {
								setPageSize(size);
								setPage(1);
							}}
						/>
					)}
				</HSComp.TabsContent>
				<HSComp.TabsContent value="sql" className="flex-1 min-h-0">
					<SQLTab />
				</HSComp.TabsContent>
			</div>
		</HSComp.Tabs>
	);
}
