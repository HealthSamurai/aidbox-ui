import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAidboxClient } from "../AidboxClient";
import { errorResult, textResult } from "./helpers";

export function useWebMCPResources() {
	const client = useAidboxClient();
	const clientRef = useRef(client);
	clientRef.current = client;
	const navigate = useNavigate();
	const navigateRef = useRef(navigate);
	navigateRef.current = navigate;

	useEffect(() => {
		if (!navigator.modelContext) return;

		navigator.modelContext.registerTool({
			name: "list_resource_types",
			description:
				"[Resource Browser page] List all available FHIR resource types in this Aidbox instance. " +
				"Returns resource type names and their canonical URLs. " +
				"The UI shows these on the /resource page as a searchable list with favorites.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				try {
					const response = await clientRef.current.rawRequest({
						method: "GET",
						url: "/fhir/StructureDefinition?kind=resource&derivation=specialization&_count=1000&_elements=type,name,url",
					});
					const json = await response.response.json();
					const types = (json.entry ?? []).map(
						(e: {
							resource: { type?: string; name?: string; url?: string };
						}) => ({
							type: e.resource.type ?? e.resource.name,
							url: e.resource.url,
						}),
					);
					return textResult(types);
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "search_resources",
			description:
				"[Resource Browser page] Search FHIR resources of a given type using FHIR search parameters. " +
				"Returns a FHIR Bundle with matching resources. " +
				"The UI shows these on /resource/{type} page with sortable table, pagination, and bulk actions.",
			inputSchema: {
				type: "object",
				properties: {
					resourceType: {
						type: "string",
						description: "FHIR resource type (e.g. 'Patient', 'Observation')",
					},
					query: {
						type: "string",
						description:
							"FHIR search query string (e.g. 'name=John&_count=10&_sort=-_lastUpdated'). Leave empty for default search.",
					},
				},
				required: ["resourceType"],
			},
			execute: async (args: { resourceType: string; query?: string }) => {
				try {
					const url = args.query
						? `/fhir/${args.resourceType}?${args.query}`
						: `/fhir/${args.resourceType}?_count=20&_sort=-_lastUpdated`;
					const response = await clientRef.current.rawRequest({
						method: "GET",
						url,
					});
					const json = await response.response.json();

					return textResult({
						total: json.total,
						count: json.entry?.length ?? 0,
						resources: (json.entry ?? []).map(
							(e: { resource: Record<string, unknown> }) => e.resource,
						),
					});
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "read_resource",
			description:
				"[Resource Browser page] Read a single FHIR resource by type and ID. " +
				"Returns the full JSON representation. " +
				"The UI shows this on /resource/{type}/edit/{id} page in a JSON/YAML editor.",
			inputSchema: {
				type: "object",
				properties: {
					resourceType: {
						type: "string",
						description: "FHIR resource type (e.g. 'Patient')",
					},
					id: { type: "string", description: "Resource ID" },
				},
				required: ["resourceType", "id"],
			},
			execute: async (args: { resourceType: string; id: string }) => {
				try {
					const response = await clientRef.current.rawRequest({
						method: "GET",
						url: `/fhir/${args.resourceType}/${args.id}`,
					});
					const json = await response.response.json();
					return textResult(json);
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "create_resource",
			description:
				"[Resource Browser page] Create a new FHIR resource. " +
				"Accepts a JSON object with resourceType and fields. Returns the created resource with server-assigned ID. " +
				"The UI equivalent is the /resource/{type}/create page with a JSON editor and Save button.",
			inputSchema: {
				type: "object",
				properties: {
					resourceType: {
						type: "string",
						description: "FHIR resource type (e.g. 'Patient')",
					},
					resource: {
						type: "object",
						description:
							"Resource JSON body (resourceType field will be set automatically)",
					},
				},
				required: ["resourceType", "resource"],
			},
			execute: async (args: {
				resourceType: string;
				resource: Record<string, unknown>;
			}) => {
				try {
					const body = { ...args.resource, resourceType: args.resourceType };
					const response = await clientRef.current.rawRequest({
						method: "POST",
						url: `/fhir/${args.resourceType}`,
						headers: { "Content-Type": "application/fhir+json" },
						body: JSON.stringify(body),
					});
					const json = await response.response.json();
					return textResult(json);
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "update_resource",
			description:
				"[Resource Browser page] Update an existing FHIR resource (full replacement via PUT). " +
				"The UI equivalent is editing on /resource/{type}/edit/{id} and clicking Save.",
			inputSchema: {
				type: "object",
				properties: {
					resourceType: { type: "string", description: "FHIR resource type" },
					id: { type: "string", description: "Resource ID" },
					resource: { type: "object", description: "Full resource JSON body" },
				},
				required: ["resourceType", "id", "resource"],
			},
			execute: async (args: {
				resourceType: string;
				id: string;
				resource: Record<string, unknown>;
			}) => {
				try {
					const body = {
						...args.resource,
						resourceType: args.resourceType,
						id: args.id,
					};
					const response = await clientRef.current.rawRequest({
						method: "PUT",
						url: `/fhir/${args.resourceType}/${args.id}`,
						headers: { "Content-Type": "application/fhir+json" },
						body: JSON.stringify(body),
					});
					const json = await response.response.json();
					return textResult(json);
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "delete_resource",
			description:
				"[Resource Browser page] Delete a FHIR resource by type and ID. " +
				"The UI equivalent is the Delete button on /resource/{type}/edit/{id} page (with confirmation dialog).",
			inputSchema: {
				type: "object",
				properties: {
					resourceType: { type: "string", description: "FHIR resource type" },
					id: { type: "string", description: "Resource ID" },
				},
				required: ["resourceType", "id"],
			},
			execute: async (args: { resourceType: string; id: string }) => {
				try {
					await clientRef.current.rawRequest({
						method: "DELETE",
						url: `/fhir/${args.resourceType}/${args.id}`,
					});
					return textResult({ deleted: `${args.resourceType}/${args.id}` });
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "open_resource",
			description:
				"[Resource Browser page] Search for a FHIR resource and open it in the UI editor in one step. " +
				"Searches by type and optional query, picks the result at the given index, navigates to its edit page, " +
				"and returns a summary. Use this instead of search_resources + navigate for quick access.",
			inputSchema: {
				type: "object",
				properties: {
					resourceType: {
						type: "string",
						description: "FHIR resource type (e.g. 'Patient', 'Observation')",
					},
					query: {
						type: "string",
						description:
							"FHIR search query (e.g. 'name=Yundt', 'code=8310-5'). Leave empty for most recent.",
					},
					index: {
						type: "number",
						description:
							"Which result to open (0-based, default: 0 = first match)",
					},
				},
				required: ["resourceType"],
			},
			execute: async (args: {
				resourceType: string;
				query?: string;
				index?: number;
			}) => {
				try {
					const idx = args.index ?? 0;
					const url = args.query
						? `/fhir/${args.resourceType}?${args.query}&_count=${idx + 1}&_sort=-_lastUpdated`
						: `/fhir/${args.resourceType}?_count=${idx + 1}&_sort=-_lastUpdated`;
					const response = await clientRef.current.rawRequest({
						method: "GET",
						url,
					});
					const json = await response.response.json();
					const entries = json.entry ?? [];
					if (entries.length <= idx) {
						return errorResult(
							`No resource found at index ${idx}. Total results: ${json.total ?? 0}`,
						);
					}
					const resource = entries[idx].resource;
					const id = resource.id;

					navigateRef.current({
						to: `/resource/${encodeURIComponent(args.resourceType)}/edit/${encodeURIComponent(id)}`,
					});

					const summary: Record<string, unknown> = {
						resourceType: resource.resourceType,
						id,
					};
					if (resource.name) summary.name = resource.name;
					if (resource.birthDate) summary.birthDate = resource.birthDate;
					if (resource.gender) summary.gender = resource.gender;
					if (resource.status) summary.status = resource.status;
					if (resource.code) summary.code = resource.code;
					if (resource.subject) summary.subject = resource.subject;
					if (resource.meta?.lastUpdated)
						summary.lastUpdated = resource.meta.lastUpdated;

					return textResult({
						navigatedTo: `/resource/${args.resourceType}/edit/${id}`,
						resource: summary,
						total: json.total,
					});
				} catch (e) {
					return errorResult((e as Error).message);
				}
			},
		});

		return () => {
			navigator.modelContext?.unregisterTool("list_resource_types");
			navigator.modelContext?.unregisterTool("search_resources");
			navigator.modelContext?.unregisterTool("read_resource");
			navigator.modelContext?.unregisterTool("create_resource");
			navigator.modelContext?.unregisterTool("update_resource");
			navigator.modelContext?.unregisterTool("delete_resource");
			navigator.modelContext?.unregisterTool("open_resource");
		};
	}, []);
}
