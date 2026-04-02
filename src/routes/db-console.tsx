import { Prec } from "@codemirror/state";
import { type EditorView, keymap } from "@codemirror/view";
import {
	Button,
	CodeEditor,
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	Separator,
	type SqlConfig,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlignLeft, PlayIcon, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { format as formatSQL } from "sql-formatter";
import { useAidboxClient } from "../AidboxClient";
import { saveSqlHistory, useSqlHistory } from "../api/sql-history";
import {
	addSqlTab,
	DEFAULT_SQL_TAB,
	forceSelectedTab,
	SqlActiveTabs,
	type SqlTab,
} from "../components/db-console/active-tabs";
import {
	SqlLeftMenu,
	SqlLeftMenuContext,
	SqlLeftMenuToggle,
} from "../components/db-console/left-menu";
import { LimitDropdown } from "../components/db-console/result-content";
import { ResultPanel } from "../components/db-console/result-panel";
import {
	extractIndexType,
	fetchTableDetails,
	formatColumnType,
	psqlRequest,
} from "../components/db-console/tables-view";
import {
	isAidboxError,
	type SchemaMap,
	splitSqlStatements,
} from "../components/db-console/utils";
import { useLocalStorage } from "../hooks";
import { useVimMode } from "../shared/vim-mode";
import { generateId } from "../utils";
import type {
	DbConsoleActions,
	QueryResultItem,
} from "../webmcp/db-console-context";
import { useWebMCPSql } from "../webmcp/sql";

const TITLE = "SQL console";

const TABLES_QUERY = `SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pgagent') AND table_type IN ('BASE TABLE', 'VIEW') ORDER BY table_schema, table_name`;

export const Route = createFileRoute("/db-console")({
	component: DbConsolePage,
	staticData: { title: TITLE },
	loader: () => ({ breadCrumb: TITLE }),
});

type TabResultData = {
	results: QueryResultItem[] | null;
	error: string | null;
};

/** Process SQL statements to handle LIMIT logic. Returns updated query and limit state. */
function processQueryLimits(
	statements: string[],
	rowLimit: number | null,
): { query: string; hasExplicit: boolean; singleLimit?: number } {
	const allHaveLimit = statements.every((s) => /\bLIMIT\s+\d+/i.test(s));

	if (allHaveLimit) {
		const singleLimit =
			statements.length === 1
				? (statements[0]?.match(/\bLIMIT\s+(\d+)/i)?.[1] ?? undefined)
				: undefined;
		return {
			query: statements.join("\n----\n"),
			hasExplicit: true,
			singleLimit: singleLimit ? Number(singleLimit) : undefined,
		};
	}

	if (rowLimit !== null) {
		const withLimits = statements
			.map((s) =>
				/\bLIMIT\s+\d+/i.test(s) || !/^\s*SELECT\b/i.test(s)
					? s
					: `${s} LIMIT ${rowLimit}`,
			)
			.join("\n----\n");
		return { query: withLimits, hasExplicit: false };
	}

	return { query: statements.join("\n----\n"), hasExplicit: false };
}

/** Extract a human-readable error message from a caught error. */
async function extractErrorMessage(err: unknown): Promise<string> {
	if (isAidboxError(err)) {
		return err.response.text();
	}
	return err instanceof Error ? err.message : String(err);
}

function useDbConsoleData() {
	const client = useAidboxClient();
	const [schemas, setSchemas] = useState<SchemaMap>({});

	useEffect(() => {
		let cancelled = false;

		client
			.rawRequest({
				method: "POST",
				url: "/$psql",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: TABLES_QUERY }),
			})
			.then(async (res) => {
				if (cancelled || !res.response.ok) return;
				const data = await res.response.json();
				const rows: {
					table_schema: string;
					table_name: string;
					table_type: string;
				}[] = Array.isArray(data)
					? (data[0]?.result ?? [])
					: (data.result ?? []);
				const map: SchemaMap = {};
				for (const row of rows) {
					const s = row.table_schema;
					if (!map[s]) map[s] = [];
					map[s].push({
						name: row.table_name,
						type: row.table_type === "VIEW" ? "view" : "table",
					});
				}
				setSchemas(map);
			})
			.catch(() => {});

		return () => {
			cancelled = true;
		};
	}, [client]);

	return { schemas };
}

