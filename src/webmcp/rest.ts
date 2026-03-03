import { useEffect, useRef } from "react";
import { useAidboxClient } from "../AidboxClient";
import { errorResult, textResult } from "./helpers";

export function useWebMCPRest() {
	const client = useAidboxClient();
	const clientRef = useRef(client);
	clientRef.current = client;

	useEffect(() => {
		if (!navigator.modelContext) return;

		navigator.modelContext.registerTool({
			name: "execute_request",
			description:
				"[REST Console page] Execute an HTTP request against the Aidbox API. " +
				"Returns status code, response headers, body, and duration. " +
				"The UI equivalent is the /rest page where you compose requests with method, path, headers, body and press Ctrl+Enter. " +
				"Supports GET, POST, PUT, PATCH, DELETE methods.",
			inputSchema: {
				type: "object",
				properties: {
					method: {
						type: "string",
						description: "HTTP method: GET, POST, PUT, PATCH, or DELETE",
					},
					path: {
						type: "string",
						description:
							"Request path (e.g. '/fhir/Patient', '/rpc', '/$psql')",
					},
					headers: {
						type: "object",
						description:
							'HTTP headers as key-value pairs (e.g. {"Content-Type": "application/json"})',
					},
					body: {
						type: "string",
						description: "Request body as string (JSON, YAML, etc.)",
					},
				},
				required: ["method", "path"],
			},
			execute: async (args: {
				method: string;
				path: string;
				headers?: Record<string, string>;
				body?: string;
			}) => {
				try {
					const start = performance.now();
					const response = await clientRef.current.rawRequest({
						method: args.method,
						url: args.path,
						...(args.headers ? { headers: args.headers } : {}),
						...(args.body ? { body: args.body } : {}),
					});
					const duration = Math.round(performance.now() - start);

					const responseHeaders: Record<string, string> = {};
					response.response.headers.forEach((value: string, key: string) => {
						responseHeaders[key] = value;
					});

					let body: unknown;
					const contentType =
						response.response.headers.get("content-type") ?? "";
					if (contentType.includes("json")) {
						body = await response.response.json();
					} else {
						body = await response.response.text();
					}

					return textResult({
						status: response.response.status,
						statusText: response.response.statusText,
						duration: `${duration}ms`,
						headers: responseHeaders,
						body,
					});
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "get_request_history",
			description:
				"[REST Console page] Get recent HTTP request history. " +
				"The UI shows this in the left sidebar of /rest page under the 'History' tab, grouped by date. " +
				"Returns the last 100 requests with their method, path, headers, and body.",
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
						url: "/ui_history?.type=http&_sort=-createdAt&_count=100",
					});
					const json = await response.response.json();
					const entries = (json.entry ?? []).map(
						(e: { resource: { command?: string; createdAt?: string } }) => ({
							command: e.resource.command,
							createdAt: e.resource.createdAt,
						}),
					);

					const query = args.query?.toLowerCase();
					const filtered = query
						? entries.filter((e: { command?: string }) =>
								e.command?.toLowerCase().includes(query),
							)
						: entries;

					return textResult(filtered);
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "list_collections",
			description:
				"[REST Console page] List all saved request collections. " +
				"The UI shows these in the left sidebar of /rest page under the 'Collections' tab. " +
				"Collections group saved HTTP requests. Returns collection names and their requests.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				try {
					const response = await clientRef.current.rawRequest({
						method: "GET",
						url: "/ui_snippet",
					});
					const json = await response.response.json();
					const entries = (json.entry ?? []).map(
						(e: {
							resource: {
								id?: string;
								title?: string;
								collection?: string;
								command?: string;
							};
						}) => ({
							id: e.resource.id,
							title: e.resource.title,
							collection: e.resource.collection ?? "(root)",
							command: e.resource.command,
						}),
					);

					const grouped: Record<
						string,
						{ id: string; title?: string; command?: string }[]
					> = {};
					for (const e of entries) {
						const col = e.collection;
						if (!grouped[col]) grouped[col] = [];
						grouped[col].push({
							id: e.id,
							title: e.title,
							command: e.command,
						});
					}

					return textResult(grouped);
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "save_to_collection",
			description:
				"[REST Console page] Save an HTTP request to a collection. Creates the collection if it doesn't exist. " +
				"The UI equivalent is composing a request in /rest, clicking Save, and choosing a collection. " +
				"Use this to quickly build collections of API requests.",
			inputSchema: {
				type: "object",
				properties: {
					collection: {
						type: "string",
						description: "Collection name (e.g. 'FHIR CRUD', 'Observations')",
					},
					title: {
						type: "string",
						description:
							"Request title (e.g. 'Create Observation', 'Get Patient by ID')",
					},
					method: {
						type: "string",
						description: "HTTP method: GET, POST, PUT, PATCH, or DELETE",
					},
					path: {
						type: "string",
						description: "Request path (e.g. '/fhir/Observation')",
					},
					headers: {
						type: "object",
						description:
							"HTTP headers (default: Content-Type and Accept as application/json)",
					},
					body: {
						type: "string",
						description: "Request body as string (JSON, etc.)",
					},
				},
				required: ["collection", "title", "method", "path"],
			},
			execute: async (args: {
				collection: string;
				title: string;
				method: string;
				path: string;
				headers?: Record<string, string>;
				body?: string;
			}) => {
				try {
					const headers = args.headers ?? {
						"Content-Type": "application/json",
						Accept: "application/json",
					};
					const headerLines = Object.entries(headers)
						.map(([k, v]) => `${k}: ${v}`)
						.join("\n");
					const command = `${args.method} ${args.path}\n${headerLines}\n\n${args.body ?? ""}`;

					const response = await clientRef.current.rawRequest({
						method: "POST",
						url: "/ui_snippet",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							resourceType: "ui_snippet",
							type: "http",
							collection: args.collection,
							title: args.title,
							command,
						}),
					});
					const json = await response.response.json();
					return textResult({
						saved: true,
						id: json.id,
						collection: args.collection,
						title: args.title,
					});
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "delete_collection",
			description:
				"[REST Console page] Delete a collection or a single saved request. " +
				"To delete a whole collection, provide the collection name. " +
				"To delete a single request, provide its id.",
			inputSchema: {
				type: "object",
				properties: {
					collection: {
						type: "string",
						description: "Collection name to delete all requests in it",
					},
					id: {
						type: "string",
						description: "Single snippet ID to delete",
					},
				},
			},
			execute: async (args: { collection?: string; id?: string }) => {
				try {
					if (args.id) {
						await clientRef.current.rawRequest({
							method: "DELETE",
							url: `/ui_snippet/${args.id}`,
						});
						return textResult({ deleted: args.id });
					}
					if (args.collection) {
						const response = await clientRef.current.rawRequest({
							method: "GET",
							url: `/ui_snippet?.collection=${encodeURIComponent(args.collection)}`,
						});
						const json = await response.response.json();
						const ids = (json.entry ?? []).map(
							(e: { resource: { id: string } }) => e.resource.id,
						);
						if (ids.length === 0) {
							return textResult({
								deleted: 0,
								message: "Collection not found",
							});
						}
						await clientRef.current.rawRequest({
							method: "DELETE",
							url: `/ui_snippet`,
							headers: { "x-conditional-delete": "remove-all" },
						});
						return textResult({
							deleted: ids.length,
							collection: args.collection,
						});
					}
					return errorResult(
						"Provide either 'collection' name or 'id' to delete",
					);
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		return () => {
			navigator.modelContext?.unregisterTool("execute_request");
			navigator.modelContext?.unregisterTool("get_request_history");
			navigator.modelContext?.unregisterTool("list_collections");
			navigator.modelContext?.unregisterTool("save_to_collection");
			navigator.modelContext?.unregisterTool("delete_collection");
		};
	}, []);
}
