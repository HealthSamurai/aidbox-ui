import { indentWithTab } from "@codemirror/commands";
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
import {
	AsyncToggle,
	AutocommitToggle,
	LimitDropdown,
	ReadOnlyToggle,
	TimeoutDropdown,
} from "../components/db-console/result-content";
import { ResultPanel } from "../components/db-console/result-panel";
import {
	extractIndexType,
	fetchTableDetails,
	formatColumnType,
	psqlRequest,
	transformToQueryResultItems,
} from "../components/db-console/tables-view";
import {
	DEFAULT_TIMEOUT_SEC,
	type FunctionsMap,
	isAidboxError,
	type SchemaMap,
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

type SqlRunOpts = {
	autocommit: boolean;
	timeoutSec: number | null;
	readOnly: boolean;
	queryId: string;
};

function buildSqlHeaders(opts: SqlRunOpts): Record<string, string> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		Accept: "application/json",
		"X-Aidbox-Sql-Query-Id": opts.queryId,
	};
	if (opts.autocommit) headers["X-Aidbox-Sql-Autocommit"] = "true";
	if (opts.timeoutSec !== null)
		headers["X-Aidbox-Sql-Timeout"] = String(opts.timeoutSec);
	if (opts.readOnly) headers["X-Aidbox-Sql-Read-Only"] = "true";
	return headers;
}

async function fetchBlock(
	baseUrl: string,
	block: string,
	limit: number | null,
	signal: AbortSignal,
	opts: SqlRunOpts,
): Promise<QueryResultItem[]> {
	const body: { query: string; limit?: number } = { query: block };
	if (limit !== null) body.limit = limit;
	const response = await fetch(`${baseUrl}/$notebook-psql`, {
		method: "POST",
		headers: buildSqlHeaders(opts),
		credentials: "include",
		body: JSON.stringify(body),
		signal,
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`HTTP ${response.status}: ${text}`);
	}
	return transformToQueryResultItems(await response.json());
}

async function kickOffAsync(
	baseUrl: string,
	block: string,
	limit: number | null,
	signal: AbortSignal,
	opts: SqlRunOpts,
): Promise<string> {
	const body: { query: string; limit?: number } = { query: block };
	if (limit !== null) body.limit = limit;
	const headers = buildSqlHeaders(opts);
	headers["X-Aidbox-Sql-Async"] = "true";
	const response = await fetch(`${baseUrl}/$notebook-psql`, {
		method: "POST",
		headers,
		credentials: "include",
		body: JSON.stringify(body),
		signal,
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`HTTP ${response.status}: ${text}`);
	}
	const json = (await response.json()) as { "operation-id"?: string };
	const id = json["operation-id"];
	if (!id) throw new Error("Missing operation-id in async kick-off response");
	return id;
}

type AsyncStatus =
	| { status: "in-progress" }
	| { status: "completed"; result: unknown }
	| { status: "failed"; error: string }
	| { status: "not-found" };

async function fetchAsyncStatus(
	baseUrl: string,
	operationId: string,
	signal: AbortSignal,
): Promise<AsyncStatus> {
	const response = await fetch(
		`${baseUrl}/$psql/operations/${encodeURIComponent(operationId)}`,
		{
			method: "GET",
			headers: { Accept: "application/json" },
			credentials: "include",
			signal,
		},
	);
	if (response.status === 404) return { status: "not-found" };
	return (await response.json()) as AsyncStatus;
}

async function cancelAsync(
	baseUrl: string,
	operationId: string,
): Promise<void> {
	await fetch(
		`${baseUrl}/$psql/operations/${encodeURIComponent(operationId)}`,
		{ method: "DELETE", credentials: "include" },
	);
}

const TABLES_QUERY = `SELECT table_schema, table_name, table_type FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pgagent') AND table_type IN ('BASE TABLE', 'VIEW') ORDER BY table_schema, table_name`;

const FUNCTIONS_QUERY = `SELECT n.nspname AS function_schema, p.proname AS function_name, pg_get_function_identity_arguments(p.oid) AS arguments, CASE p.prokind WHEN 'f' THEN 'function' WHEN 'p' THEN 'procedure' WHEN 'a' THEN 'aggregate' WHEN 'w' THEN 'window' END AS function_type, t.typname AS return_type FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_type t ON t.oid = p.prorettype WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pgagent') ORDER BY n.nspname, p.proname`;

export const Route = createFileRoute("/db-console")({
	component: DbConsolePage,
	staticData: { title: TITLE },
	loader: () => ({ breadCrumb: TITLE }),
});

