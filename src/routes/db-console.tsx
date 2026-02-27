import {
	autocompletion,
	type CompletionContext,
	type CompletionResult,
	type CompletionSource,
} from "@codemirror/autocomplete";
import { EditorState, type Extension, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import type * as AidboxTypes from "@health-samurai/aidbox-client";
import {
	Button,
	ButtonDropdown,
	CodeEditor,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	SegmentControl,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Tabs,
	TabsList,
	TabsTrigger,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	TreeView,
	type TreeViewItem,
} from "@health-samurai/react-components";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlignLeft,
	ChevronDown,
	Download,
	Loader2,
	Maximize2,
	Minimize2,
	PanelBottomClose,
	PanelBottomOpen,
	PlayIcon,
	Square,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { format as formatSQL } from "sql-formatter";
import { useAidboxClient } from "../AidboxClient";
import { fetchSchemas } from "../api/schemas";
import { saveSqlHistory } from "../api/sql-history";
import {
	DEFAULT_SQL_TAB,
	SqlActiveTabs,
	type SqlTab,
} from "../components/db-console/active-tabs";
import {
	buildFhirPathChildren,
	type ColumnMap,
	columnCompletionExtension,
	type FhirPathChildren,
	isInJsonbContext,
	isInsideString,
	type JsonbColumnMap,
	jsonbCompletionExtension,
	transformToAidboxFormat,
} from "../components/db-console/jsonb-completion";
import {
	SqlLeftMenu,
	SqlLeftMenuContext,
	SqlLeftMenuToggle,
} from "../components/db-console/left-menu";
import { EmptyState } from "../components/empty-state";
import { useLocalStorage } from "../hooks";

const TITLE = "DB Console";

const TABLES_QUERY = `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pgagent') AND table_type = 'BASE TABLE' ORDER BY table_schema, table_name`;

const JSONB_COLUMNS_QUERY = `SELECT c.table_schema, c.table_name, c.column_name FROM information_schema.columns c JOIN information_schema.tables t ON c.table_schema = t.table_schema AND c.table_name = t.table_name WHERE t.table_type = 'BASE TABLE' AND c.table_schema NOT IN ('pg_catalog', 'information_schema', 'pgagent') AND c.udt_name = 'jsonb'`;

const FUNCTIONS_QUERY = `SELECT DISTINCT p.proname AS name FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e' WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND d.objid IS NULL ORDER BY p.proname`;

const COLUMNS_QUERY = `SELECT c.table_schema, c.table_name, c.column_name, c.data_type FROM information_schema.columns c JOIN information_schema.tables t ON c.table_schema = t.table_schema AND c.table_name = t.table_name WHERE t.table_type = 'BASE TABLE' AND c.table_schema NOT IN ('pg_catalog', 'information_schema', 'pgagent') ORDER BY c.table_schema, c.table_name, c.ordinal_position`;

const LIMIT_PRESETS = [10, 100, 1000];

function splitSqlStatements(query: string): string[] {
	return query
		.split("----")
		.map((s) => s.trim())
		.filter(Boolean);
}

const SQL_TABLE_KEYWORDS =
	/\b(?:from|join|inner\s+join|left\s+join|right\s+join|full\s+join|cross\s+join|into|update|table)\s+$/i;

type SchemaMap = Record<string, string[]>;

function tableCompletionExtension(schemas: SchemaMap): Extension {
	const source = (context: CompletionContext): CompletionResult | null => {
		const line = context.state.doc.lineAt(context.pos);
		const textBefore = line.text.slice(0, context.pos - line.from);

		if (isInsideString(textBefore)) return null;

		// Case 1: user typed "schema." — suggest tables from that schema
		const schemaDot = textBefore.match(/(\w+)\.(\w*)$/);
		if (schemaDot) {
			const schemaName = schemaDot[1];
			const tables = schemas[schemaName];
			if (!tables) return null;
			return {
				from: context.pos - schemaDot[2].length,
				options: tables.map((t) => ({ label: t, type: "table" })),
			};
		}

		// Case 2: after a SQL keyword, suggest schema-qualified tables
		const word = context.matchBefore(/\w*/);
		if (!word) return null;

		const beforeWord = textBefore.slice(0, word.from - line.from);
		if (!SQL_TABLE_KEYWORDS.test(beforeWord) && !context.explicit) return null;

		const options: { label: string; type: string; detail?: string }[] = [];

		for (const [schema, tables] of Object.entries(schemas)) {
			options.push({ label: `${schema}.`, type: "keyword", detail: "schema" });
			for (const table of tables) {
				if (schema === "public") {
					options.push({ label: table, type: "table" });
				} else {
					options.push({
						label: `${schema}.${table}`,
						type: "table",
						detail: schema,
					});
				}
			}
		}

		return { from: word.from, options };
	};

	return EditorState.languageData.of(() => [{ autocomplete: source }]);
}

export const Route = createFileRoute("/db-console")({
	component: DbConsolePage,
	staticData: { title: TITLE },
	loader: () => ({ breadCrumb: TITLE }),
});

type QueryResultItem = {
	query: string;
	duration: number;
	result: Record<string, unknown>[];
	rows: number;
	status: string;
	error?: string;
};

type PlanNodeMeta = {
	nodeType: string;
	relation?: string;
	actualTime: number;
	actualRows: number;
	planRows: number;
	totalCost: number;
	sharedHitBlocks?: number;
	sharedReadBlocks?: number;
	filter?: string;
	indexName?: string;
	loops: number;
	timePercent: number;
	rowsRemovedByFilter?: number;
	rowsRemovedByJoinFilter?: number;
};

type RawPlanNode = {
	"Node Type": string;
	"Relation Name"?: string;
	"Index Name"?: string;
	Filter?: string;
	"Index Cond"?: string;
	"Hash Cond"?: string;
	"Join Filter"?: string;
	"Merge Cond"?: string;
	"Total Cost": number;
	"Plan Rows": number;
	"Actual Total Time": number;
	"Actual Rows": number;
	"Actual Loops": number;
	"Shared Hit Blocks"?: number;
	"Shared Read Blocks"?: number;
	"Rows Removed by Filter"?: number;
	"Rows Removed by Join Filter"?: number;
	Plans?: RawPlanNode[];
};

type ExplainJSON = {
	Plan: RawPlanNode;
	"Planning Time": number;
	"Execution Time": number;
};

type ExplainData = {
	planningTime: number;
	executionTime: number;
	items: Record<string, TreeViewItem<PlanNodeMeta>>;
	allNodeIds: string[];
	rawText: string;
};

function flattenPlanNode(
	node: RawPlanNode,
	totalExecutionTime: number,
	id: string,
	result: Record<string, TreeViewItem<PlanNodeMeta>>,
	allIds: string[],
): void {
	allIds.push(id);
	const childIds: string[] = [];

	if (node.Plans) {
		node.Plans.forEach((child, i) => {
			const childId = `${id}-${i}`;
			childIds.push(childId);
			flattenPlanNode(child, totalExecutionTime, childId, result, allIds);
		});
	}

	const childrenTime = (node.Plans ?? []).reduce(
		(sum, child) => sum + child["Actual Total Time"] * child["Actual Loops"],
		0,
	);
	const exclusiveTime =
		node["Actual Total Time"] * node["Actual Loops"] - childrenTime;
	const timePercent =
		totalExecutionTime > 0 ? (exclusiveTime / totalExecutionTime) * 100 : 0;

	const filter =
		node.Filter ||
		node["Index Cond"] ||
		node["Hash Cond"] ||
		node["Join Filter"] ||
		node["Merge Cond"];

	result[id] = {
		name: node["Node Type"],
		...(childIds.length > 0 ? { children: childIds } : {}),
		meta: {
			nodeType: node["Node Type"],
			relation: node["Relation Name"],
			actualTime: node["Actual Total Time"],
			actualRows: node["Actual Rows"],
			planRows: node["Plan Rows"],
			totalCost: node["Total Cost"],
			sharedHitBlocks: node["Shared Hit Blocks"],
			sharedReadBlocks: node["Shared Read Blocks"],
			filter,
			indexName: node["Index Name"],
			loops: node["Actual Loops"],
			timePercent,
			rowsRemovedByFilter: node["Rows Removed by Filter"],
			rowsRemovedByJoinFilter: node["Rows Removed by Join Filter"],
		},
	};
}

function useDbConsoleData() {
	const client = useAidboxClient();
	const [schemas, setSchemas] = useState<SchemaMap>({});
	const [jsonbColumns, setJsonbColumns] = useState<JsonbColumnMap>({});
	const [resourceTypes, setResourceTypes] = useState<Set<string>>(
		() => new Set(),
	);
	const [functions, setFunctions] = useState<string[]>([]);
	const [columns, setColumns] = useState<ColumnMap>({});

	useEffect(() => {
		let cancelled = false;

		const fetchTables = client
			.rawRequest({
				method: "POST",
				url: "/$psql",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: TABLES_QUERY }),
			})
			.then(async (res) => {
				if (cancelled || !res.response.ok) return;
				const data = await res.response.json();
				const rows: { table_schema: string; table_name: string }[] =
					Array.isArray(data) ? (data[0]?.result ?? []) : (data.result ?? []);
				const map: SchemaMap = {};
				for (const row of rows) {
					const s = row.table_schema;
					if (!map[s]) map[s] = [];
					map[s].push(row.table_name);
				}
				setSchemas(map);
			});

		const fetchJsonbCols = client
			.rawRequest({
				method: "POST",
				url: "/$psql",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: JSONB_COLUMNS_QUERY }),
			})
			.then(async (res) => {
				if (cancelled || !res.response.ok) return;
				const data = await res.response.json();
				const rows: {
					table_schema: string;
					table_name: string;
					column_name: string;
				}[] = Array.isArray(data)
					? (data[0]?.result ?? [])
					: (data.result ?? []);
				const map: JsonbColumnMap = {};
				for (const row of rows) {
					const key = `${row.table_schema}.${row.table_name}`;
					if (!map[key]) map[key] = [];
					map[key].push(row.column_name);
				}
				setJsonbColumns(map);
			});

		const fetchResourceTypes = client
			.rawRequest({ method: "GET", url: "/$resource-types" })
			.then(async (res) => {
				if (cancelled || !res.response.ok) return;
				const data: Record<string, unknown> = await res.response.json();
				setResourceTypes(new Set(Object.keys(data)));
			});

		const fetchFunctions = client
			.rawRequest({
				method: "POST",
				url: "/$psql",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: FUNCTIONS_QUERY }),
			})
			.then(async (res) => {
				if (cancelled || !res.response.ok) return;
				const data = await res.response.json();
				const rows: { name: string }[] = Array.isArray(data)
					? (data[0]?.result ?? [])
					: (data.result ?? []);
				setFunctions(rows.map((r) => r.name));
			});

		const fetchColumns = client
			.rawRequest({
				method: "POST",
				url: "/$psql",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: COLUMNS_QUERY }),
			})
			.then(async (res) => {
				if (cancelled || !res.response.ok) return;
				const data = await res.response.json();
				const rows: {
					table_schema: string;
					table_name: string;
					column_name: string;
					data_type: string;
				}[] = Array.isArray(data)
					? (data[0]?.result ?? [])
					: (data.result ?? []);
				const map: ColumnMap = {};
				for (const row of rows) {
					const key = `${row.table_schema}.${row.table_name}`;
					if (!map[key]) map[key] = [];
					map[key].push({
						name: row.column_name,
						dataType: row.data_type,
					});
				}
				setColumns(map);
			});

		Promise.all([
			fetchTables,
			fetchJsonbCols,
			fetchResourceTypes,
			fetchFunctions,
			fetchColumns,
		]).catch(() => {});

		return () => {
			cancelled = true;
		};
	}, [client]);

	return { schemas, jsonbColumns, resourceTypes, functions, columns };
}

