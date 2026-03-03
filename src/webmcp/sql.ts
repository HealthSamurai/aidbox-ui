import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAidboxClient } from "../AidboxClient";
import { errorResult, textResult } from "./helpers";

function fillEditorAndRun(query: string, attempt = 0) {
	if (attempt > 20) return;
	const editor = document.querySelector(".cm-editor") as HTMLElement | null;
	const view = (
		editor as unknown as {
			cmView?: {
				view: {
					dispatch: (tx: unknown) => void;
					state: { doc: { length: number } };
				};
			};
		}
	)?.cmView?.view;
	if (!view) {
		setTimeout(() => fillEditorAndRun(query, attempt + 1), 100);
		return;
	}
	view.dispatch({
		changes: { from: 0, to: view.state.doc.length, insert: query },
	});
	setTimeout(() => {
		const btn = [...document.querySelectorAll("button")].find(
			(b) => b.textContent?.trim() === "RUN",
		);
		btn?.click();
	}, 100);
}

export function useWebMCPSql() {
	const client = useAidboxClient();
	const clientRef = useRef(client);
	clientRef.current = client;
	const navigate = useNavigate();
	const navigateRef = useRef(navigate);
	navigateRef.current = navigate;

	useEffect(() => {
		if (!navigator.modelContext) return;

		navigator.modelContext.registerTool({
			name: "execute_sql",
			description:
				"[DB Console page] Execute a SQL query against the Aidbox PostgreSQL database. " +
				"Returns rows as JSON array with column names as keys. " +
				"The UI equivalent is typing SQL in the /db-console editor and pressing Ctrl+Enter. " +
				"Supports any PostgreSQL SQL including SELECT, INSERT, UPDATE, DELETE, and DDL.",
			inputSchema: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description:
							"SQL query to execute (e.g. 'SELECT id, resource FROM patient LIMIT 10')",
					},
				},
				required: ["query"],
			},
			execute: async (args: { query: string }) => {
				try {
					const response = await clientRef.current.rawRequest({
						method: "POST",
						url: "/$psql",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ query: args.query }),
					});
					const json = await response.response.json();
					return textResult(json);
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "list_tables",
			description:
				"[DB Console page] List all database tables grouped by schema. " +
				"The UI shows this in the left sidebar of /db-console under the 'Tables' tab. " +
				"Excludes system schemas (pg_catalog, information_schema, pgagent).",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				try {
					const response = await clientRef.current.rawRequest({
						method: "POST",
						url: "/$psql",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							query: `SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pgagent')
ORDER BY table_schema, table_name`,
						}),
					});
					const json = await response.response.json();
					return textResult(json);
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "describe_table",
			description:
				"[DB Console page] Show columns, data types, and nullable info for a database table. " +
				"The UI shows this when clicking a table name in the left sidebar of /db-console.",
			inputSchema: {
				type: "object",
				properties: {
					table: {
						type: "string",
						description:
							"Table name, optionally schema-qualified (e.g. 'patient', 'public.patient')",
					},
				},
				required: ["table"],
			},
			execute: async (args: { table: string }) => {
				try {
					const parts = args.table.split(".");
					const schema = parts.length > 1 ? parts[0] : "public";
					const table = parts.length > 1 ? parts[1] : parts[0];

					const response = await clientRef.current.rawRequest({
						method: "POST",
						url: "/$psql",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							query: `SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = '${schema}' AND table_name = '${table}'
ORDER BY ordinal_position`,
						}),
					});
					const json = await response.response.json();
					return textResult(json);
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "explain_query",
			description:
				"[DB Console page] Run EXPLAIN ANALYZE on a SQL query to show the execution plan. " +
				"The UI shows this in the 'Explain' tab of the /db-console results panel. " +
				"Useful for understanding query performance and index usage.",
			inputSchema: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "SQL query to explain (SELECT only recommended)",
					},
				},
				required: ["query"],
			},
			execute: async (args: { query: string }) => {
				try {
					const response = await clientRef.current.rawRequest({
						method: "POST",
						url: "/$psql",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							query: `EXPLAIN (ANALYZE, COSTS, BUFFERS, FORMAT JSON) ${args.query}`,
						}),
					});
					const json = await response.response.json();
					return textResult(json);
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "get_sql_history",
			description:
				"[DB Console page] Get recent SQL query history. " +
				"The UI shows this in the left sidebar of /db-console under the 'History' tab, grouped by date. " +
				"Returns recent SQL queries with their text and execution date.",
			inputSchema: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "Optional text to filter history entries",
					},
				},
			},
			execute: async (args: { query?: string }) => {
				try {
					const response = await clientRef.current.rawRequest({
						method: "GET",
						url: "/ui_history?.type=sql&_sort=-createdAt&_count=100",
					});
					const json = await response.response.json();
					const entries = (json.entry ?? []).map(
						(e: { resource: { command?: string; createdAt?: string } }) => ({
							command: e.resource.command,
							createdAt: e.resource.createdAt,
						}),
					);

					const q = args.query?.toLowerCase();
					const filtered = q
						? entries.filter((e: { command?: string }) =>
								e.command?.toLowerCase().includes(q),
							)
						: entries;

					return textResult(filtered);
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "show_in_db_console",
			description:
				"[DB Console page] Navigate to DB Console, fill the SQL editor with a query, and execute it visually. " +
				"Use this when the user wants to SEE the query and results in the DB Console UI. " +
				"The query will appear in the editor and results will show in the Result tab below. " +
				"Also returns the query results in the response.",
			inputSchema: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "SQL query to show and execute in DB Console",
					},
				},
				required: ["query"],
			},
			execute: async (args: { query: string }) => {
				try {
					navigateRef.current({ to: "/db-console" });
					fillEditorAndRun(args.query);

					const response = await clientRef.current.rawRequest({
						method: "POST",
						url: "/$psql",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ query: args.query }),
					});
					const json = await response.response.json();
					return textResult(json);
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "show_table_info",
			description:
				"[DB Console page] Navigate to the DB Console Tables tab and select a specific table to show its details " +
				"(columns, indexes, row count, table data size, indexes size). " +
				"Use this when the user wants to SEE table information in the UI. " +
				"Also returns the table details in the response.",
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
				try {
					const parts = args.table.split(".");
					const schema = parts.length > 1 ? parts[0] : "public";
					const table = parts.length > 1 ? parts[1] : parts[0];

					// Set localStorage and dispatch events to update mounted components
					const setLS = (key: string, value: unknown) => {
						localStorage.setItem(key, JSON.stringify(value));
						window.dispatchEvent(
							new CustomEvent("local-storage", {
								detail: { key, value },
							}),
						);
					};
					setLS("db-console-left-menu-open", true);
					setLS("db-console-left-menu-default-tab", "tables");
					setLS("db-console-selected-table", { schema, name: table });

					navigateRef.current({ to: "/db-console" });

					// Fetch table details via API
					const [columnsRes, indexesRes, rowCountRes, sizeRes] =
						await Promise.all([
							clientRef.current.rawRequest({
								method: "POST",
								url: "/$psql",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									query: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='${schema}' AND table_name='${table}' ORDER BY ordinal_position`,
								}),
							}),
							clientRef.current.rawRequest({
								method: "POST",
								url: "/$psql",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									query: `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='${schema}' AND tablename='${table}'`,
								}),
							}),
							clientRef.current.rawRequest({
								method: "POST",
								url: "/$psql",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									query: `SELECT reltuples::bigint as row_count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname='${table}' AND n.nspname='${schema}'`,
								}),
							}),
							clientRef.current.rawRequest({
								method: "POST",
								url: "/$psql",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									query: `SELECT pg_size_pretty(pg_table_size('"${schema}"."${table}"')) AS table_size, pg_size_pretty(pg_indexes_size('"${schema}"."${table}"')) AS indexes_size`,
								}),
							}),
						]);

					const [columns, indexes, rowCount, size] = await Promise.all([
						columnsRes.response.json(),
						indexesRes.response.json(),
						rowCountRes.response.json(),
						sizeRes.response.json(),
					]);

					return textResult({
						table: `${schema}.${table}`,
						navigatedTo: "/db-console (Tables tab)",
						columns: columns[0]?.result ?? columns,
						indexes: indexes[0]?.result ?? indexes,
						rowCount: (rowCount[0]?.result ?? rowCount)[0]?.row_count,
						tableSize: (size[0]?.result ?? size)[0]?.table_size,
						indexesSize: (size[0]?.result ?? size)[0]?.indexes_size,
					});
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		return () => {
			navigator.modelContext?.unregisterTool("execute_sql");
			navigator.modelContext?.unregisterTool("list_tables");
			navigator.modelContext?.unregisterTool("describe_table");
			navigator.modelContext?.unregisterTool("explain_query");
			navigator.modelContext?.unregisterTool("get_sql_history");
			navigator.modelContext?.unregisterTool("show_in_db_console");
			navigator.modelContext?.unregisterTool("show_table_info");
		};
	}, []);
}
