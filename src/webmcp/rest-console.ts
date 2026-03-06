import type { RefObject } from "react";
import { useEffect } from "react";
import type { RestConsoleActions } from "./rest-console-context";

function textResult(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

const TOOL_NAMES = [
	"toggle_left_menu",
	"set_left_menu_tab",
	"search_history",
	"select_history_item",
	"list_collections",
	"save_to_collection",
	"add_collection_entry",
	"rename_collection",
	"delete_collection",
	"rename_snippet",
	"delete_snippet",
	"list_tabs",
	"select_tab",
	"add_tab",
	"close_tab",
	"close_other_tabs",
	"close_tabs_to_left",
	"close_tabs_to_right",
	"get_raw_request",
	"set_raw_request",
	"get_body_mode",
	"set_body_mode",
	"format_body",
	"get_request_body",
	"set_request_body",
	"get_request_headers",
	"set_request_headers",
	"toggle_request_header",
	"get_request_params",
	"set_request_params",
	"toggle_request_param",
	"send_request",
	"get_response",
	"get_response_tab",
	"set_response_tab",
	"get_panel_layout",
	"set_panel_layout",
] as const;

export function useWebMCPRestConsole(
	actionsRef: RefObject<RestConsoleActions>,
) {
	useEffect(() => {
		if (!navigator.modelContext) return;

		navigator.modelContext.registerTool({
			name: "toggle_left_menu",
			description:
				"[REST Console] Toggle the left sidebar (History / Collections panel). " +
				"Pass open=true to open, open=false to close, or omit to toggle.",
			inputSchema: {
				type: "object",
				properties: {
					open: {
						type: "boolean",
						description:
							"true to open, false to close. Omit to toggle current state.",
					},
				},
			},
			execute: async (args: Record<string, unknown>) => {
				const current = actionsRef.current.getLeftMenuOpen();
				const target = typeof args.open === "boolean" ? args.open : !current;
				actionsRef.current.setLeftMenuOpen(target);
				return textResult(target ? "Left menu opened" : "Left menu closed");
			},
		});

		navigator.modelContext.registerTool({
			name: "set_left_menu_tab",
			description:
				"[REST Console] Switch the left sidebar tab between History and Collections. " +
				"Also opens the left menu if it is closed.",
			inputSchema: {
				type: "object",
				properties: {
					tab: {
						type: "string",
						enum: ["history", "collections"],
						description: "Tab to switch to",
					},
				},
				required: ["tab"],
			},
			execute: async (args: { tab: string }) => {
				if (!actionsRef.current.getLeftMenuOpen()) {
					actionsRef.current.setLeftMenuOpen(true);
				}
				actionsRef.current.setMenuTab(args.tab);
				return textResult(`Switched to "${args.tab}" tab`);
			},
		});

		navigator.modelContext.registerTool({
			name: "search_history",
			description:
				"[REST Console] Search request history. " +
				"Returns recent HTTP requests (method, path, id, date). " +
				"Without a query returns all history items. " +
				"Also opens the left menu and switches to the History tab.",
			inputSchema: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description:
							"Optional search string to filter by method, path, headers, or body",
					},
				},
			},
			execute: async (args: Record<string, unknown>) => {
				if (!actionsRef.current.getLeftMenuOpen()) {
					actionsRef.current.setLeftMenuOpen(true);
				}
				actionsRef.current.setMenuTab("history");
				const query = args.query as string | undefined;
				const items = await actionsRef.current.searchHistory(query);
				return textResult(JSON.stringify(items, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "select_history_item",
			description:
				"[REST Console] Load a history item into a tab by its ID. " +
				"Use search_history first to find item IDs.",
			inputSchema: {
				type: "object",
				properties: {
					id: {
						type: "string",
						description: "History item ID (from search_history results)",
					},
				},
				required: ["id"],
			},
			execute: async (args: { id: string }) => {
				try {
					actionsRef.current.selectHistoryItem(args.id);
					return textResult(`Loaded history item ${args.id} into tab`);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "list_collections",
			description:
				"[REST Console] List all collections and their saved requests. " +
				"Returns collections with name and items (id, method, path, title). " +
				"Also opens the left menu and switches to the Collections tab.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				if (!actionsRef.current.getLeftMenuOpen()) {
					actionsRef.current.setLeftMenuOpen(true);
				}
				actionsRef.current.setMenuTab("collections");
				const collections = await actionsRef.current.listCollections();
				return textResult(JSON.stringify(collections, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "save_to_collection",
			description:
				"[REST Console] Save the current request to a collection. " +
				"If collection name is provided, saves to that collection. " +
				"If omitted, creates a new collection.",
			inputSchema: {
				type: "object",
				properties: {
					collection: {
						type: "string",
						description:
							"Collection name to save to. Omit to create a new collection.",
					},
				},
			},
			execute: async (args: Record<string, unknown>) => {
				try {
					const collection = args.collection as string | undefined;
					await actionsRef.current.saveToCollection(collection);
					return textResult(
						collection
							? `Saved to collection "${collection}"`
							: "Saved to new collection",
					);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "add_collection_entry",
			description:
				"[REST Console] Add a new empty request entry to an existing collection.",
			inputSchema: {
				type: "object",
				properties: {
					collection: {
						type: "string",
						description: "Collection name to add entry to",
					},
				},
				required: ["collection"],
			},
			execute: async (args: { collection: string }) => {
				try {
					await actionsRef.current.addCollectionEntry(args.collection);
					return textResult(
						`Added new entry to collection "${args.collection}"`,
					);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "rename_collection",
			description: "[REST Console] Rename a collection.",
			inputSchema: {
				type: "object",
				properties: {
					name: {
						type: "string",
						description: "Current collection name",
					},
					newName: {
						type: "string",
						description: "New collection name",
					},
				},
				required: ["name", "newName"],
			},
			execute: async (args: { name: string; newName: string }) => {
				try {
					await actionsRef.current.renameCollection(args.name, args.newName);
					return textResult(
						`Renamed collection "${args.name}" to "${args.newName}"`,
					);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "delete_collection",
			description:
				"[REST Console] Delete a collection and all its saved requests.",
			inputSchema: {
				type: "object",
				properties: {
					name: {
						type: "string",
						description: "Collection name to delete",
					},
				},
				required: ["name"],
			},
			execute: async (args: { name: string }) => {
				try {
					await actionsRef.current.deleteCollection(args.name);
					return textResult(`Deleted collection "${args.name}"`);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "rename_snippet",
			description:
				"[REST Console] Rename a saved request (snippet) in a collection. " +
				"Use list_collections to find snippet IDs.",
			inputSchema: {
				type: "object",
				properties: {
					id: {
						type: "string",
						description: "Snippet ID (from list_collections results)",
					},
					newTitle: {
						type: "string",
						description: "New title for the snippet",
					},
				},
				required: ["id", "newTitle"],
			},
			execute: async (args: { id: string; newTitle: string }) => {
				try {
					await actionsRef.current.renameSnippet(args.id, args.newTitle);
					return textResult(`Renamed snippet to "${args.newTitle}"`);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "delete_snippet",
			description:
				"[REST Console] Delete a saved request (snippet) from a collection. " +
				"Use list_collections to find snippet IDs.",
			inputSchema: {
				type: "object",
				properties: {
					id: {
						type: "string",
						description: "Snippet ID to delete",
					},
				},
				required: ["id"],
			},
			execute: async (args: { id: string }) => {
				try {
					await actionsRef.current.deleteSnippet(args.id);
					return textResult(`Deleted snippet ${args.id}`);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "list_tabs",
			description:
				"[REST Console] List all open browser tabs. " +
				"Returns tabs with id, method, path, and selected status.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const tabs = actionsRef.current.listTabs();
				return textResult(JSON.stringify(tabs, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "select_tab",
			description:
				"[REST Console] Switch to a specific browser tab by its ID. " +
				"Use list_tabs to find tab IDs.",
			inputSchema: {
				type: "object",
				properties: {
					id: {
						type: "string",
						description: "Tab ID to select (from list_tabs results)",
					},
				},
				required: ["id"],
			},
			execute: async (args: { id: string }) => {
				try {
					actionsRef.current.selectTab(args.id);
					return textResult(`Selected tab ${args.id}`);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "add_tab",
			description: "[REST Console] Add a new empty request tab and select it.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const id = actionsRef.current.addTab();
				return textResult(`Created new tab ${id}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "close_tab",
			description:
				"[REST Console] Close a browser tab. " +
				"If id is omitted, closes the currently selected tab.",
			inputSchema: {
				type: "object",
				properties: {
					id: {
						type: "string",
						description:
							"Tab ID to close. Omit to close the currently selected tab.",
					},
				},
			},
			execute: async (args: Record<string, unknown>) => {
				try {
					const id = args.id as string | undefined;
					actionsRef.current.closeTab(id);
					return textResult(id ? `Closed tab ${id}` : "Closed current tab");
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "close_other_tabs",
			description:
				"[REST Console] Close all tabs except the specified one. " +
				"If id is omitted, keeps the currently selected tab.",
			inputSchema: {
				type: "object",
				properties: {
					id: {
						type: "string",
						description:
							"Tab ID to keep. Omit to keep the currently selected tab.",
					},
				},
			},
			execute: async (args: Record<string, unknown>) => {
				try {
					actionsRef.current.closeOtherTabs(args.id as string | undefined);
					return textResult("Closed other tabs");
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "close_tabs_to_left",
			description:
				"[REST Console] Close all tabs to the left of the specified tab. " +
				"If id is omitted, uses the currently selected tab.",
			inputSchema: {
				type: "object",
				properties: {
					id: {
						type: "string",
						description:
							"Tab ID as anchor. Omit to use the currently selected tab.",
					},
				},
			},
			execute: async (args: Record<string, unknown>) => {
				try {
					actionsRef.current.closeTabsToLeft(args.id as string | undefined);
					return textResult("Closed tabs to the left");
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "close_tabs_to_right",
			description:
				"[REST Console] Close all tabs to the right of the specified tab. " +
				"If id is omitted, uses the currently selected tab.",
			inputSchema: {
				type: "object",
				properties: {
					id: {
						type: "string",
						description:
							"Tab ID as anchor. Omit to use the currently selected tab.",
					},
				},
			},
			execute: async (args: Record<string, unknown>) => {
				try {
					actionsRef.current.closeTabsToRight(args.id as string | undefined);
					return textResult("Closed tabs to the right");
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "get_raw_request",
			description:
				"[REST Console] Get the full raw HTTP request text " +
				"(method, path, headers, body as a single string). " +
				"Switches to the Raw tab.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.setRequestSubTab("raw");
				return textResult(actionsRef.current.getRawRequest());
			},
		});

		navigator.modelContext.registerTool({
			name: "set_raw_request",
			description:
				"[REST Console] Set the request from raw HTTP text. " +
				"The text is parsed into method, path, headers, and body. " +
				"Switches to the Raw tab. " +
				'Example: "POST /fhir/Patient\\nContent-Type: application/json\\n\\n{\\"a\\": 1}"',
			inputSchema: {
				type: "object",
				properties: {
					raw: {
						type: "string",
						description: "Raw HTTP request text",
					},
				},
				required: ["raw"],
			},
			execute: async (args: { raw: string }) => {
				try {
					actionsRef.current.setRequestSubTab("raw");
					actionsRef.current.setRawRequest(args.raw);
					return textResult("Raw request updated");
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "get_body_mode",
			description:
				"[REST Console] Get the current body editor mode (json or yaml). " +
				"Switches to the Body tab.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.setRequestSubTab("body");
				return textResult(actionsRef.current.getBodyMode());
			},
		});

		navigator.modelContext.registerTool({
			name: "set_body_mode",
			description:
				"[REST Console] Switch the body editor between JSON and YAML. " +
				"Converts the body content to the new format automatically. " +
				"Switches to the Body tab.",
			inputSchema: {
				type: "object",
				properties: {
					mode: {
						type: "string",
						enum: ["json", "yaml"],
						description: "Body mode to switch to",
					},
				},
				required: ["mode"],
			},
			execute: async (args: { mode: "json" | "yaml" }) => {
				try {
					actionsRef.current.setRequestSubTab("body");
					actionsRef.current.setBodyMode(args.mode);
					return textResult(`Body mode set to ${args.mode}`);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "format_body",
			description:
				"[REST Console] Format (pretty-print) the request body " +
				"based on the current mode (JSON or YAML). " +
				"Switches to the Body tab.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				try {
					actionsRef.current.setRequestSubTab("body");
					actionsRef.current.formatBody();
					return textResult("Body formatted");
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "get_request_body",
			description:
				"[REST Console] Get the request body from the selected tab. " +
				"Switches to the Body tab.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.setRequestSubTab("body");
				return textResult(actionsRef.current.getRequestBody());
			},
		});

		navigator.modelContext.registerTool({
			name: "set_request_body",
			description:
				"[REST Console] Set the request body on the selected tab. " +
				"Switches to the Body tab.",
			inputSchema: {
				type: "object",
				properties: {
					body: { type: "string", description: "Request body content" },
				},
				required: ["body"],
			},
			execute: async (args: { body: string }) => {
				try {
					actionsRef.current.setRequestSubTab("body");
					actionsRef.current.setRequestBody(args.body);
					return textResult("Request body updated");
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "get_request_headers",
			description:
				"[REST Console] Get the request headers. " +
				"Returns list of {name, value, enabled}. " +
				"Switches to the Headers tab.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.setRequestSubTab("headers");
				return textResult(
					JSON.stringify(actionsRef.current.getRequestHeaders(), null, 2),
				);
			},
		});

		navigator.modelContext.registerTool({
			name: "set_request_headers",
			description:
				"[REST Console] Replace all request headers. " +
				"Each header has name, value, and optional enabled (default true).",
			inputSchema: {
				type: "object",
				properties: {
					headers: {
						type: "array",
						items: {
							type: "object",
							properties: {
								name: { type: "string" },
								value: { type: "string" },
								enabled: { type: "boolean" },
							},
							required: ["name", "value"],
						},
						description: "Headers to set",
					},
				},
				required: ["headers"],
			},
			execute: async (args: {
				headers: { name: string; value: string; enabled?: boolean }[];
			}) => {
				try {
					actionsRef.current.setRequestSubTab("headers");
					actionsRef.current.setRequestHeaders(args.headers);
					return textResult("Request headers updated");
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "toggle_request_header",
			description:
				"[REST Console] Enable or disable a request header by name. " +
				"If enabled is omitted, toggles the current state.",
			inputSchema: {
				type: "object",
				properties: {
					name: {
						type: "string",
						description: "Header name to toggle",
					},
					enabled: {
						type: "boolean",
						description: "true to enable, false to disable. Omit to toggle.",
					},
				},
				required: ["name"],
			},
			execute: async (args: { name: string; enabled?: boolean }) => {
				try {
					actionsRef.current.setRequestSubTab("headers");
					actionsRef.current.toggleRequestHeader(args.name, args.enabled);
					return textResult(`Toggled header "${args.name}"`);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "get_request_params",
			description:
				"[REST Console] Get the request query parameters. " +
				"Returns list of {name, value, enabled}. " +
				"Switches to the Params tab.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.setRequestSubTab("params");
				return textResult(
					JSON.stringify(actionsRef.current.getRequestParams(), null, 2),
				);
			},
		});

		navigator.modelContext.registerTool({
			name: "set_request_params",
			description:
				"[REST Console] Replace all request query parameters. " +
				"Each param has name, value, and optional enabled (default true). " +
				"The URL path is updated automatically.",
			inputSchema: {
				type: "object",
				properties: {
					params: {
						type: "array",
						items: {
							type: "object",
							properties: {
								name: { type: "string" },
								value: { type: "string" },
								enabled: { type: "boolean" },
							},
							required: ["name", "value"],
						},
						description: "Query parameters to set",
					},
				},
				required: ["params"],
			},
			execute: async (args: {
				params: { name: string; value: string; enabled?: boolean }[];
			}) => {
				try {
					actionsRef.current.setRequestSubTab("params");
					actionsRef.current.setRequestParams(args.params);
					return textResult("Request params updated");
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "toggle_request_param",
			description:
				"[REST Console] Enable or disable a request query parameter by name. " +
				"If enabled is omitted, toggles the current state.",
			inputSchema: {
				type: "object",
				properties: {
					name: {
						type: "string",
						description: "Parameter name to toggle",
					},
					enabled: {
						type: "boolean",
						description: "true to enable, false to disable. Omit to toggle.",
					},
				},
				required: ["name"],
			},
			execute: async (args: { name: string; enabled?: boolean }) => {
				try {
					actionsRef.current.setRequestSubTab("params");
					actionsRef.current.toggleRequestParam(args.name, args.enabled);
					return textResult(`Toggled param "${args.name}"`);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "send_request",
			description:
				"[REST Console] Send the current request and return the response. " +
				"Returns status, headers, body, and duration.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				try {
					const response = await actionsRef.current.sendRequest();
					return textResult(JSON.stringify(response, null, 2));
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "get_response",
			description:
				"[REST Console] Get the current response data " +
				"(status, statusText, headers, body, duration). Returns null if no response.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const response = actionsRef.current.getResponse();
				if (!response) return textResult("No response yet");
				return textResult(JSON.stringify(response, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "get_response_tab",
			description:
				"[REST Console] Get the active response tab (body, headers, raw, or explain).",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				return textResult(actionsRef.current.getResponseTab());
			},
		});

		navigator.modelContext.registerTool({
			name: "set_response_tab",
			description: "[REST Console] Switch the response panel tab.",
			inputSchema: {
				type: "object",
				properties: {
					tab: {
						type: "string",
						enum: ["body", "headers", "raw", "explain"],
						description: "Response tab to switch to",
					},
				},
				required: ["tab"],
			},
			execute: async (args: { tab: string }) => {
				try {
					actionsRef.current.setResponseTab(args.tab);
					return textResult(`Switched response tab to "${args.tab}"`);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "get_panel_layout",
			description:
				"[REST Console] Get the current panel layout: " +
				'"vertical" (stacked), "horizontal" (side by side), ' +
				'"request-maximized", or "response-maximized".',
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				return textResult(actionsRef.current.getPanelLayout());
			},
		});

		navigator.modelContext.registerTool({
			name: "set_panel_layout",
			description:
				"[REST Console] Change the panel layout. " +
				'"vertical" stacks request on top / response below, ' +
				'"horizontal" puts them side by side, ' +
				'"request-maximized" / "response-maximized" expand to full height.',
			inputSchema: {
				type: "object",
				properties: {
					layout: {
						type: "string",
						enum: [
							"vertical",
							"horizontal",
							"request-maximized",
							"response-maximized",
						],
						description: "Panel layout to set",
					},
				},
				required: ["layout"],
			},
			execute: async (args: { layout: string }) => {
				try {
					actionsRef.current.setPanelLayout(args.layout);
					return textResult(`Panel layout set to "${args.layout}"`);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		return () => {
			for (const name of TOOL_NAMES) {
				navigator.modelContext?.unregisterTool(name);
			}
		};
	}, [actionsRef]);
}