type TabResultData = {
	results: QueryResultItem[] | null;
	error: string | null;
};

function DbConsolePage() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();
	const { schemas, jsonbColumns, resourceTypes, functions, columns } =
		useDbConsoleData();
	const fhirSchemaCacheRef = useRef<Record<string, FhirPathChildren>>({});

	const fetchFhirSchema = useCallback(
		async (resourceType: string): Promise<FhirPathChildren | null> => {
			const cached = fhirSchemaCacheRef.current[resourceType];
			if (cached) return cached;

			const result = await fetchSchemas(client, resourceType);
			if (!result) return null;

			const defaultSchema = Object.values(result).find(
				(s) => s["default?"] === true,
			);
			if (!defaultSchema) return null;

			const pathChildren = buildFhirPathChildren(defaultSchema.snapshot);
			transformToAidboxFormat(pathChildren, defaultSchema.snapshot);
			fhirSchemaCacheRef.current[resourceType] = pathChildren;
			return pathChildren;
		},
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
	const [rowLimit, setRowLimit] = useState<number | null>(10);
	const [hasExplicitLimit, setHasExplicitLimit] = useState(false);
	const leftPanelRef = useRef<ImperativePanelHandle>(null);
	const resultPanelRef = useRef<ImperativePanelHandle>(null);
	const initialLeftMenuOpen = useRef(leftMenuOpen);
	const [isPanelAnimating, setIsPanelAnimating] = useState(false);

	useEffect(() => {
		if (!initialLeftMenuOpen.current) {
			leftPanelRef.current?.collapse();
		}
	}, []);
	const [isResultCollapsed, setIsResultCollapsed] = useState(false);

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

	const handleQueryChange = useCallback(
		(value: string) => {
			setTabs((prev) =>
				prev.map((t) => (t.selected ? { ...t, query: value } : t)),
			);
		},
		[setTabs],
	);

	const executeQuery = useCallback(async () => {
		let q = queryRef.current;
		if (!q.trim()) return;

		const tabId = selectedTabRef.current?.id;
		if (!tabId) return;

		const statements = splitSqlStatements(q);
		const allHaveLimit = statements.every((s) => /\bLIMIT\s+\d+/i.test(s));

		if (allHaveLimit && statements.length === 1) {
			const limitMatch = statements[0].match(/\bLIMIT\s+(\d+)/i);
			if (limitMatch) setRowLimit(Number(limitMatch[1]));
			setHasExplicitLimit(true);
		} else if (allHaveLimit) {
			setHasExplicitLimit(true);
		} else {
			setHasExplicitLimit(false);
			if (rowLimitRef.current !== null) {
				q = statements
					.map((s) =>
						/\bLIMIT\s+\d+/i.test(s) ? s : `${s} LIMIT ${rowLimitRef.current}`,
					)
					.join("\n----\n");
			}
		}

		cancelledTabRef.current = null;
		runningQueryRef.current = queryRef.current;
		setIsLoading(true);
		saveSqlHistory(queryRef.current, queryClient, client);
		setTabResults((prev) => {
			const next = new Map(prev);
			next.set(tabId, { results: null, error: null });
			return next;
		});

		try {
			const response = await client.rawRequest({
				method: "POST",
				url: "/$psql",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: q }),
			});

			if (cancelledTabRef.current === tabId) return;

			if (!response.response.ok) {
				const text = await response.response.text();
				setTabResults((prev) => {
					const next = new Map(prev);
					next.set(tabId, {
						results: null,
						error: `HTTP ${response.response.status}: ${text}`,
					});
					return next;
				});
				return;
			}

			const data = await response.response.json();
			if (cancelledTabRef.current === tabId) return;

			setTabResults((prev) => {
				const next = new Map(prev);
				next.set(tabId, {
					results: Array.isArray(data) ? data : [data],
					error: null,
				});
				return next;
			});
		} catch (err) {
			if (cancelledTabRef.current === tabId) return;

			let errorMsg: string;
			if (isAidboxError(err)) {
				errorMsg = await err.response.text();
			} else {
				errorMsg = err instanceof Error ? err.message : String(err);
			}
			setTabResults((prev) => {
				const next = new Map(prev);
				next.set(tabId, { results: null, error: errorMsg });
				return next;
			});
		} finally {
			if (cancelledTabRef.current !== tabId) {
				setIsLoading(false);
			}
			runningQueryRef.current = null;
		}
	}, [client, queryClient]);

	const cancelQuery = useCallback(async () => {
		const tabId = selectedTabRef.current?.id;
		if (!tabId) return;

		const queryText = runningQueryRef.current;
		cancelledTabRef.current = tabId;
		runningQueryRef.current = null;
		setIsLoading(false);
		setTabResults((prev) => {
			const next = new Map(prev);
			next.set(tabId, { results: null, error: "Query cancelled" });
			return next;
		});

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
	}, [client]);

	const handleHistoryItemClick = useCallback(
		(command: string) => {
			setTabs((prev) => {
				const existing = prev.find((t) => t.query === command);
				if (existing) {
					return prev.map((t) => ({ ...t, selected: t.id === existing.id }));
				}
				const newTab: SqlTab = {
					id: crypto.randomUUID(),
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

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				executeQuery();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [executeQuery]);

	const issueLineNumbers = useMemo(() => {
		const allErrors: string[] = [];
		if (error) allErrors.push(error);
		if (results) {
			for (const r of results) {
				if (r.error) allErrors.push(r.error);
			}
		}
		const issues: { line: number; message: string }[] = [];
		for (const err of allErrors) {
			const posMatch = err.match(/Position:\s*(\d+)/);
			if (!posMatch) continue;
			const charPos = Number.parseInt(posMatch[1], 10);
			if (Number.isNaN(charPos) || charPos < 1) continue;
			let line = 1;
			for (let i = 0; i < Math.min(charPos - 1, query.length); i++) {
				if (query[i] === "\n") line++;
			}
			const msgMatch = err.match(/^ERROR:\s*(.+?)(?:\n|$)/);
			issues.push({ line, message: msgMatch ? msgMatch[1] : err });
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

	const tableCompletion = useMemo(
		() =>
			Object.keys(schemas).length > 0 ? tableCompletionExtension(schemas) : [],
		[schemas],
	);

	const jsonbCompletion = useMemo(
		() =>
			Object.keys(jsonbColumns).length > 0
				? jsonbCompletionExtension({
						schemas,
						jsonbColumns,
						resourceTypes,
						fhirSchemaCache: fhirSchemaCacheRef.current,
						fetchFhirSchema,
					})
				: [],
		[schemas, jsonbColumns, resourceTypes, fetchFhirSchema],
	);

	const columnCompletion = useMemo(
		() =>
			Object.keys(columns).length > 0
				? columnCompletionExtension({ schemas, columns })
				: [],
		[schemas, columns],
	);

	const completionOverride = useMemo(
		() =>
			autocompletion({
				override: [
					async (context: CompletionContext) => {
						const line = context.state.doc.lineAt(context.pos);
						const textBefore = line.text.slice(0, context.pos - line.from);
						const inJsonb = isInJsonbContext(textBefore);

						const langSources = context.state.languageDataAt<CompletionSource>(
							"autocomplete",
							context.pos,
						);

						const results = (
							await Promise.all(
								langSources.map((src) => Promise.resolve(src(context))),
							)
						).filter((r): r is CompletionResult => r !== null);

						if (results.length === 0) return null;

						if (inJsonb) {
							const jsonbResult = results.find((r) =>
								r.options.some((o) => o.type === "property"),
							);
							if (!jsonbResult) return null;
							return {
								...jsonbResult,
								options: jsonbResult.options.filter(
									(o) => o.type === "property",
								),
							};
						}

						if (results.length === 1) return results[0];

						const groups = new Map<number, CompletionResult>();
						for (const r of results) {
							const existing = groups.get(r.from);
							if (existing) {
								existing.options.push(...r.options);
							} else {
								groups.set(r.from, {
									...r,
									options: [...r.options],
								});
							}
						}

						let best: CompletionResult | null = null;
						for (const g of groups.values()) {
							if (!best || g.options.length > best.options.length) best = g;
						}
						return best;
					},
				],
			}),
		[],
	);

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
				]),
			),
			EditorView.theme({
				".cm-searchMatch": {
					backgroundColor: "var(--color-blue-200)",
				},
				".cm-searchMatch-selected": {
					backgroundColor: "var(--color-blue-400)",
				},
				".cm-lineNumbers": { minWidth: "3.5ch", paddingLeft: "8px" },
				".cm-lineNumbers .cm-gutterElement": {
					minWidth: "3.5ch",
					paddingRight: "4px",
				},
				".cm-tooltip.cm-tooltip-autocomplete": {
					background: "var(--color-bg-primary)",
					border: "1px solid var(--color-border-primary)",
					borderRadius: "var(--radius-md)",
					padding: "4px",
					boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
					fontFamily: "var(--font-family-sans)",
					fontSize: "14px",
				},
				".cm-tooltip.cm-tooltip-autocomplete > ul": {
					maxHeight: "300px",
				},
				".cm-tooltip-autocomplete ul li": {
					padding: "4px 8px",
					borderRadius: "4px",
				},
				".cm-tooltip-autocomplete ul li[aria-selected]": {
					background: "var(--color-bg-quaternary)",
					color: "var(--color-text-primary)",
				},
				".cm-completionLabel": {
					color: "var(--color-text-primary)",
					fontSize: "14px",
				},
				".cm-completionDetail": {
					color: "var(--color-text-tertiary)",
					fontSize: "12px",
					fontStyle: "normal",
					marginLeft: "8px",
				},
				".cm-completionIcon": {
					padding: "0",
					marginRight: "6px",
					width: "18px",
					height: "18px",
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					borderRadius: "4px",
					fontSize: "11px",
					fontWeight: "600",
					lineHeight: "1",
					boxSizing: "border-box",
				},
				".cm-completionIcon-table": {
					background: "var(--color-blue-100)",
					color: "var(--color-blue-600)",
				},
				".cm-completionIcon-table::after": {
					content: "'T'",
				},
				".cm-completionIcon-keyword": {
					background: "var(--color-green-200)",
					color: "var(--color-green-700)",
				},
				".cm-completionIcon-keyword::after": {
					content: "'S'",
				},
				".cm-completionIcon-property": {
					background: "var(--color-purple-100)",
					color: "var(--color-purple-600)",
				},
				".cm-completionIcon-property::after": {
					content: "'F'",
				},
				".cm-completionIcon-variable": {
					background: "var(--color-yellow-200)",
					color: "var(--color-yellow-700)",
				},
				".cm-completionIcon-variable::after": {
					content: "'C'",
				},
			}),
			tableCompletion,
			jsonbCompletion,
			columnCompletion,
			completionOverride,
		],
		[
			executeQuery,
			tableCompletion,
			jsonbCompletion,
			columnCompletion,
			completionOverride,
		],
	);

	return (
		<SqlLeftMenuContext value={leftMenuOpen ? "open" : "close"}>
			<ResizablePanelGroup direction="horizontal" className="w-full h-full">
				<ResizablePanel
					ref={leftPanelRef}
					defaultSize={20}
					minSize={20}
					maxSize={80}
					collapsible
					collapsedSize={0}
					onCollapse={() => setLeftMenuOpen(false)}
					onExpand={() => setLeftMenuOpen(true)}
					className={
						isPanelAnimating ? "transition-[flex-grow] duration-200" : ""
					}
				>
					<SqlLeftMenu
						schemas={schemas}
						onHistoryItemClick={handleHistoryItemClick}
						onTableClick={handleHistoryItemClick}
					/>
				</ResizablePanel>
				{(leftMenuOpen || isPanelAnimating) && <ResizableHandle />}
				<ResizablePanel
					defaultSize={80}
					minSize={40}
					className={
						isPanelAnimating ? "transition-[flex-grow] duration-200" : ""
					}
				>
					<div className="flex flex-col h-full min-w-0">
						<div className="flex h-10 w-full border-b">
							<SqlLeftMenuToggle
								onClose={() => {
									setIsPanelAnimating(true);
									leftPanelRef.current?.collapse();
									setTimeout(() => setIsPanelAnimating(false), 200);
								}}
								onOpen={() => {
									setIsPanelAnimating(true);
									leftPanelRef.current?.expand();
									setTimeout(() => setIsPanelAnimating(false), 200);
								}}
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
						>
							<ResizablePanel defaultSize={40} minSize={10}>
								<div className="flex flex-col h-full">
									<div className="flex items-center justify-between bg-bg-secondary flex-none h-10 border-b">
										<span className="typo-label text-text-secondary pl-6">
											SQL Editor
										</span>
										<div className="flex items-center gap-4 pl-4 pr-[10px]">
											<Tooltip delayDuration={300}>
												<TooltipTrigger asChild>
													<Button
														variant="ghost"
														size="small"
														onClick={formatQuery}
														disabled={!query.trim()}
													>
														<AlignLeft className="w-4 h-4" />
													</Button>
												</TooltipTrigger>
												<TooltipContent>Format SQL</TooltipContent>
											</Tooltip>
											{isLoading ? (
												<Button
													variant="link"
													size="regular"
													className="text-text-error-primary!"
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
															className="text-text-link!"
															onClick={executeQuery}
															disabled={!query.trim()}
														>
															<PlayIcon className="w-4 h-4 fill-current text-text-link" />
															RUN
														</Button>
													</TooltipTrigger>
													<TooltipContent>
														{navigator.platform?.includes("Mac")
															? "⌘+Enter"
															: "Ctrl+Enter"}
													</TooltipContent>
												</Tooltip>
											)}
										</div>
									</div>
									<div className="flex-1 min-h-0 pt-1">
										<CodeEditor
											key={selectedTab?.id}
											mode="sql"
											defaultValue={query}
											onChange={handleQueryChange}
											additionalExtensions={sqlEditorExtensions}
											sqlExtraBuiltins={functions}
											viewCallback={onEditorView}
											foldGutter={false}
											lintGutter={false}
											issueLineNumbers={issueLineNumbers}
										/>
									</div>
								</div>
							</ResizablePanel>

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
									rowLimit={rowLimit}
									onRowLimitChange={setRowLimit}
									hasExplicitLimit={hasExplicitLimit}
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
								/>
							</ResizablePanel>
						</ResizablePanelGroup>
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</SqlLeftMenuContext>
	);
}

function ResultPanel({
	results,
	error,
	isLoading,
	onRun,
	onCancel,
	query,
	rowLimit,
	onRowLimitChange,
	hasExplicitLimit,
	collapsed,
	onToggleCollapse,
}: {
	results: QueryResultItem[] | null;
	error: string | null;
	isLoading: boolean;
	onRun: () => void;
	onCancel: () => void;
	query: string;
	rowLimit: number | null;
	onRowLimitChange: (limit: number | null) => void;
	hasExplicitLimit: boolean;
	collapsed: boolean;
	onToggleCollapse: () => void;
}) {
	const client = useAidboxClient();
	const [isMaximized, setIsMaximized] = useState(false);
	const [activeTab, setActiveTab] = useState("result");
	const [explainResults, setExplainResults] = useState<
		(ExplainData | string)[] | null
	>(null);
	const [explainLoading, setExplainLoading] = useState(false);
	const [explainError, setExplainError] = useState<string | null>(null);
	const queryRef = useRef(query);
	queryRef.current = query;
	const explainCancelledRef = useRef(false);

	useEffect(() => {
		if (!isMaximized) return;
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") setIsMaximized(false);
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [isMaximized]);

	const runExplainForStatement = useCallback(
		async (q: string): Promise<ExplainData | string> => {
			const [jsonResponse, textResponse] = await Promise.all([
				client.rawRequest({
					method: "POST",
					url: "/$psql",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						query: `EXPLAIN (ANALYZE, COSTS, BUFFERS, FORMAT JSON) ${q}`,
					}),
				}),
				client.rawRequest({
					method: "POST",
					url: "/$psql",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						query: `EXPLAIN (ANALYZE, COSTS, BUFFERS) ${q}`,
					}),
				}),
			]);

			if (!jsonResponse.response.ok) {
				const text = await jsonResponse.response.text();
				throw new Error(`HTTP ${jsonResponse.response.status}: ${text}`);
			}

			const textData = await textResponse.response.json();
			const textRows: Record<string, unknown>[] = Array.isArray(textData)
				? (textData[0]?.result ?? [])
				: (textData.result ?? []);
			const rawText = textRows
				.map((r: Record<string, unknown>) => Object.values(r)[0])
				.join("\n");

			const data = await jsonResponse.response.json();
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
					const items: Record<string, TreeViewItem<PlanNodeMeta>> = {};
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
		explainCancelledRef.current = false;
		setExplainLoading(true);
		setExplainError(null);
		setExplainResults(null);
		try {
			const results = await Promise.all(
				statements.map((s) => runExplainForStatement(s)),
			);
			if (explainCancelledRef.current) return;
			setExplainResults(results);
		} catch (err) {
			if (explainCancelledRef.current) return;

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

	return (
		<div
			className={`flex flex-col h-full ${isMaximized ? "absolute top-0 left-0 w-full h-full z-30 bg-bg-primary" : ""}`}
		>
			<div className="flex items-center justify-between bg-bg-secondary pr-2 border-b h-10">
				<Tabs variant="tertiary" value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="pl-4 h-10">
						<TabsTrigger value="result">Result</TabsTrigger>
						<TabsTrigger value="explain">Explain</TabsTrigger>
					</TabsList>
				</Tabs>
				<div className="flex items-center gap-1">
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
								onClick={() => setIsMaximized((v) => !v)}
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
				(activeTab === "result" ? (
					<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
						<ResultContent
							results={results}
							error={error}
							isLoading={isLoading}
							onRun={onRun}
							onCancel={onCancel}
							rowLimit={rowLimit}
							onRowLimitChange={onRowLimitChange}
							hasExplicitLimit={hasExplicitLimit}
						/>
					</div>
				) : (
					<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
						<ExplainContent
							results={explainResults}
							error={explainError}
							isLoading={explainLoading}
							onCancel={cancelExplain}
						/>
					</div>
				))}
		</div>
	);
}