function DbConsolePage() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();
	const { schemas } = useDbConsoleData();
	const vimMode = useVimMode();

	const sqlConfig = useMemo<SqlConfig>(
		() => ({
			executeSql: async (query, _type) => {
				return psqlRequest(client, query);
			},
		}),
		[client],
	);

	const [tabs, setTabs] = useLocalStorage<SqlTab[]>({
		key: "dbConsole.tabs",
		defaultValue: [DEFAULT_SQL_TAB],
		getInitialValueInEffect: false,
	});
	const [leftMenuOpen, setLeftMenuOpen] = useLocalStorage<boolean>({
		key: "db-console-left-menu-open",
		defaultValue: true,
		getInitialValueInEffect: false,
	});
	const selectedTab = useMemo(
		() => tabs.find((t) => t.selected) || tabs[0],
		[tabs],
	);
	const query = selectedTab?.query ?? "";

	const [tabResults, setTabResults] = useState<Map<string, TabResultData>>(
		() => new Map(),
	);
	const [isLoading, setIsLoading] = useState(false);
	const [showStop, setShowStop] = useState(false);
	useEffect(() => {
		if (!isLoading) {
			setShowStop(false);
			return;
		}
		const timer = setTimeout(() => setShowStop(true), 100);
		return () => clearTimeout(timer);
	}, [isLoading]);
	const [rowLimit, setRowLimit] = useLocalStorage<number | null>({
		key: "db-console-row-limit",
		defaultValue: 10,
		getInitialValueInEffect: false,
	});
	const leftPanelRef = useRef<ImperativePanelHandle>(null);
	const resultPanelRef = useRef<ImperativePanelHandle>(null);
	const initialLeftMenuOpen = useRef(leftMenuOpen);
	useEffect(() => {
		if (!initialLeftMenuOpen.current) {
			leftPanelRef.current?.collapse();
		}
	}, []);
	const [isResultCollapsed, setIsResultCollapsed] = useState(false);
	const [isResultMaximized, setIsResultMaximized] = useState(false);
	const [resultActiveTab, setResultActiveTab] = useState("result");
	const [explainViewMode, setExplainViewModeState] = useState<"visual" | "raw">(
		() =>
			(localStorage.getItem("db-console-explain-view-mode") as
				| "visual"
				| "raw") ?? "visual",
	);
	const setExplainViewMode = (v: "visual" | "raw") => {
		localStorage.setItem("db-console-explain-view-mode", v);
		setExplainViewModeState(v);
	};

	const currentResult = tabResults.get(selectedTab?.id ?? "");
	const results = currentResult?.results ?? null;
	const error = currentResult?.error ?? null;

	const queryRef = useRef(query);
	queryRef.current = query;

	const selectedTabRef = useRef(selectedTab);
	selectedTabRef.current = selectedTab;

	const rowLimitRef = useRef(rowLimit);
	rowLimitRef.current = rowLimit;

	const cancelledTabRef = useRef<string | null>(null);
	const runningQueryRef = useRef<string | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);

	const handleQueryChange = useCallback(
		(value: string) => {
			setTabs((prev) =>
				prev.map((t) => (t.selected ? { ...t, query: value } : t)),
			);
		},
		[setTabs],
	);

	const updateTabResult = useCallback((tabId: string, data: TabResultData) => {
		setTabResults((prev) => {
			const next = new Map(prev);
			next.set(tabId, data);
			return next;
		});
	}, []);

	const executeQuery = useCallback(
		async (overrideQuery?: string) => {
			if (overrideQuery !== undefined) {
				handleQueryChange(overrideQuery);
			}
			const rawQuery = overrideQuery ?? queryRef.current;
			if (!rawQuery.trim()) return;

			const tabId = selectedTabRef.current?.id;
			if (!tabId) return;

			const statements = splitSqlStatements(rawQuery);
			const limitResult = processQueryLimits(statements, rowLimitRef.current);
			if (limitResult.singleLimit !== undefined) {
				setRowLimit(limitResult.singleLimit);
			}
			const q = limitResult.query;

			abortControllerRef.current?.abort();
			const controller = new AbortController();
			abortControllerRef.current = controller;

			cancelledTabRef.current = null;
			runningQueryRef.current = queryRef.current;
			setIsLoading(true);
			const queryToSave = queryRef.current;
			updateTabResult(tabId, { results: null, error: null });

			try {
				const baseUrl = client.getBaseUrl();
				const response = await fetch(`${baseUrl}/$psql`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					credentials: "include",
					body: JSON.stringify({ query: q }),
					signal: controller.signal,
				});

				if (cancelledTabRef.current === tabId) return;

				if (!response.ok) {
					const text = await response.text();
					updateTabResult(tabId, {
						results: null,
						error: `HTTP ${response.status}: ${text}`,
					});
					return;
				}

				const data = await response.json();
				const items: QueryResultItem[] = Array.isArray(data) ? data : [data];
				if (!items.some((item) => item.error)) {
					saveSqlHistory(queryToSave, queryClient, client);
				}

				updateTabResult(tabId, { results: items, error: null });
			} catch (err) {
				if (cancelledTabRef.current === tabId) return;
				if (err instanceof DOMException && err.name === "AbortError") return;

				const errorMsg = await extractErrorMessage(err);
				updateTabResult(tabId, { results: null, error: errorMsg });
			} finally {
				if (cancelledTabRef.current !== tabId) {
					setIsLoading(false);
				}
				runningQueryRef.current = null;
			}
		},
		[client, queryClient, setRowLimit, handleQueryChange, updateTabResult],
	);

	const cancelQuery = useCallback(async () => {
		const tabId = selectedTabRef.current?.id;
		if (!tabId) return;

		abortControllerRef.current?.abort();
		abortControllerRef.current = null;

		const queryText = runningQueryRef.current;
		cancelledTabRef.current = tabId;
		runningQueryRef.current = null;
		setIsLoading(false);
		updateTabResult(tabId, { results: null, error: "Query cancelled" });

		if (queryText) {
			try {
				const escaped = queryText.slice(0, 200).replace(/'/g, "''");
				await client.rawRequest({
					method: "POST",
					url: "/$psql",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						query: `SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query LIKE '%${escaped}%' AND pid != pg_backend_pid()`,
					}),
				});
			} catch {
				// best-effort cancel
			}
		}
	}, [client, updateTabResult]);

	const { data: historyData } = useSqlHistory();

	const handleHistoryItemClick = useCallback(
		(command: string) => {
			setTabs((prev) => {
				const existing = prev.find((t) => t.query === command);
				if (existing) {
					return prev.map((t) => ({ ...t, selected: t.id === existing.id }));
				}
				const newTab: SqlTab = {
					id: generateId(),
					query: command,
					selected: true,
				};
				return [...prev.map((t) => ({ ...t, selected: false })), newTab];
			});
		},
		[setTabs],
	);

	const handleTabsRemoved = useCallback((tabIds: string[]) => {
		setTabResults((prev) => {
			const next = new Map(prev);
			for (const id of tabIds) {
				next.delete(id);
			}
			return next;
		});
	}, []);

	const issueLineNumbers = useMemo(() => {
		const issues: { line: number; message: string }[] = [];

		const parseError = (err: string, charOffset: number) => {
			const posMatch = err.match(/Position:\s*(\d+)/);
			if (!posMatch) return;
			const charPos = Number.parseInt(posMatch[1] ?? "", 10);
			if (Number.isNaN(charPos) || charPos < 1) return;
			const absPos = charOffset + charPos;
			let line = 1;
			for (let i = 0; i < Math.min(absPos - 1, query.length); i++) {
				if (query[i] === "\n") line++;
			}
			const msgMatch = err.match(/^ERROR:\s*(.+?)(?:\n|$)/);
			issues.push({ line, message: msgMatch ? (msgMatch[1] ?? err) : err });
		};

		if (error) parseError(error, 0);

		if (results) {
			const statementOffsets = [0];
			const delimiterRegex = /----|\s*;\s*/g;
			let match: RegExpExecArray | null = delimiterRegex.exec(query);
			while (match !== null) {
				let end = match.index + match[0].length;
				while (end < query.length && query[end] === "\n") end++;
				statementOffsets.push(end);
				match = delimiterRegex.exec(query);
			}

			for (let i = 0; i < results.length; i++) {
				const r = results[i];
				if (!r) continue;
				if (r.error) {
					parseError(r.error, statementOffsets[i] ?? 0);
				}
			}
		}

		return issues.length > 0 ? issues : undefined;
	}, [results, error, query]);

	const editorViewRef = useRef<EditorView | null>(null);

	const onEditorView = useCallback((view: EditorView) => {
		editorViewRef.current = view;
		requestAnimationFrame(() => view.focus());
	}, []);

	const formatQuery = useCallback(() => {
		try {
			const formatted = formatSQL(query, {
				language: "postgresql",
				indentStyle: "tabularRight",
			});
			handleQueryChange(formatted);
			const view = editorViewRef.current;
			if (view) {
				view.dispatch({
					changes: { from: 0, to: view.state.doc.length, insert: formatted },
				});
			}
		} catch {
			// ignore formatting errors
		}
	}, [query, handleQueryChange]);

	const sqlEditorExtensions = useMemo(
		() => [
			Prec.highest(
				keymap.of([
					{
						key: "Mod-Enter",
						run: () => {
							executeQuery();
							return true;
						},
					},
					{
						key: "Mod-j",
						run: () => {
							const panel = resultPanelRef.current;
							if (!panel) return false;
							if (panel.isCollapsed()) {
								panel.expand();
							} else {
								panel.collapse();
							}
							return true;
						},
					},
					{
						key: "Mod-Shift-f",
						run: () => {
							formatQuery();
							return true;
						},
					},
				]),
			),
		],
		[executeQuery, formatQuery],
	);

	const setLS = useCallback((key: string, value: unknown) => {
		localStorage.setItem(key, JSON.stringify(value));
		window.dispatchEvent(
			new CustomEvent("local-storage", { detail: { key, value } }),
		);
	}, []);

	const openSidebar = useCallback(() => {
		setLeftMenuOpen(true);
		leftPanelRef.current?.expand();
	}, [setLeftMenuOpen]);

	const dbConsoleActionsRef = useRef({} as DbConsoleActions);
	const syncEditor = (sql: string) => {
		handleQueryChange(sql);
		const view = editorViewRef.current;
		if (view) {
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: sql },
			});
		}
	};

	dbConsoleActionsRef.current = {
		executeQuery: (sql) => {
			syncEditor(sql);
			executeQuery(sql);
		},
		setQuery: syncEditor,
		getQuery: () => query,
		runCurrentQuery: () => executeQuery(),
		formatSql: formatQuery,
		getTabs: () =>
			tabs.map((t) => ({ id: t.id, query: t.query, selected: !!t.selected })),
		selectTab: (tabId) =>
			setTabs((prev) => prev.map((t) => ({ ...t, selected: t.id === tabId }))),
		addTab: () => addSqlTab(tabs, setTabs),
		duplicateTab: (tabId) => {
			const tab = tabs.find((t) => t.id === tabId);
			if (!tab) return;
			const newTab = { ...tab, id: generateId(), selected: true };
			setTabs([...tabs.map((t) => ({ ...t, selected: false })), newTab]);
		},
		closeTab: (tabId) => {
			const newTabs = tabs.filter((t) => t.id !== tabId);
			if (newTabs.length === 0) {
				setTabs([{ ...DEFAULT_SQL_TAB, id: generateId() }]);
			} else {
				const removedIndex = tabs.findIndex((t) => t.id === tabId);
				const needsSelect = tabs.find((t) => t.id === tabId)?.selected;
				if (needsSelect) {
					const targetIndex = Math.min(
						Math.max(removedIndex - 1, 0),
						newTabs.length - 1,
					);
					setTabs(
						newTabs.map((t, i) => ({ ...t, selected: i === targetIndex })),
					);
				} else {
					setTabs(newTabs);
				}
			}
		},
		closeOtherTabs: (tabId) => {
			const tab = tabs.find((t) => t.id === tabId);
			if (tab) setTabs([{ ...tab, selected: true }]);
		},
		closeTabsToLeft: (tabId) => {
			const idx = tabs.findIndex((t) => t.id === tabId);
			if (idx < 0) return;
			setTabs(forceSelectedTab(tabs.slice(idx), 0));
		},
		closeTabsToRight: (tabId) => {
			const idx = tabs.findIndex((t) => t.id === tabId);
			if (idx < 0) return;
			setTabs(forceSelectedTab(tabs.slice(0, idx + 1), idx));
		},
		openSidebar,
		openSidebarTab: (tab) => {
			openSidebar();
			setLS("db-console-left-menu-default-tab", tab);
		},
		selectTable: (schema, name) => {
			openSidebar();
			setLS("db-console-left-menu-default-tab", "tables");
			setLS("db-console-selected-table", { schema, name });
		},
		expandResults: () => resultPanelRef.current?.expand(),
		collapseResults: () => resultPanelRef.current?.collapse(),
		maximizeResults: () => setIsResultMaximized(true),
		minimizeResults: () => setIsResultMaximized(false),
		showExplain: (mode) => {
			setResultActiveTab("explain");
			if (mode) setExplainViewMode(mode);
		},
		showResults: () => setResultActiveTab("result"),
		getQueryStatus: () => {
			if (isLoading) return { status: "loading" };
			if (currentResult?.error)
				return { status: "error", error: currentResult.error };
			if (currentResult?.results) return { status: "ready" };
			return { status: "empty" };
		},
		getResults: (limit) => {
			const items = currentResult?.results ?? [];
			return limit ? items.slice(0, limit) : items;
		},
		getActiveQueries: async () => {
			const rows = await psqlRequest(
				client,
				`SELECT DISTINCT ON (query) pid, query, state, EXTRACT(EPOCH FROM (now() - query_start))::numeric(10,1) as duration_seconds, usename FROM pg_stat_activity WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%' AND pid != pg_backend_pid() ORDER BY query, query_start`,
			);
			return rows.map(
				(r: {
					pid: number;
					query: string;
					duration_seconds: number;
					usename: string;
				}) => ({
					pid: r.pid,
					query: r.query,
					duration_seconds: r.duration_seconds,
					usename: r.usename,
				}),
			);
		},
		cancelQuery: async (pid) => {
			await psqlRequest(client, `SELECT pg_cancel_backend(${pid})`);
		},
		dropIndex: async (indexName) => {
			const escaped = indexName.replace(/'/g, "''");
			await psqlRequest(client, `DROP INDEX IF EXISTS "${escaped}"`);
		},
		getTableInfo: async (schema, name) => {
			const d = await fetchTableDetails(client, schema, name);
			return {
				columns: d.columns.map((c) => ({
					name: c.column_name,
					type: formatColumnType(c),
					nullable: c.is_nullable === "YES",
				})),
				indexes: d.indexes.map((idx) => ({
					name: idx.indexname,
					type: extractIndexType(idx.indexdef),
					definition: idx.indexdef,
				})),
				rowCount: d.rowCount,
				tableSize: d.tableSize,
				indexesSize: d.indexesSize,
			};
		},
		getRowLimit: () => rowLimit,
		setRowLimit,
		getHistory: (search, limit) => {
			const entries = (historyData?.entry ?? []).flatMap((e) => {
				const r = e.resource;
				if (r?.resourceType !== "ui_history") return [];
				return {
					command: (r as unknown as { command: string }).command,
					timestamp: r.meta?.lastUpdated ?? "",
				};
			});
			const filtered = search
				? entries.filter((e) =>
						e.command.toLowerCase().includes(search.toLowerCase()),
					)
				: entries;
			return limit ? filtered.slice(0, limit) : filtered;
		},
		openHistoryEntry: handleHistoryItemClick,
		getSchemas: () => schemas,
	};

	useWebMCPSql(dbConsoleActionsRef);

	return (
		<SqlLeftMenuContext value={leftMenuOpen ? "open" : "close"}>
			<ResizablePanelGroup direction="horizontal" className="w-full h-full" autoSaveId="db-console-horizontal-panel">
				<ResizablePanel
					ref={leftPanelRef}
					defaultSize={20}
					minSize={20}
					maxSize={80}
					collapsible
					collapsedSize={0}
					onCollapse={() => setLeftMenuOpen(false)}
					onExpand={() => setLeftMenuOpen(true)}
				>
					<SqlLeftMenu
						schemas={schemas}
						onHistoryItemClick={handleHistoryItemClick}
						onTableClick={handleHistoryItemClick}
					/>
				</ResizablePanel>
				{leftMenuOpen && <ResizableHandle />}
				<ResizablePanel defaultSize={80} minSize={40}>
					<div className="flex flex-col h-full min-w-0">
						<div className="flex h-10 w-full border-b">
							<SqlLeftMenuToggle
								onClose={() => leftPanelRef.current?.collapse()}
								onOpen={() => leftPanelRef.current?.expand()}
							/>
							<div className="grow min-w-0">
								<SqlActiveTabs
									tabs={tabs}
									setTabs={setTabs}
									onTabsRemoved={handleTabsRemoved}
								/>
							</div>
						</div>
						<ResizablePanelGroup
							direction="vertical"
							className="flex-1 min-h-0"
							autoSaveId="db-console-vertical-panel"
						>
							<ResizablePanel defaultSize={40} minSize={10}>
								<div className="flex flex-col h-full">
									<div className="flex items-center bg-bg-secondary flex-none h-10 border-b">
										<Tooltip delayDuration={300}>
											<TooltipTrigger asChild>
												<Button
													variant="link"
													className="h-full! flex-shrink-0 border-b-0 rounded-none!"
													onClick={formatQuery}
													disabled={!query.trim()}
												>
													<AlignLeft className="w-4 h-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent side="bottom">
												Format{" "}
												{navigator.platform?.includes("Mac")
													? "⌘+⇧+F"
													: "Ctrl+Shift+F"}
											</TooltipContent>
										</Tooltip>
										<Separator orientation="vertical" className="h-6!" />
										<div className="w-[84px] h-full flex items-center justify-start">
											{showStop ? (
												<Button
													variant="link"
													size="regular"
													className="text-text-error-primary! pl-2.5 pr-3 h-full! rounded-none!"
													onClick={cancelQuery}
												>
													<Square className="w-3.5 h-3.5 fill-current" />
													STOP
												</Button>
											) : (
												<Tooltip delayDuration={300}>
													<TooltipTrigger asChild>
														<Button
															variant="link"
															size="regular"
															className="text-text-link! pl-2.5 pr-3 h-full! rounded-none!"
															onClick={() => executeQuery()}
															disabled={!query.trim()}
														>
															<PlayIcon className="w-4 h-4 fill-current text-text-link" />
															RUN
														</Button>
													</TooltipTrigger>
													<TooltipContent side="bottom">
														{navigator.platform?.includes("Mac")
															? "⌘+Enter"
															: "Ctrl+Enter"}
													</TooltipContent>
												</Tooltip>
											)}
										</div>
										<div>
											<LimitDropdown
												rowLimit={rowLimit}
												onRowLimitChange={setRowLimit}
											/>
										</div>
									</div>
									<div className="flex-1 min-h-0">
										<CodeEditor
											key={selectedTab?.id}
											mode="sql"
											defaultValue={query}
											onChange={handleQueryChange}
											additionalExtensions={sqlEditorExtensions}
											sql={sqlConfig}
											viewCallback={onEditorView}
											foldGutter={false}
											issueLineNumbers={issueLineNumbers}
											vimMode={vimMode}
										/>
									</div>
								</div>
							</ResizablePanel>

							{(results || error || isLoading) && (
								<>
									<ResizableHandle />

									<ResizablePanel
										ref={resultPanelRef}
										defaultSize={60}
										minSize={10}
										collapsible
										collapsedSize={5}
										onCollapse={() => setIsResultCollapsed(true)}
										onExpand={() => setIsResultCollapsed(false)}
									>
										<ResultPanel
											key={selectedTab?.id}
											results={results}
											error={error}
											isLoading={isLoading}
											onRun={executeQuery}
											onCancel={cancelQuery}
											query={query}
											collapsed={isResultCollapsed}
											onToggleCollapse={() => {
												const panel = resultPanelRef.current;
												if (!panel) return;
												if (panel.isCollapsed()) {
													panel.expand();
												} else {
													panel.collapse();
												}
											}}
											isMaximized={isResultMaximized}
											setIsMaximized={setIsResultMaximized}
											activeTab={resultActiveTab}
											setActiveTab={setResultActiveTab}
											explainViewMode={explainViewMode}
											setExplainViewMode={setExplainViewMode}
										/>
									</ResizablePanel>
								</>
							)}
						</ResizablePanelGroup>
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</SqlLeftMenuContext>
	);
}
