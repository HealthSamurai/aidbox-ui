import {
	Button,
	SegmentControl,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAidboxClient } from "../../AidboxClient";
import type { QueryResultItem } from "../../webmcp/db-console-context";
import {
	ExplainContent,
	type ExplainData,
	type ExplainJSON,
	flattenPlanNode,
} from "./explain";
import { ExportDropdown, ResultContent } from "./result-content";
import { isAidboxError, splitSqlStatements } from "./utils";

export function ResultPanel({
	results,
	error,
	isLoading,
	onRun,
	onCancel,
	query,
	collapsed,
	onToggleCollapse,
	isMaximized,
	setIsMaximized,
	activeTab,
	setActiveTab,
	explainViewMode,
	setExplainViewMode,
}: {
	results: QueryResultItem[] | null;
	error: string | null;
	isLoading: boolean;
	onRun: () => void;
	onCancel: () => void;
	query: string;
	collapsed: boolean;
	onToggleCollapse: () => void;
	isMaximized: boolean;
	setIsMaximized: (v: boolean) => void;
	activeTab: string;
	setActiveTab: (tab: string) => void;
	explainViewMode: "visual" | "raw";
	setExplainViewMode: (mode: "visual" | "raw") => void;
}) {
	const client = useAidboxClient();
	const [resultViewMode, setResultViewModeState] = useState<"table" | "list">(
		() =>
			(localStorage.getItem("db-console-result-view-mode") as
				| "table"
				| "list") ?? "table",
	);
	const setResultViewMode = (v: "table" | "list") => {
		localStorage.setItem("db-console-result-view-mode", v);
		setResultViewModeState(v);
	};
	const [explainResults, setExplainResults] = useState<
		(ExplainData | string)[] | null
	>(null);
	const [explainLoading, setExplainLoading] = useState(false);
	const [explainError, setExplainError] = useState<string | null>(null);
	const queryRef = useRef(query);
	queryRef.current = query;
	const explainCancelledRef = useRef(false);
	const explainAbortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		if (!isMaximized) return;
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") setIsMaximized(false);
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [isMaximized, setIsMaximized]);

	const runExplainForStatement = useCallback(
		async (q: string, signal: AbortSignal): Promise<ExplainData | string> => {
			const baseUrl = client.getBaseUrl();
			const fetchPsql = (sql: string) =>
				fetch(`${baseUrl}/$psql`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					credentials: "include",
					body: JSON.stringify({ query: sql }),
					signal,
				});

			const [jsonResponse, textResponse] = await Promise.all([
				fetchPsql(`EXPLAIN (ANALYZE, COSTS, BUFFERS, FORMAT JSON) ${q}`),
				fetchPsql(`EXPLAIN (ANALYZE, COSTS, BUFFERS) ${q}`),
			]);

			if (!jsonResponse.ok) {
				const text = await jsonResponse.text();
				throw new Error(`HTTP ${jsonResponse.status}: ${text}`);
			}

			const textData = await textResponse.json();
			const textRows: Record<string, unknown>[] = Array.isArray(textData)
				? (textData[0]?.result ?? [])
				: (textData.result ?? []);
			const rawText = textRows
				.map((r: Record<string, unknown>) => Object.values(r)[0])
				.join("\n");

			const data = await jsonResponse.json();
			const rows: Record<string, unknown>[] = Array.isArray(data)
				? (data[0]?.result ?? [])
				: (data.result ?? []);

			try {
				const rawValue = Object.values(rows[0] ?? {})[0];
				const planJson: ExplainJSON[] =
					typeof rawValue === "string"
						? JSON.parse(rawValue)
						: (rawValue as ExplainJSON[]);

				if (Array.isArray(planJson) && planJson[0]?.Plan) {
					const explain = planJson[0];
					const items: Record<
						string,
						import("@health-samurai/react-components").TreeViewItem<
							import("./explain").PlanNodeMeta
						>
					> = {};
					const allNodeIds: string[] = [];

					flattenPlanNode(
						explain.Plan,
						explain["Execution Time"],
						"plan-0",
						items,
						allNodeIds,
					);
					items.root = { name: "root", children: ["plan-0"] };

					return {
						planningTime: explain["Planning Time"],
						executionTime: explain["Execution Time"],
						items,
						allNodeIds,
						rawText,
					};
				}
			} catch {
				// Fall through to text fallback
			}

			return rawText;
		},
		[client],
	);

	const runExplain = useCallback(async () => {
		const statements = splitSqlStatements(queryRef.current)
			.map((s) =>
				s.trim().replace(/\s+LIMIT\s+\d+\s*(?:OFFSET\s+\d+\s*)?;?\s*$/i, ""),
			)
			.filter(Boolean);
		if (statements.length === 0) return;
		explainAbortRef.current?.abort();
		const controller = new AbortController();
		explainAbortRef.current = controller;

		explainCancelledRef.current = false;
		setExplainLoading(true);
		setExplainError(null);
		setExplainResults(null);
		try {
			const results = await Promise.all(
				statements.map((s) => runExplainForStatement(s, controller.signal)),
			);
			if (explainCancelledRef.current) return;
			setExplainResults(results);
		} catch (err) {
			if (explainCancelledRef.current) return;
			if (err instanceof DOMException && err.name === "AbortError") return;

			if (isAidboxError(err)) {
				const text = await err.response.text();
				setExplainError(text);
			} else {
				setExplainError(err instanceof Error ? err.message : String(err));
			}
		} finally {
			if (!explainCancelledRef.current) {
				setExplainLoading(false);
			}
		}
	}, [runExplainForStatement]);

	const cancelExplain = useCallback(async () => {
		const q = queryRef.current.trim();
		explainAbortRef.current?.abort();
		explainAbortRef.current = null;
		explainCancelledRef.current = true;
		setExplainLoading(false);
		setExplainError("EXPLAIN cancelled");

		if (q) {
			try {
				const escaped = q.slice(0, 150).replace(/'/g, "''");
				await client.rawRequest({
					method: "POST",
					url: "/$psql",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						query: `SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query LIKE '%EXPLAIN%${escaped}%' AND pid != pg_backend_pid()`,
					}),
				});
			} catch {
				// best-effort cancel
			}
		}
	}, [client]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-run explain when main query results change
	useEffect(() => {
		if (activeTab === "explain") {
			runExplain();
		}
	}, [activeTab, runExplain, results]);

	const totalRows = useMemo(
		() =>
			results
				? results.reduce((sum, r) => sum + (r.result?.length ?? 0), 0)
				: 0,
		[results],
	);

	return (
		<Tabs
			value={activeTab}
			onValueChange={setActiveTab}
			className={`flex flex-col h-full ${isMaximized ? "absolute top-0 left-0 w-full h-full z-30 bg-bg-primary" : ""}`}
		>
			<div className="flex items-center justify-between bg-bg-secondary pr-2 border-b">
				<TabsList className="pl-2">
					<TabsTrigger value="result">
						Result ({totalRows})
					</TabsTrigger>
					<TabsTrigger value="explain">Explain</TabsTrigger>
				</TabsList>
				<div className="flex items-center gap-2">
					{activeTab === "result" && (
						<>
							<SegmentControl
								value={resultViewMode}
								onValueChange={(v) => setResultViewMode(v as "table" | "list")}
								items={[
									{ value: "table", label: "Table" },
									{ value: "list", label: "List" },
								]}
							/>
							<ExportDropdown results={results ?? []} disabled={!results || totalRows === 0} />
						</>
					)}
					{activeTab === "explain" && (
						<SegmentControl
							value={explainViewMode}
							onValueChange={(v) => setExplainViewMode(v as "visual" | "raw")}
							items={[
								{ value: "visual", label: "Visual" },
								{ value: "raw", label: "Raw" },
							]}
						/>
					)}
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
				<>
					<TabsContent
						value="result"
						className="flex flex-col flex-1 min-h-0 overflow-hidden mt-0"
					>
						<ResultContent
							results={results}
							error={error}
							isLoading={isLoading}
							onRun={onRun}
							onCancel={onCancel}
							viewMode={resultViewMode}
						/>
					</TabsContent>
					<TabsContent
						value="explain"
						className="flex flex-col flex-1 min-h-0 overflow-hidden mt-0"
					>
						<ExplainContent
							results={explainResults}
							error={explainError}
							isLoading={explainLoading}
							onCancel={cancelExplain}
							viewMode={explainViewMode}
						/>
					</TabsContent>
				</>
			)}
		</Tabs>
	);
}