function PlanNodeView({ meta }: { meta: PlanNodeMeta }) {
	const timeColorClass =
		meta.timePercent > 66
			? "text-text-error-primary"
			: meta.timePercent > 33
				? "text-text-warning-primary"
				: "text-text-success-primary";

	const label = [
		meta.nodeType,
		meta.relation && `on ${meta.relation}`,
		meta.indexName && `using ${meta.indexName}`,
	]
		.filter(Boolean)
		.join(" ");

	const actualTimeTotal = meta.actualTime * meta.loops;
	const hasBuffers =
		(meta.sharedHitBlocks != null && meta.sharedHitBlocks > 0) ||
		(meta.sharedReadBlocks != null && meta.sharedReadBlocks > 0);
	const hasRowsRemoved =
		(meta.rowsRemovedByFilter != null && meta.rowsRemovedByFilter > 0) ||
		(meta.rowsRemovedByJoinFilter != null && meta.rowsRemovedByJoinFilter > 0);
	const hasSecondLine = meta.filter || hasBuffers || hasRowsRemoved;

	return (
		<div className="flex flex-col gap-0.5 py-0.5 min-w-0">
			<div className="flex items-center gap-3">
				<span className="text-sm font-medium text-text-primary">{label}</span>
				<span className="text-xs text-text-secondary">
					{actualTimeTotal.toFixed(2)}ms · {meta.actualRows} rows
					{meta.loops > 1 && ` · ${meta.loops} loops`}
					{meta.planRows !== meta.actualRows && (
						<span className="text-text-warning-primary">
							{" "}
							(est. {meta.planRows})
						</span>
					)}
				</span>
				<span className={`text-xs font-medium ${timeColorClass}`}>
					{meta.timePercent.toFixed(1)}%
				</span>
			</div>
			{hasSecondLine && (
				<div className="text-xs text-text-tertiary flex gap-3">
					{meta.filter && (
						<span className="truncate max-w-md" title={meta.filter}>
							Filter: {meta.filter}
						</span>
					)}
					{hasRowsRemoved && (
						<span className="text-text-warning-primary">
							{meta.rowsRemovedByFilter != null &&
								meta.rowsRemovedByFilter > 0 &&
								`Removed by filter: ${meta.rowsRemovedByFilter}`}
							{meta.rowsRemovedByFilter != null &&
								meta.rowsRemovedByFilter > 0 &&
								meta.rowsRemovedByJoinFilter != null &&
								meta.rowsRemovedByJoinFilter > 0 &&
								" · "}
							{meta.rowsRemovedByJoinFilter != null &&
								meta.rowsRemovedByJoinFilter > 0 &&
								`Removed by join filter: ${meta.rowsRemovedByJoinFilter}`}
						</span>
					)}
					{hasBuffers && (
						<span>
							Hit: {meta.sharedHitBlocks ?? 0} · Read:{" "}
							{meta.sharedReadBlocks ?? 0}
						</span>
					)}
				</div>
			)}
		</div>
	);
}

