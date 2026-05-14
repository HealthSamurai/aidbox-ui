import * as HSComp from "@health-samurai/react-components";
import { Maximize2, Minimize2, PanelBottomClose } from "lucide-react";
import * as React from "react";
import { DataTableFooter } from "../data-table/footer";
import { EmptyState } from "../empty-state";
import { useSQLQueryContext } from "./context";

const DEFAULT_PAGE_SIZE = 30;

function ResultBody({ page, pageSize }: { page: number; pageSize: number }) {
	const { runResult, isRunning } = useSQLQueryContext();

	if (isRunning) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				Running…
			</div>
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
			<HSComp.TableHeader>
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
	const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
	const total = runResult?.rows.length ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	React.useEffect(() => {
		setPage(1);
	}, []);

	React.useEffect(() => {
		if (page > totalPages) setPage(totalPages);
	}, [page, totalPages]);

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="flex gap-1 items-center justify-between bg-bg-secondary px-4 pr-2 border-b h-10 shrink-0">
				<span className="typo-label text-text-secondary">Result</span>
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
						<HSComp.TooltipContent align="end">Collapse</HSComp.TooltipContent>
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
		</div>
	);
}
