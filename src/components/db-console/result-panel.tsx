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
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { QueryResultItem } from "../../webmcp/db-console-context";
import { ExportDropdown, ResultContent } from "./result-content";

export function ResultPanel({
	results,
	error,
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
	isLoading: boolean;
	onRun: () => void;
	onCancel: () => void;
	collapsed: boolean;
	onToggleCollapse: () => void;
	isMaximized: boolean;
	setIsMaximized: (v: boolean) => void;
}) {
	const [viewMode, setViewModeState] = useState<"table" | "list">(
		() =>
			(localStorage.getItem("db-console-result-view-mode") as
				| "table"
				| "list") ?? "table",
	);
	const setViewMode = (v: "table" | "list") => {
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
					<SegmentControl
						value={viewMode}
						onValueChange={(v) => setViewMode(v as "table" | "list")}
						items={[
							{ value: "table", label: "Table" },
							{ value: "list", label: "List" },
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
			{!collapsed && (
				<ResultContent
					results={results}
					error={error}
					isLoading={isLoading}
					onRun={onRun}
					onCancel={onCancel}
					viewMode={viewMode}
				/>
			)}
		</div>
	);
}