const EXPLAIN_VIEW_ITEMS = [
	{ value: "visual", label: "Visual" },
	{ value: "raw", label: "Raw" },
];

function ExplainContent({
	results,
	error,
	isLoading,
	onCancel,
}: {
	results: (ExplainData | string)[] | null;
	error: string | null;
	isLoading: boolean;
	onCancel: () => void;
}) {
	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center flex-1 gap-3 text-text-secondary">
				<div className="flex items-center">
					<Loader2 className="animate-spin mr-2" size={16} />
					Running EXPLAIN ANALYZE…
				</div>
				<Button variant="secondary" size="small" onClick={onCancel}>
					Cancel
				</Button>
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-6">
				<pre className="text-sm text-text-error-primary whitespace-pre-wrap font-mono">
					{error}
				</pre>
			</div>
		);
	}

	if (!results) {
		return (
			<EmptyState
				grayscale
				title="No plan yet"
				description="Run a query first, then switch to this tab"
			/>
		);
	}

	if (results.length === 1) {
		const r = results[0];
		return (
			<div className="flex flex-col flex-1 min-h-0">
				<SingleExplainView result={r} />
				{typeof r !== "string" && (
					<div className="flex-none px-6 py-2 border-t text-xs text-text-tertiary bg-bg-secondary flex gap-4">
						<span>Execution: {r.executionTime.toFixed(2)}ms</span>
						<span>Planning: {r.planningTime.toFixed(2)}ms</span>
					</div>
				)}
			</div>
		);
	}

	return (
		<ResizablePanelGroup direction="vertical">
			{results.flatMap((result, index) => {
				const key = `explain-${index}`;
				const panel = (
					<ResizablePanel key={`panel-${key}`} minSize={10}>
						<div className="flex flex-col h-full min-h-0">
							<div className="flex-none flex items-center justify-between px-4 py-1 border-b bg-bg-secondary">
								<span className="text-xs text-text-tertiary">
									Query {index + 1}
								</span>
								{typeof result !== "string" && (
									<span className="text-xs text-text-tertiary flex gap-3">
										<span>Execution: {result.executionTime.toFixed(2)}ms</span>
										<span>Planning: {result.planningTime.toFixed(2)}ms</span>
									</span>
								)}
							</div>
							<SingleExplainView result={result} />
						</div>
					</ResizablePanel>
				);
				if (index === 0) return [panel];
				return [<ResizableHandle key={`handle-${key}`} />, panel];
			})}
		</ResizablePanelGroup>
	);
}

