import {
	Button,
	SegmentControl,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import {
	Maximize2,
	Minimize2,
	PanelBottomClose,
	PanelBottomOpen,
	Timer,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { QueryResultItem } from "../../webmcp/db-console-context";
import { ChartPanel } from "../notebook-chart/chart-panel";
import { ExportDropdown, ResultContent } from "./result-content";

export function ResultPanel({
	results,
	error,
	asyncStarted,
	isLoading,
	onRun,
	onCancel,
	collapsed,
	onToggleCollapse,
	isMaximized,
	setIsMaximized,
}: {
	results: QueryResultItem[] | null;
	error: string | null;
	asyncStarted?: { operationId: string; startedAt: number };
	isLoading: boolean;
	onRun: () => void;
	onCancel: () => void;
	collapsed: boolean;
	onToggleCollapse: () => void;
	isMaximized: boolean;
	setIsMaximized: (v: boolean) => void;
}) {
	const [viewMode, setViewModeState] = useState<"table" | "list" | "chart">(
		() =>
			(localStorage.getItem("db-console-result-view-mode") as
				| "table"
				| "list"
				| "chart") ?? "table",
	);
	const setViewMode = (v: "table" | "list" | "chart") => {
		localStorage.setItem("db-console-result-view-mode", v);
		setViewModeState(v);
	};

	useEffect(() => {
		if (!isMaximized) return;
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") setIsMaximized(false);
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [isMaximized, setIsMaximized]);

	const totalRows = useMemo(
		() =>
			results
				? results.reduce((sum, r) => sum + (r.result?.length ?? 0), 0)
				: 0,
		[results],
	);

	const totalDuration = useMemo(
		() =>
			results ? results.reduce((sum, r) => sum + (r.duration ?? 0), 0) : null,
		[results],
	);

	const chartData = useMemo(() => {
		const first = results?.find((r) => !r.error && (r.result?.length ?? 0) > 0);
		if (!first?.result) return null;
		const recs = first.result;
		const cols = Array.from(new Set(recs.flatMap((r) => Object.keys(r))));
		return { columns: cols, rows: recs.map((rec) => cols.map((c) => rec[c])) };
	}, [results]);

	return (
		<div
			className={`flex flex-col h-full ${isMaximized ? "absolute top-0 left-0 w-full h-full z-30 bg-bg-primary" : ""}`}
		>
			<div className="flex items-center justify-between bg-bg-secondary pr-2 border-b">
				<div className="pl-4 flex items-center h-10">
					<span className="typo-label text-text-secondary">
						Result ({totalRows})
					</span>
				</div>
				<div className="flex items-center gap-2">
					{totalDuration !== null && results && results.length > 0 && (
						<span className="flex items-center text-text-secondary text-sm pl-2">
							<Timer className="size-4 mr-1" strokeWidth={1.5} />
							<span className="font-bold">{Math.round(totalDuration)}</span>
							<span className="ml-1">ms</span>
						</span>
					)}
					<SegmentControl
						value={viewMode}
						onValueChange={(v) => setViewMode(v as "table" | "list" | "chart")}
						items={[
							{ value: "table", label: "Table" },
							{ value: "list", label: "List" },
							{ value: "chart", label: "Chart" },
						]}
					/>
					<ExportDropdown
						results={results ?? []}
						disabled={!results || totalRows === 0}
					/>
					{!isMaximized && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="small"
									onClick={() => {
										if (!collapsed) setIsMaximized(false);
										onToggleCollapse();
									}}
								>
									{collapsed ? (
										<PanelBottomOpen className="w-4 h-4" />
									) : (
										<PanelBottomClose className="w-4 h-4" />
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent align="end">
								<span className="flex items-center gap-1.5">
									{collapsed ? "Expand" : "Collapse"}
									<kbd className="inline-flex items-center gap-0.5 rounded bg-bg-tertiary px-1 py-0.5 text-xs font-medium text-text-secondary">
										⌘J
									</kbd>
								</span>
							</TooltipContent>
						</Tooltip>
					)}
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="small"
								onClick={() => setIsMaximized(!isMaximized)}
							>
								{isMaximized ? (
									<Minimize2 className="w-4 h-4" />
								) : (
									<Maximize2 className="w-4 h-4" />
								)}
							</Button>
						</TooltipTrigger>
						<TooltipContent align="end">
							{isMaximized ? "Minimize" : "Maximize"}
						</TooltipContent>
					</Tooltip>
				</div>
			</div>
			{!collapsed &&
				(asyncStarted ? (
					<div className="flex-1 flex items-center justify-center bg-bg-secondary">
						<div className="text-center px-6 py-8">
							<div className="typo-label text-text-primary mb-2">
								Query started in background
							</div>
							<div className="typo-body-xs text-text-secondary">
								Operation ID:{" "}
								<span className="typo-code">{asyncStarted.operationId}</span>
							</div>
						</div>
					</div>
				) : viewMode === "chart" ? (
					chartData ? (
						<div className="flex-1 min-h-0">
							<ChartPanel
								columns={chartData.columns}
								rows={chartData.rows}
								editable
								fullHeight
							/>
						</div>
					) : (
						<div className="flex-1 flex items-center justify-center bg-bg-secondary text-text-secondary">
							No data to chart
						</div>
					)
				) : (
					<ResultContent
						results={results}
						error={error}
						isLoading={isLoading}
						onRun={onRun}
						onCancel={onCancel}
						viewMode={viewMode}
					/>
				))}
		</div>
	);
}
