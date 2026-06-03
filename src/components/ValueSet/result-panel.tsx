import * as HSComp from "@health-samurai/react-components";
import { Maximize2, Minimize2, PanelBottomClose, Timer } from "lucide-react";
import * as React from "react";
import { useLocalStorage } from "../../hooks";
import { DataTableFooter } from "../data-table/footer";
import { EmptyState } from "../empty-state";
import { useValueSetContext } from "./context";

const DEFAULT_PAGE_SIZE = 30;
const PAGE_SIZE_STORAGE_KEY = "valueset-builder:result-page-size";

function ResultBody({ page, pageSize }: { page: number; pageSize: number }) {
	const { expansion, expandError, isExpanding } = useValueSetContext();

	if (isExpanding) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				Expanding…
			</div>
		);
	}

	if (expandError) {
		return (
			<HSComp.OperationOutcomeView
				resource={expandError}
				className="h-full overflow-auto"
			/>
		);
	}

	if (!expansion) {
		return (
			<EmptyState
				title="No expansion yet"
				description="Click EXPAND to evaluate the ValueSet"
				grayscale
			/>
		);
	}

	const contains = expansion.contains ?? [];
	if (contains.length === 0) {
		return (
			<EmptyState
				title="Empty expansion"
				description="The ValueSet expanded successfully but contains no codes"
			/>
		);
	}

	const start = (page - 1) * pageSize;
	const visibleRows = contains.slice(start, start + pageSize);

	return (
		<HSComp.Table zebra stickyHeader className="typo-code">
			<HSComp.TableHeader className="z-0">
				<HSComp.TableRow>
					<HSComp.TableHead>Code</HSComp.TableHead>
					<HSComp.TableHead>Display</HSComp.TableHead>
					<HSComp.TableHead>System</HSComp.TableHead>
					<HSComp.TableHead className="w-full p-0" />
				</HSComp.TableRow>
			</HSComp.TableHeader>
			<HSComp.TableBody>
				{visibleRows.map((row, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: row order is stable
					<HSComp.TableRow key={start + i} zebra index={start + i}>
						<HSComp.TableCell>{row.code ?? "—"}</HSComp.TableCell>
						<HSComp.TableCell>{row.display ?? "—"}</HSComp.TableCell>
						<HSComp.TableCell className="text-text-secondary">
							{row.system ?? "—"}
						</HSComp.TableCell>
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
	const { expansion, expandDurationMs } = useValueSetContext();
	const [page, setPage] = React.useState(1);
	const [pageSize, setPageSize] = useLocalStorage<number>({
		key: PAGE_SIZE_STORAGE_KEY,
		getInitialValueInEffect: false,
		defaultValue: DEFAULT_PAGE_SIZE,
	});
	const total = expansion?.contains?.length ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	React.useEffect(() => {
		setPage(1);
	}, []);

	React.useEffect(() => {
		if (page > totalPages) setPage(totalPages);
	}, [page, totalPages]);

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="flex gap-1 items-center justify-between bg-bg-secondary pl-4 pr-2 border-b h-10 shrink-0">
				<span className="typo-label text-text-secondary">
					Expansion ({expansion?.total ?? total})
				</span>
				<div className="flex items-center gap-2">
					{expandDurationMs != null && (
						<span className="flex items-center text-text-secondary text-sm pl-2">
							<Timer className="size-4 mr-1" strokeWidth={1.5} />
							<span className="font-bold">{Math.round(expandDurationMs)}</span>
							<span className="ml-1">ms</span>
						</span>
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
			<div className="flex-1 min-h-0 flex flex-col">
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
		</div>
	);
}