type TabResultData = {
	results: QueryResultItem[] | null;
	error: string | null;
};

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
	const [functions, setFunctions] = useState<FunctionsMap>({});

	useEffect(() => {
		let cancelled = false;

		psqlRequest<{
			table_schema: string;
			table_name: string;
			table_type: string;
		}>(client, TABLES_QUERY)
			.then((rows) => {
				if (cancelled) return;
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

		psqlRequest<{
			function_schema: string;
			function_name: string;
			arguments: string;
			function_type: string;
			return_type: string;
		}>(client, FUNCTIONS_QUERY)
			.then((rows) => {
				if (cancelled) return;
				const map: FunctionsMap = {};
				for (const row of rows) {
					const s = row.function_schema;
					if (!map[s]) map[s] = [];
					map[s].push({
						name: row.function_name,
						arguments: row.arguments,
						return_type: row.return_type,
						function_type: row.function_type,
					});
				}
				setFunctions(map);
			})
			.catch(() => {});

		return () => {
			cancelled = true;
		};
	}, [client]);

	return { schemas, functions };
}

function DbConsolePage() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();
	const { schemas, functions } = useDbConsoleData();
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
	const [timeoutSec, setTimeoutSec] = useLocalStorage<number | null>({
		key: "db-console-timeout-sec",
		defaultValue: DEFAULT_TIMEOUT_SEC,
		getInitialValueInEffect: false,
	});
	const [autocommit, setAutocommit] = useLocalStorage<boolean>({
		key: "db-console-autocommit",
		defaultValue: true,
		getInitialValueInEffect: false,
	});
	const [readOnly, setReadOnly] = useLocalStorage<boolean>({
		key: "db-console-read-only",
		defaultValue: false,
		getInitialValueInEffect: false,
	});
	const [asyncMode, setAsyncMode] = useLocalStorage<boolean>({
		key: "db-console-async-mode",
		defaultValue: false,
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

	const currentResult = tabResults.get(selectedTab?.id ?? "");
	const results = currentResult?.results ?? null;
	const error = currentResult?.error ?? null;

	const queryRef = useRef(query);
	queryRef.current = query;

	const selectedTabRef = useRef(selectedTab);
	selectedTabRef.current = selectedTab;

	const rowLimitRef = useRef(rowLimit);
	rowLimitRef.current = rowLimit;

	const timeoutRef = useRef(timeoutSec);
	timeoutRef.current = timeoutSec;

	const autocommitRef = useRef(autocommit);
	autocommitRef.current = autocommit;

	const readOnlyRef = useRef(readOnly);
	readOnlyRef.current = readOnly;

	const asyncModeRef = useRef(asyncMode);
	asyncModeRef.current = asyncMode;

	const cancelledTabRef = useRef<string | null>(null);
	const runningQueryIdRef = useRef<string | null>(null);
	const runningOperationIdRef = useRef<string | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);
	const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

	const stopPolling = useCallback(() => {
		if (pollTimeoutRef.current !== null) {
			clearTimeout(pollTimeoutRef.current);
			pollTimeoutRef.current = null;
		}
	}, []);

	const pollAsync = useCallback(
		(tabId: string, operationId: string, queryToSave: string) => {
			const baseUrl = client.getBaseUrl();
			const tick = async () => {
				if (cancelledTabRef.current === tabId) return;
				try {
					const status = await fetchAsyncStatus(
						baseUrl,
						operationId,
						new AbortController().signal,
					);
					if (cancelledTabRef.current === tabId) return;
					if (status.status === "in-progress") {
						pollTimeoutRef.current = setTimeout(tick, 1000);
						return;
					}
					stopPolling();
					runningOperationIdRef.current = null;
					setIsLoading(false);
					if (status.status === "completed") {
						const items = transformToQueryResultItems(
							status.result as Parameters<
								typeof transformToQueryResultItems
							>[0],
						);
						if (!items.some((item) => item.error)) {
							saveSqlHistory(queryToSave, queryClient, client);
						}
						updateTabResult(tabId, { results: items, error: null });
					} else if (status.status === "failed") {
						updateTabResult(tabId, { results: null, error: status.error });
					} else {
						updateTabResult(tabId, {
							results: null,
							error: "Async operation not found",
						});
					}
				} catch {
					// transient network error — keep polling
					pollTimeoutRef.current = setTimeout(tick, 1000);
				}
			};
			tick();
		},
		[client, queryClient, stopPolling, updateTabResult],
	);

	const executeQuery = useCallback(
		async (overrideQuery?: string) => {
			if (overrideQuery !== undefined) {
				handleQueryChange(overrideQuery);
			}
			const rawQuery = overrideQuery ?? queryRef.current;
			const tabId = selectedTabRef.current?.id;
			if (!tabId) return;

			if (!rawQuery.trim()) {
				updateTabResult(tabId, { results: null, error: null });
				return;
			}

			abortControllerRef.current?.abort();
			stopPolling();
			const controller = new AbortController();
			abortControllerRef.current = controller;

			const queryId = generateId();
			cancelledTabRef.current = null;
			runningQueryIdRef.current = queryId;
			runningOperationIdRef.current = null;
			setIsLoading(true);
			const queryToSave = queryRef.current;
			updateTabResult(tabId, { results: null, error: null });

			const runOpts: SqlRunOpts = {
				autocommit: autocommitRef.current,
				timeoutSec: timeoutRef.current,
				readOnly: readOnlyRef.current,
				queryId,
			};

			try {
				const baseUrl = client.getBaseUrl();

				if (asyncModeRef.current) {
					const operationId = await kickOffAsync(
						baseUrl,
						rawQuery,
						rowLimitRef.current,
						controller.signal,
						runOpts,
					);
					if (cancelledTabRef.current === tabId) return;
					runningOperationIdRef.current = operationId;
					pollAsync(tabId, operationId, queryToSave);
					return;
				}

				const allItems = await fetchBlock(
					baseUrl,
					rawQuery,
					rowLimitRef.current,
					controller.signal,
					runOpts,
				);

				if (cancelledTabRef.current === tabId) return;

				if (!allItems.some((item) => item.error)) {
					saveSqlHistory(queryToSave, queryClient, client);
				}

				updateTabResult(tabId, { results: allItems, error: null });
			} catch (err) {
				if (cancelledTabRef.current === tabId) return;
				if (err instanceof DOMException && err.name === "AbortError") return;

				const errorMsg = await extractErrorMessage(err);
				updateTabResult(tabId, { results: null, error: errorMsg });
			} finally {
				runningQueryIdRef.current = null;
				if (!asyncModeRef.current && cancelledTabRef.current !== tabId) {
					setIsLoading(false);
				}
			}
		},
		[
			client,
			queryClient,
			handleQueryChange,
			updateTabResult,
			pollAsync,
			stopPolling,
		],
	);

	const cancelQuery = useCallback(async () => {
		const tabId = selectedTabRef.current?.id;
		if (!tabId) return;

		abortControllerRef.current?.abort();
		abortControllerRef.current = null;
		stopPolling();

		const queryId = runningQueryIdRef.current;
		const operationId = runningOperationIdRef.current;
		cancelledTabRef.current = tabId;
		runningQueryIdRef.current = null;
		runningOperationIdRef.current = null;
		setIsLoading(false);
		updateTabResult(tabId, { results: null, error: "Query cancelled" });

		const baseUrl = client.getBaseUrl();
		try {
			if (operationId) {
				await cancelAsync(baseUrl, operationId);
			} else if (queryId) {
				await client.rawRequest({
					method: "POST",
					url: "/$psql-cancel",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ "query-id": queryId }),
				});
			}
		} catch {
			// best-effort cancel
		}
	}, [client, stopPolling, updateTabResult]);

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

	const handleFunctionClick = useCallback(
		async (schema: string, name: string, args: string) => {
			const s = schema.replace(/'/g, "''");
			const n = name.replace(/'/g, "''");
			const a = args.replace(/'/g, "''");
			const query = `SELECT pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace WHERE ns.nspname = '${s}' AND p.proname = '${n}' AND pg_get_function_identity_arguments(p.oid) = '${a}' LIMIT 1`;
			try {
				const rows = await psqlRequest<{ definition: string }>(client, query);
				const definition = rows[0]?.definition;
				if (definition) {
					handleHistoryItemClick(definition);
				}
			} catch {
				// ignore fetch errors
			}
		},
		[client, handleHistoryItemClick],
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
		if (!results) return undefined;
		if (results.length !== 1) return undefined;
		const r = results[0];
		if (!r?.error || !r.position) return undefined;
		let line = 1;
		for (let i = 0; i < Math.min(r.position - 1, query.length); i++) {
			if (query[i] === "\n") line++;
		}
		const msgMatch = r.error.match(/^ERROR:\s*(.+?)(?:\n|$)/);
		return [{ line, message: msgMatch?.[1] ?? r.error }];
	}, [results, query]);

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
					indentWithTab,
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
		showExplain: () => {},
		showResults: () => {},
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
			const rows = await psqlRequest<{
				pid: number;
				query: string;
				duration_seconds: number;
				usename: string;
			}>(
				client,
				`SELECT DISTINCT ON (query) pid, query, state, EXTRACT(EPOCH FROM (now() - query_start))::numeric(10,1) as duration_seconds, usename FROM pg_stat_activity WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%' AND pid != pg_backend_pid() ORDER BY query, query_start`,
			);
			return rows.map((r) => ({
				pid: r.pid,
				query: r.query,
				duration_seconds: r.duration_seconds,
				usename: r.usename,
			}));
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
			<ResizablePanelGroup
				direction="horizontal"
				className="w-full h-full"
				autoSaveId="db-console-horizontal-panel"
			>
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
						functions={functions}
						onHistoryItemClick={handleHistoryItemClick}
						onTableClick={handleHistoryItemClick}
						onFunctionClick={handleFunctionClick}
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
										<div className="flex items-center gap-2">
											<LimitDropdown
												rowLimit={rowLimit}
												onRowLimitChange={setRowLimit}
											/>
											<TimeoutDropdown
												timeoutSec={timeoutSec}
												onTimeoutChange={setTimeoutSec}
											/>
											<AutocommitToggle
												autocommit={autocommit}
												onAutocommitChange={setAutocommit}
											/>
											{/* Read-only toggle hidden — keep state wired so behavior stays on the default (read-write). Re-enable when product decides to expose it. */}
											{false && (
												<ReadOnlyToggle
													readOnly={readOnly}
													onReadOnlyChange={setReadOnly}
												/>
											)}
											<AsyncToggle
												async={asyncMode}
												onAsyncChange={setAsyncMode}
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