function SingleExplainView({ result }: { result: ExplainData | string }) {
	const [view, setView] = useState<string>("visual");

	if (typeof result === "string") {
		return (
			<div className="flex-1 overflow-auto p-6">
				<pre className="text-sm whitespace-pre-wrap font-mono text-text-primary">
					{result}
				</pre>
			</div>
		);
	}

	return (
		<div className="relative flex flex-col flex-1 min-h-0">
			<div className="absolute top-2 right-4 z-50 flex items-center border rounded-full p-2 border-border-secondary bg-bg-primary">
				<SegmentControl
					value={view}
					onValueChange={setView}
					items={EXPLAIN_VIEW_ITEMS}
				/>
			</div>
			<div className="flex-1 overflow-auto pl-[14px] pr-6 py-4">
				{view === "visual" ? (
					<TreeView<PlanNodeMeta>
						rootItemId="root"
						items={result.items}
						defaultExpandedItems={result.allNodeIds}
						disableHover
						customItemView={(item) => {
							const meta = item.getItemData()?.meta;
							if (!meta) return item.getItemData()?.name;
							return <PlanNodeView meta={meta} />;
						}}
					/>
				) : (
					<pre className="text-sm whitespace-pre-wrap font-mono text-text-primary pl-4">
						{result.rawText}
					</pre>
				)}
			</div>
		</div>
	);
}

