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
	"select_table",
	"open_sidebar",
	"show_left_menu",
	"toggle_results_panel",
	"show_explain",
	"show_result",
	"get_history",
	"open_history_entry",
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
