import * as HSComp from "@health-samurai/react-components";
import { Maximize2, Minimize2, PanelBottomClose } from "lucide-react";
import * as React from "react";
import { useLocalStorage } from "../../hooks";
import { DataTableFooter } from "../data-table/footer";
import { EmptyState } from "../empty-state";
import { useSQLQueryContext } from "./context";
import { SQLTab } from "./sql-tab";

const DEFAULT_PAGE_SIZE = 30;
const PAGE_SIZE_STORAGE_KEY = "sqlquery-builder:result-page-size";

function ResultBody({ page, pageSize }: { page: number; pageSize: number }) {
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

	const start = (page - 1) * pageSize;
	const visibleRows = runResult.rows.slice(start, start + pageSize);

	return (
		<HSComp.Table zebra stickyHeader className="typo-code">
			<HSComp.TableHeader className="z-0">
				<HSComp.TableRow>
					{runResult.columns.map((col) => (
						<HSComp.TableHead key={col}>{col}</HSComp.TableHead>
					))}
				</HSComp.TableRow>
			</HSComp.TableHeader>
			<HSComp.TableBody>
				{visibleRows.map((row, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: row order is stable
					<HSComp.TableRow key={start + i} zebra index={start + i}>
						{runResult.columns.map((col, j) => {
							const v = row[j];
							return (
								<HSComp.TableCell key={col}>
									{v === null || v === undefined
										? "—"
										: typeof v === "object"
											? JSON.stringify(v)
											: String(v)}
								</HSComp.TableCell>
							);
						})}
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
	const total = runResult?.rows.length ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	React.useEffect(() => {
		setPage(1);
	}, []);

	React.useEffect(() => {
		if (page > totalPages) setPage(totalPages);
	}, [page, totalPages]);

	return (
		<HSComp.Tabs defaultValue="result" className="h-full">
			<div className="flex flex-col h-full overflow-hidden">
				<div className="flex gap-1 items-center justify-between bg-bg-secondary pr-2 border-b h-10 shrink-0">
					<HSComp.TabsList>
						<HSComp.TabsTrigger value="result">Result</HSComp.TabsTrigger>
						<HSComp.TabsTrigger value="sql">SQL</HSComp.TabsTrigger>
					</HSComp.TabsList>
					<div className="flex items-center gap-1">
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
						<ResultBody page={page} pageSize={pageSize} />
					</div>
					{total > 0 && (
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