function ResultContent({
	results,
	error,
	isLoading,
	onRun,
	onCancel,
	rowLimit,
	onRowLimitChange,
	hasExplicitLimit,
}: {
	results: QueryResultItem[] | null;
	error: string | null;
	isLoading: boolean;
	onRun: () => void;
	onCancel: () => void;
	rowLimit: number | null;
	onRowLimitChange: (limit: number | null) => void;
	hasExplicitLimit: boolean;
}) {
	const [maximizedIndex, setMaximizedIndex] = useState<number | null>(null);

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center flex-1 gap-3 text-text-secondary">
				<div className="flex items-center">
					<Loader2 className="animate-spin mr-2" size={16} />
					Executing query…
				</div>
				<Button variant="secondary" size="small" onClick={onCancel}>
					Cancel
				</Button>
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-6">
				<pre className="text-sm text-text-error-primary whitespace-pre-wrap font-mono">
					{error}
				</pre>
			</div>
		);
	}

	if (!results) {
		return (
			<EmptyState
				grayscale
				title="No results yet"
				description={
					<>
						Click{" "}
						<button
							type="button"
							className="text-text-link hover:underline cursor-pointer"
							onClick={onRun}
						>
							Run
						</button>{" "}
						to execute a query
					</>
				}
			/>
		);
	}

	if (maximizedIndex !== null && results[maximizedIndex]) {
		return (
			<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
				<div className="flex-1 min-h-0">
					<QueryResult
						result={results[maximizedIndex]}
						index={maximizedIndex}
						totalCount={results.length}
						isMaximized
						onToggleMaximize={() => setMaximizedIndex(null)}
					/>
				</div>
				<ResultFooter
					results={results}
					rowLimit={rowLimit}
					onRowLimitChange={onRowLimitChange}
					hasExplicitLimit={hasExplicitLimit}
				/>
			</div>
		);
	}

	if (results.length === 1) {
		return (
			<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
				<div className="flex-1 min-h-0">
					<QueryResult
						result={results[0]}
						index={0}
						totalCount={1}
						isMaximized={false}
						onToggleMaximize={() => {}}
					/>
				</div>
				<ResultFooter
					results={results}
					rowLimit={rowLimit}
					onRowLimitChange={onRowLimitChange}
					hasExplicitLimit={hasExplicitLimit}
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
			<div className="flex-1 min-h-0">
				<ResizablePanelGroup direction="vertical">
					{results.flatMap((result, index) => {
						const key = `${result.query}-${index}`;
						const panel = (
							<ResizablePanel key={`panel-${key}`} minSize={10}>
								<QueryResult
									result={result}
									index={index}
									totalCount={results.length}
									isMaximized={false}
									onToggleMaximize={() => setMaximizedIndex(index)}
								/>
							</ResizablePanel>
						);
						if (index === 0) return [panel];
						return [<ResizableHandle key={`handle-${key}`} />, panel];
					})}
				</ResizablePanelGroup>
			</div>
			<ResultFooter
				results={results}
				rowLimit={rowLimit}
				onRowLimitChange={onRowLimitChange}
				hasExplicitLimit={hasExplicitLimit}
			/>
		</div>
	);
}

