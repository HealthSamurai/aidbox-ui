import type { RefObject } from "react";
import { useEffect } from "react";
import type { DbConsoleActions } from "./db-console-context";

function textResult(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

const TOOL_NAMES = [
	"execute_sql",
	"run_query",
	"set_query",
	"get_query",
	"format_sql",
	"list_tabs",
	"select_tab",
	"add_tab",
	"duplicate_tab",
	"close_tab",
	"close_other_tabs",
	"close_tabs_to_left",
	"close_tabs_to_right",
	"select_table",
	"get_table_info",
	"drop_index",
	"get_active_queries",
	"cancel_query",
	"open_sidebar",
	"show_left_menu",
	"toggle_results_panel",
	"show_explain",
	"show_result",
	"get_query_status",
	"get_results",
	"set_row_limit",
	"get_row_limit",
	"get_history",
	"open_history_entry",
	"list_tables",
] as const;

export function useWebMCPSql(actionsRef: RefObject<DbConsoleActions>) {
	useEffect(() => {
		if (!navigator.modelContext) return;

		let lastHistoryResults: string[] = [];

		navigator.modelContext.registerTool({
			name: "execute_sql",
			description:
				"[DB Console] Fill the SQL editor with a query and execute it. " +
				"Results appear in the UI result panel below the editor.",
			inputSchema: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "SQL query to execute",
					},
				},
				required: ["query"],
			},
			execute: async (args: { query: string }) => {
				actionsRef.current.executeQuery(args.query);
				return textResult("Query executed, see results in UI");
			},
		});

		navigator.modelContext.registerTool({
			name: "run_query",
			description:
				"[DB Console] Execute the current SQL query in the editor without changing it.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.runCurrentQuery();
				return textResult("Current query executed, see results in UI");
			},
		});

		navigator.modelContext.registerTool({
			name: "set_query",
			description:
				"[DB Console] Set the SQL query in the editor without executing it.",
			inputSchema: {
				type: "object",
				properties: {
					query: { type: "string", description: "SQL query to set" },
				},
				required: ["query"],
			},
			execute: async (args: { query: string }) => {
				actionsRef.current.setQuery(args.query);
				return textResult("Query set in editor");
			},
		});

		navigator.modelContext.registerTool({
			name: "get_query",
			description:
				"[DB Console] Get the current SQL query from the active editor tab.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const query = actionsRef.current.getQuery();
				return textResult(query || "(empty)");
			},
		});

		navigator.modelContext.registerTool({
			name: "format_sql",
			description: "[DB Console] Format the current SQL query in the editor.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.formatSql();
				return textResult("SQL formatted");
			},
		});

		navigator.modelContext.registerTool({
			name: "list_tabs",
			description:
				"[DB Console] List all open SQL editor tabs with their IDs and query previews.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const tabs = actionsRef.current.getTabs();
				return textResult(JSON.stringify(tabs, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "select_tab",
			description:
				"[DB Console] Switch to a specific SQL editor tab by its ID.",
			inputSchema: {
				type: "object",
				properties: {
					tab_id: {
						type: "string",
						description: "Tab ID (from list_tabs)",
					},
				},
				required: ["tab_id"],
			},
			execute: async (args: { tab_id: string }) => {
				actionsRef.current.selectTab(args.tab_id);
				return textResult(`Switched to tab ${args.tab_id}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "add_tab",
			description:
				"[DB Console] Create a new empty SQL editor tab and switch to it.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.addTab();
				return textResult("New tab created");
			},
		});

		navigator.modelContext.registerTool({
			name: "duplicate_tab",
			description:
				"[DB Console] Duplicate an editor tab by its ID (copies the query).",
			inputSchema: {
				type: "object",
				properties: {
					tab_id: {
						type: "string",
						description: "Tab ID to duplicate (from list_tabs)",
					},
				},
				required: ["tab_id"],
			},
			execute: async (args: { tab_id: string }) => {
				actionsRef.current.duplicateTab(args.tab_id);
				return textResult(`Tab ${args.tab_id} duplicated`);
			},
		});

		navigator.modelContext.registerTool({
			name: "close_tab",
			description: "[DB Console] Close an editor tab by its ID.",
			inputSchema: {
				type: "object",
				properties: {
					tab_id: {
						type: "string",
						description: "Tab ID to close (from list_tabs)",
					},
				},
				required: ["tab_id"],
			},
			execute: async (args: { tab_id: string }) => {
				actionsRef.current.closeTab(args.tab_id);
				return textResult(`Tab ${args.tab_id} closed`);
			},
		});

		navigator.modelContext.registerTool({
			name: "close_other_tabs",
			description:
				"[DB Console] Close all editor tabs except the specified one.",
			inputSchema: {
				type: "object",
				properties: {
					tab_id: {
						type: "string",
						description: "Tab ID to keep (from list_tabs)",
					},
				},
				required: ["tab_id"],
			},
			execute: async (args: { tab_id: string }) => {
				actionsRef.current.closeOtherTabs(args.tab_id);
				return textResult("Other tabs closed");
			},
		});

		navigator.modelContext.registerTool({
			name: "close_tabs_to_left",
			description:
				"[DB Console] Close all editor tabs to the left of the specified tab.",
			inputSchema: {
				type: "object",
				properties: {
					tab_id: {
						type: "string",
						description: "Tab ID (from list_tabs)",
					},
				},
				required: ["tab_id"],
			},
			execute: async (args: { tab_id: string }) => {
				actionsRef.current.closeTabsToLeft(args.tab_id);
				return textResult("Tabs to left closed");
			},
		});

		navigator.modelContext.registerTool({
			name: "close_tabs_to_right",
			description:
				"[DB Console] Close all editor tabs to the right of the specified tab.",
			inputSchema: {
				type: "object",
				properties: {
					tab_id: {
						type: "string",
						description: "Tab ID (from list_tabs)",
					},
				},
				required: ["tab_id"],
			},
			execute: async (args: { tab_id: string }) => {
				actionsRef.current.closeTabsToRight(args.tab_id);
				return textResult("Tabs to right closed");
			},
		});

		navigator.modelContext.registerTool({
			name: "select_table",
			description:
				"[DB Console] Open the sidebar Tables tab and select a specific table.",
			inputSchema: {
				type: "object",
				properties: {
					table: {
						type: "string",
						description:
							"Table name, optionally schema-qualified (e.g. 'patient', 'public.encounter')",
					},
				},
				required: ["table"],
			},
			execute: async (args: { table: string }) => {
				const parts = args.table.split(".");
				const schema = parts.length > 1 ? parts[0] : "public";
				const name = parts.length > 1 ? parts[1] : parts[0];
				actionsRef.current.selectTable(schema, name);
				return textResult("Table selected in sidebar");
			},
		});

		navigator.modelContext.registerTool({
			name: "get_table_info",
			description:
				"[DB Console] Get detailed information about a database table: " +
				"columns (name, type, nullable), indexes (name, type, definition), " +
				"approximate row count, and table/indexes size.",
			inputSchema: {
				type: "object",
				properties: {
					table: {
						type: "string",
						description:
							"Table name, optionally schema-qualified (e.g. 'patient', 'public.encounter')",
					},
				},
				required: ["table"],
			},
			execute: async (args: { table: string }) => {
				const parts = args.table.split(".");
				const schema = parts.length > 1 ? parts[0] : "public";
				const name = parts.length > 1 ? parts[1] : parts[0];
				actionsRef.current.selectTable(schema, name);
				try {
					const info = await actionsRef.current.getTableInfo(schema, name);
					return textResult(JSON.stringify(info, null, 2));
				} catch (err) {
					return textResult(
						`Error: ${err instanceof Error ? err.message : String(err)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "drop_index",
			description:
				"[DB Console] Drop a database index by name. " +
				"Use get_table_info first to see available indexes.",
			inputSchema: {
				type: "object",
				properties: {
					index_name: {
						type: "string",
						description: "The index name to drop (from get_table_info)",
					},
				},
				required: ["index_name"],
			},
			execute: async (args: { index_name: string }) => {
				actionsRef.current.openSidebarTab("tables");
				try {
					await actionsRef.current.dropIndex(args.index_name);
					return textResult(`Index "${args.index_name}" dropped`);
				} catch (err) {
					return textResult(
						`Error: ${err instanceof Error ? err.message : String(err)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "get_active_queries",
			description:
				"[DB Console] Get currently running database queries. " +
				"Returns pid, query text, duration in seconds, and database user. " +
				"Use cancel_query with a pid to terminate a query.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.openSidebarTab("queries");
				try {
					const queries = await actionsRef.current.getActiveQueries();
					if (queries.length === 0) {
						return textResult("No active queries");
					}
					return textResult(JSON.stringify(queries, null, 2));
				} catch (err) {
					return textResult(
						`Error: ${err instanceof Error ? err.message : String(err)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "cancel_query",
			description:
				"[DB Console] Cancel an active database query by its PID. " +
				"Use get_active_queries first to find the PID.",
			inputSchema: {
				type: "object",
				properties: {
					pid: {
						type: "number",
						description:
							"Process ID of the query to cancel (from get_active_queries)",
					},
				},
				required: ["pid"],
			},
			execute: async (args: { pid: number }) => {
				actionsRef.current.openSidebarTab("queries");
				try {
					await actionsRef.current.cancelQuery(args.pid);
					return textResult(`Query with PID ${args.pid} cancelled`);
				} catch (err) {
					return textResult(
						`Error: ${err instanceof Error ? err.message : String(err)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "open_sidebar",
			description:
				"[DB Console] Open the left sidebar without changing the active tab.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.openSidebar();
				return textResult("Sidebar opened");
			},
		});

		navigator.modelContext.registerTool({
			name: "show_left_menu",
			description:
				"[DB Console] Open the left sidebar on a specific tab (history, tables, or queries).",
			inputSchema: {
				type: "object",
				properties: {
					tab: {
						type: "string",
						enum: ["history", "tables", "queries"],
						description: "Which sidebar tab to open",
					},
				},
				required: ["tab"],
			},
			execute: async (args: { tab: "history" | "tables" | "queries" }) => {
				actionsRef.current.openSidebarTab(args.tab);
				return textResult(`Sidebar opened on ${args.tab} tab`);
			},
		});

		navigator.modelContext.registerTool({
			name: "toggle_results_panel",
			description:
				"[DB Console] Control the results panel: expand, collapse, maximize, or minimize.",
			inputSchema: {
				type: "object",
				properties: {
					action: {
						type: "string",
						enum: ["expand", "collapse", "maximize", "minimize"],
						description: "Action to perform on the results panel",
					},
				},
				required: ["action"],
			},
			execute: async (args: {
				action: "expand" | "collapse" | "maximize" | "minimize";
			}) => {
				switch (args.action) {
					case "expand":
						actionsRef.current.expandResults();
						break;
					case "collapse":
						actionsRef.current.collapseResults();
						break;
					case "maximize":
						actionsRef.current.maximizeResults();
						break;
					case "minimize":
						actionsRef.current.minimizeResults();
						break;
				}
				return textResult(`Results panel: ${args.action}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "show_explain",
			description:
				"[DB Console] Switch the results panel to the Explain tab. " +
				"Optionally set the view mode to visual (tree) or raw (text).",
			inputSchema: {
				type: "object",
				properties: {
					mode: {
						type: "string",
						enum: ["visual", "raw"],
						description:
							"Explain view mode: visual (tree, default) or raw (text)",
					},
				},
			},
			execute: async (args: { mode?: "visual" | "raw" }) => {
				actionsRef.current.showExplain(args.mode);
				return textResult(
					`Explain tab opened${args.mode ? ` in ${args.mode} mode` : ""}`,
				);
			},
		});

		navigator.modelContext.registerTool({
			name: "get_query_status",
			description:
				"[DB Console] Get the current query execution status: " +
				"loading (query is running), ready (results available), " +
				"error (query failed), or empty (no query executed yet).",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const status = actionsRef.current.getQueryStatus();
				return textResult(JSON.stringify(status));
			},
		});

		navigator.modelContext.registerTool({
			name: "get_results",
			description:
				"[DB Console] Get the query results from the active tab. " +
				"Returns an array of result items, each with query, duration, rows, status, and result data. " +
				"Use limit to cap the number of result items returned.",
			inputSchema: {
				type: "object",
				properties: {
					limit: {
						type: "number",
						description:
							"Maximum number of result items to return (default: all)",
					},
				},
			},
			execute: async (args: { limit?: number }) => {
				const items = actionsRef.current.getResults(args.limit);
				if (items.length === 0) {
					return textResult(
						"No results. Execute a query first or check status with get_query_status.",
					);
				}
				return textResult(JSON.stringify(items, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "set_row_limit",
			description:
				"[DB Console] Set the default row limit applied to queries. " +
				"Common presets: 10, 100, 1000. Use null to disable the limit. " +
				"The limit is applied automatically when executing queries that don't have an explicit LIMIT clause.",
			inputSchema: {
				type: "object",
				properties: {
					limit: {
						type: ["number", "null"],
						description:
							"Row limit to set (e.g. 10, 100, 1000) or null for no limit",
					},
				},
				required: ["limit"],
			},
			execute: async (args: { limit: number | null }) => {
				actionsRef.current.setRowLimit(args.limit);
				return textResult(
					args.limit === null
						? "Row limit disabled"
						: `Row limit set to ${args.limit}`,
				);
			},
		});

		navigator.modelContext.registerTool({
			name: "get_row_limit",
			description:
				"[DB Console] Get the current default row limit applied to queries.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const limit = actionsRef.current.getRowLimit();
				return textResult(limit === null ? "No limit" : String(limit));
			},
		});

		navigator.modelContext.registerTool({
			name: "get_history",
			description:
				"[DB Console] Get SQL query history entries. " +
				"Returns a list of previously executed queries with timestamps, sorted newest first. " +
				"Use optional search to filter by query text.",
			inputSchema: {
				type: "object",
				properties: {
					search: {
						type: "string",
						description:
							"Optional substring to filter history entries by query text",
					},
					limit: {
						type: "number",
						description: "Maximum number of entries to return (default: all)",
					},
				},
			},
			execute: async (args: { search?: string; limit?: number }) => {
				actionsRef.current.openSidebarTab("history");
				const entries = actionsRef.current.getHistory(args.search, args.limit);
				lastHistoryResults = entries.map((e) => e.command);
				if (entries.length === 0) {
					return textResult("No history entries found");
				}
				const withIndex = entries.map((e, i) => ({
					index: i,
					...e,
				}));
				return textResult(JSON.stringify(withIndex, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "open_history_entry",
			description:
				"[DB Console] Open a query from the last get_history result by its index. " +
				"Finds an existing tab with the same query or creates a new tab.",
			inputSchema: {
				type: "object",
				properties: {
					index: {
						type: "number",
						description: "Entry index from the last get_history result",
					},
				},
				required: ["index"],
			},
			execute: async (args: { index: number }) => {
				actionsRef.current.openSidebarTab("history");
				const query = lastHistoryResults[args.index];
				if (query === undefined) {
					return textResult(
						`Invalid index ${args.index}. Call get_history first.`,
					);
				}
				actionsRef.current.openHistoryEntry(query);
				return textResult("Query opened in editor tab");
			},
		});

		navigator.modelContext.registerTool({
			name: "list_tables",
			description:
				"[DB Console] List all database tables grouped by schema. " +
				"Use this when the user asks what tables exist. " +
				"Also opens the Tables sidebar tab in the UI. " +
				"Returns table names grouped by schema (e.g. public, extensions). " +
				"Use get_table_info for detailed info about a specific table.",
			inputSchema: {
				type: "object",
				properties: {
					schema: {
						type: "string",
						description:
							"Optional schema name to filter (e.g. 'public'). Returns all schemas if omitted.",
					},
				},
			},
			execute: async (args: { schema?: string }) => {
				actionsRef.current.openSidebarTab("tables");
				const schemas = actionsRef.current.getSchemas();
				if (args.schema) {
					const tables = schemas[args.schema];
					if (!tables) {
						return textResult(`Schema "${args.schema}" not found`);
					}
					return textResult(JSON.stringify({ [args.schema]: tables }, null, 2));
				}
				return textResult(JSON.stringify(schemas, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "show_result",
			description:
				"[DB Console] Switch the results panel back to the Result tab.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.showResults();
				return textResult("Result tab opened");
			},
		});

		return () => {
			for (const name of TOOL_NAMES) {
				navigator.modelContext?.unregisterTool(name);
			}
		};
	}, [actionsRef]);
}