const cellEditorTheme = EditorView.theme({
	"&": { height: "auto", padding: "0" },
	".cm-scroller": { overflow: "visible" },
	".cm-gutters": { display: "none" },
	".cm-content": { padding: "0" },
	".cm-line": { padding: "0" },
});

const cellEditorExtensions = [cellEditorTheme];

const LINE_HEIGHT = 20;
const EDITOR_PADDING_Y = 0;
const CHAR_WIDTH = 8.4;
const GUTTER_WIDTH = 0;
const EDITOR_PADDING_X = 0;

const CellValue = ({ value }: { value: unknown }) => {
	if (value === null || value === undefined) {
		return (
			<div className="sticky top-10">
				<span className="text-text-tertiary">null</span>
			</div>
		);
	}
	if (typeof value === "object") {
		const json = JSON.stringify(value, null, 2);
		const lines = json.split("\n");
		const height = lines.length * LINE_HEIGHT + EDITOR_PADDING_Y;
		const maxLineLen = Math.max(...lines.map((l) => l.length));
		const width = Math.max(
			300,
			maxLineLen * CHAR_WIDTH + GUTTER_WIDTH + EDITOR_PADDING_X,
		);
		return (
			<div style={{ width, height }}>
				<CodeEditor
					readOnly
					currentValue={json}
					mode="json"
					additionalExtensions={cellEditorExtensions}
				/>
			</div>
		);
	}
	return <div className="sticky top-10">{String(value)}</div>;
};

const extractColumns = (data: Record<string, unknown>[]): string[] => {
	const allKeys = new Set<string>();
	for (const row of data) {
		for (const key of Object.keys(row)) allKeys.add(key);
	}
	return Array.from(allKeys);
};

function cellToString(value: unknown): string {
	if (value === null || value === undefined) return "null";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

function resultsToMarkdown(
	columns: string[],
	rows: Record<string, unknown>[],
): string {
	const header = `| ${columns.join(" | ")} |`;
	const separator = `| ${columns.map(() => "---").join(" | ")} |`;
	const body = rows
		.map(
			(row) =>
				`| ${columns.map((col) => cellToString(row[col]).replace(/\|/g, "\\|")).join(" | ")} |`,
		)
		.join("\n");
	return `${header}\n${separator}\n${body}`;
}

function resultsToCSV(
	columns: string[],
	rows: Record<string, unknown>[],
): string {
	const escapeCSV = (val: unknown) => {
		const str =
			val === null || val === undefined
				? ""
				: typeof val === "object"
					? JSON.stringify(val)
					: String(val);
		if (str.includes(",") || str.includes('"') || str.includes("\n")) {
			return `"${str.replace(/"/g, '""')}"`;
		}
		return str;
	};
	const header = columns.map((c) => escapeCSV(c)).join(",");
	const body = rows
		.map((row) => columns.map((col) => escapeCSV(row[col])).join(","))
		.join("\n");
	return `${header}\n${body}`;
}

function downloadFile(content: string, filename: string, mimeType: string) {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

function QueryResult({
	result,
	index,
	totalCount,
	isMaximized,
	onToggleMaximize,
}: {
	result: QueryResultItem;
	index: number;
	totalCount: number;
	isMaximized: boolean;
	onToggleMaximize: () => void;
}) {
	if (result.error) {
		return (
			<div className="flex flex-col h-full">
				{totalCount > 1 && (
					<QueryResultHeader
						index={index}
						isMaximized={isMaximized}
						onToggleMaximize={onToggleMaximize}
					/>
				)}
				<div className="p-6">
					<pre className="text-sm text-text-error-primary whitespace-pre-wrap font-mono">
						{result.error}
					</pre>
				</div>
			</div>
		);
	}

	const rows = result.result ?? [];
	const columns = extractColumns(rows);

	return (
		<div className="flex flex-col h-full min-h-0 overflow-hidden">
			{totalCount > 1 && (
				<QueryResultHeader
					index={index}
					isMaximized={isMaximized}
					onToggleMaximize={onToggleMaximize}
				/>
			)}
			{rows.length === 0 ? (
				<EmptyState
					grayscale
					title="No results"
					description="Query returned no rows"
				/>
			) : (
				<div className="flex-1 overflow-auto min-h-0">
					<Table stickyHeader>
						<TableHeader>
							<TableRow>
								{columns.map((key) => (
									<TableHead
										key={key}
										className="px-6 hover:bg-transparent whitespace-nowrap"
									>
										{key}
									</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody className="[&_tr]:hover:bg-transparent">
							{rows.map((row, rowIdx) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: result rows lack stable unique identifiers
								<TableRow key={rowIdx}>
									{columns.map((key) => (
										<TableCell key={key} className="px-6 align-top">
											<CellValue value={row[key]} />
										</TableCell>
									))}
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}

function QueryResultHeader({
	index,
	isMaximized,
	onToggleMaximize,
}: {
	index: number;
	isMaximized: boolean;
	onToggleMaximize: () => void;
}) {
	return (
		<div className="flex-none flex items-center justify-between px-4 py-1 border-b bg-bg-secondary">
			<span className="text-xs text-text-tertiary">Query {index + 1}</span>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button variant="ghost" size="small" onClick={onToggleMaximize}>
						{isMaximized ? (
							<Minimize2 className="w-3.5 h-3.5" />
						) : (
							<Maximize2 className="w-3.5 h-3.5" />
						)}
					</Button>
				</TooltipTrigger>
				<TooltipContent>{isMaximized ? "Minimize" : "Maximize"}</TooltipContent>
			</Tooltip>
		</div>
	);
}

function ResultFooter({
	results,
	rowLimit,
	onRowLimitChange,
	hasExplicitLimit,
}: {
	results: QueryResultItem[];
	rowLimit: number | null;
	onRowLimitChange: (limit: number | null) => void;
	hasExplicitLimit: boolean;
}) {
	const limitOptions = useMemo(() => {
		const opts = LIMIT_PRESETS.map((n) => ({
			value: String(n),
			label: String(n),
		}));
		if (rowLimit !== null && !LIMIT_PRESETS.includes(rowLimit)) {
			opts.push({ value: String(rowLimit), label: String(rowLimit) });
			opts.sort((a, b) => Number(a.value) - Number(b.value));
		}
		opts.push({ value: "none", label: "No limit" });
		return opts;
	}, [rowLimit]);

	const totalRows = results.reduce(
		(sum, r) => sum + (r.result?.length ?? 0),
		0,
	);
	const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
	const hasRows = totalRows > 0;

	return (
		<div className="flex-none px-6 py-2 border-t text-xs text-text-tertiary bg-bg-secondary flex items-center justify-between">
			<span>
				{totalRows} row · Time: {totalDuration}ms
			</span>
			<div className="flex items-center gap-3">
				{hasRows && <ExportDropdown results={results} />}
				{!hasExplicitLimit && (
					<span className="flex items-center gap-1">
						Limit:
						<ButtonDropdown
							options={limitOptions}
							selectedValue={String(rowLimit ?? "none")}
							onSelectItem={(v) =>
								onRowLimitChange(v === "none" ? null : Number(v))
							}
						/>
					</span>
				)}
			</div>
		</div>
	);
}

function ExportDropdown({ results }: { results: QueryResultItem[] }) {
	const exportResult = useCallback(
		(resultItems: QueryResultItem[], format: "markdown" | "json" | "csv") => {
			const parts = resultItems.map((r) => {
				const rows = r.result ?? [];
				const columns = extractColumns(rows);
				switch (format) {
					case "markdown":
						return resultsToMarkdown(columns, rows);
					case "json":
						return JSON.stringify(rows, null, 2);
					case "csv":
						return resultsToCSV(columns, rows);
				}
			});

			if (format === "csv") {
				const combined = parts.join("\n\n");
				downloadFile(combined, "export.csv", "text/csv;charset=utf-8;");
			} else {
				const separator = format === "markdown" ? "\n\n" : "\n";
				navigator.clipboard.writeText(parts.join(separator));
			}
		},
		[],
	);

	const validResults = results.filter(
		(r) => !r.error && (r.result?.length ?? 0) > 0,
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="small">
					<Download className="w-3.5 h-3.5" />
					Export
					<ChevronDown className="w-3 h-3" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{validResults.length > 1 &&
					validResults.map((r) => {
						const rows = r.result ?? [];
						const columns = extractColumns(rows);
						return (
							<DropdownMenu key={`query-${results.indexOf(r)}`}>
								<DropdownMenuTrigger className="w-full px-2 py-1.5 text-sm hover:bg-bg-secondary flex items-center justify-between cursor-pointer rounded-sm">
									Query {results.indexOf(r) + 1}
									<ChevronDown className="w-3 h-3 -rotate-90" />
								</DropdownMenuTrigger>
								<DropdownMenuContent side="left">
									<DropdownMenuItem
										onClick={() =>
											navigator.clipboard.writeText(
												resultsToMarkdown(columns, rows),
											)
										}
									>
										Copy as Markdown
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() =>
											navigator.clipboard.writeText(
												JSON.stringify(rows, null, 2),
											)
										}
									>
										Copy as JSON
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() =>
											downloadFile(
												resultsToCSV(columns, rows),
												"export.csv",
												"text/csv;charset=utf-8;",
											)
										}
									>
										Download CSV
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						);
					})}
				{validResults.length > 1 && (
					<>
						<div className="h-px bg-border-primary my-1" />
						<DropdownMenuItem
							onClick={() => exportResult(validResults, "markdown")}
						>
							Copy all as Markdown
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => exportResult(validResults, "json")}
						>
							Copy all as JSON
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => exportResult(validResults, "csv")}>
							Download all as CSV
						</DropdownMenuItem>
					</>
				)}
				{validResults.length === 1 && (
					<>
						<DropdownMenuItem
							onClick={() => exportResult(validResults, "markdown")}
						>
							Copy as Markdown
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => exportResult(validResults, "json")}
						>
							Copy as JSON
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => exportResult(validResults, "csv")}>
							Download CSV
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function isAidboxError(err: unknown): err is AidboxTypes.ErrorResponse {
	return (
		typeof err === "object" &&
		err !== null &&
		"response" in err &&
		typeof (err as AidboxTypes.ErrorResponse).response?.text === "function"
	);
}
