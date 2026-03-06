import type { RefObject } from "react";
import { useEffect } from "react";
import type { ResourceInstancesActions } from "./resource-instances-context";

function textResult(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

const TOOL_NAMES = [
	"switch_tab",
	"instances_get_search",
	"instances_search",
	"instances_get_results",
	"instances_get_page",
	"instances_get_selected",
	"instances_select",
	"instances_delete_selected",
	"instances_export_selected",
	"instances_change_page",
	"instances_change_page_size",
	"instances_navigate_to_resource",
	"instances_open_create_page",
	"profiles_list",
	"profiles_select",
	"profiles_select_tab",
	"search_params_list",
] as const;

export function useWebMCPResourceInstances(
	actionsRef: RefObject<ResourceInstancesActions>,
) {
	useEffect(() => {
		if (!navigator.modelContext) return;

		navigator.modelContext.registerTool({
			name: "switch_tab",
			description:
				"[Resource Instances] Switch between tabs: resources (instances), profiles, extensions (search parameters).",
			inputSchema: {
				type: "object",
				properties: {
					tab: {
						type: "string",
						enum: ["resources", "profiles", "extensions"],
						description:
							"Tab to switch to: 'resources' (instances), 'profiles', 'extensions' (search parameters)",
					},
				},
				required: ["tab"],
			},
			execute: async (args: { tab: string }) => {
				actionsRef.current.switchTab(args.tab);
				return textResult(`Switched to ${args.tab} tab`);
			},
		});

		navigator.modelContext.registerTool({
			name: "instances_get_search",
			description:
				"[Resource Instances] Get the current FHIR search query string " +
				"(e.g. '_count=30&_page=1&_ilike=john').",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				return textResult(actionsRef.current.instancesGetSearch());
			},
		});

		navigator.modelContext.registerTool({
			name: "instances_search",
			description:
				"[Resource Instances] Set the FHIR search query and execute. " +
				"Input is the query string part (e.g. '_count=30&_page=1&_ilike=john'). " +
				"The query is shown in the search input as 'GET /fhir/{resourceType}?{query}'.",
			inputSchema: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description:
							"FHIR search query params (e.g. '_count=30&_page=1&_ilike=test')",
					},
				},
				required: ["query"],
			},
			execute: async (args: { query: string }) => {
				actionsRef.current.instancesSearch(args.query);
				return textResult(`Search query set to: ${args.query}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "instances_get_results",
			description:
				"[Resource Instances] Get the currently displayed table data " +
				"including resources, total count, pagination info, and column names.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const results = actionsRef.current.instancesGetResults();
				if (!results) return textResult("No data loaded yet");
				return textResult(JSON.stringify(results, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "instances_get_page",
			description:
				"[Resource Instances] Get current pagination state: page number, page size, and total count.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				return textResult(
					JSON.stringify(actionsRef.current.instancesGetPage()),
				);
			},
		});

		navigator.modelContext.registerTool({
			name: "instances_get_selected",
			description:
				"[Resource Instances] Get the IDs of all currently selected resources.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const ids = actionsRef.current.instancesGetSelected();
				if (ids.length === 0) return textResult("No resources selected");
				return textResult(JSON.stringify(ids));
			},
		});

		navigator.modelContext.registerTool({
			name: "instances_select",
			description:
				"[Resource Instances] Select or deselect resources by ID. " +
				'Pass ids=["*"] to select/deselect all on current page.',
			inputSchema: {
				type: "object",
				properties: {
					ids: {
						type: "array",
						items: { type: "string" },
						description:
							'Resource IDs to select. Use ["*"] for all on current page.',
					},
					selected: {
						type: "boolean",
						description: "true to select (default), false to deselect",
					},
				},
				required: ["ids"],
			},
			execute: async (args: { ids: string[]; selected?: boolean }) => {
				const selected = args.selected !== false;
				actionsRef.current.instancesSelect(args.ids, selected);
				const action = selected ? "Selected" : "Deselected";
				const target =
					args.ids.length === 1 && args.ids[0] === "*"
						? "all resources"
						: `${args.ids.length} resource(s)`;
				return textResult(`${action} ${target}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "instances_delete_selected",
			description:
				"[Resource Instances] Delete all currently selected resources. " +
				"Use instances_select first to select resources.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				try {
					const deleted = await actionsRef.current.instancesDeleteSelected();
					return textResult(
						`Deleted ${deleted.length} resource(s): ${deleted.join(", ")}`,
					);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "instances_export_selected",
			description:
				"[Resource Instances] Export currently selected resources as a FHIR Bundle JSON. " +
				"Use instances_select first to select resources.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const bundle = actionsRef.current.instancesExportSelected();
				if (!bundle) return textResult("No resources selected");
				return textResult(JSON.stringify(bundle, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "instances_change_page",
			description:
				"[Resource Instances] Navigate to a specific page of results.",
			inputSchema: {
				type: "object",
				properties: {
					page: {
						type: "number",
						description: "Page number (1-based)",
					},
				},
				required: ["page"],
			},
			execute: async (args: { page: number }) => {
				actionsRef.current.instancesChangePage(args.page);
				return textResult(`Changed to page ${args.page}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "instances_change_page_size",
			description:
				"[Resource Instances] Change the number of resources per page.",
			inputSchema: {
				type: "object",
				properties: {
					pageSize: {
						type: "number",
						enum: [10, 20, 30, 50, 100],
						description: "Number of resources per page",
					},
				},
				required: ["pageSize"],
			},
			execute: async (args: { pageSize: number }) => {
				actionsRef.current.instancesChangePageSize(args.pageSize);
				return textResult(`Page size changed to ${args.pageSize}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "instances_navigate_to_resource",
			description:
				"[Resource Instances] Navigate to the edit page for a specific resource by ID.",
			inputSchema: {
				type: "object",
				properties: {
					id: {
						type: "string",
						description: "Resource ID to navigate to",
					},
				},
				required: ["id"],
			},
			execute: async (args: { id: string }) => {
				actionsRef.current.instancesNavigateToResource(args.id);
				return textResult(`Navigated to resource ${args.id}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "instances_open_create_page",
			description:
				"[Resource Instances] Navigate to the create page for a new resource of this type.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.instancesOpenCreatePage();
				return textResult("Opened create page");
			},
		});

		navigator.modelContext.registerTool({
			name: "profiles_list",
			description:
				"[Resource Instances] List all StructureDefinition profiles for the current resource type. " +
				"Returns url, name, version, and whether it's the default profile.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				try {
					const profiles = await actionsRef.current.profilesList();
					return textResult(JSON.stringify(profiles, null, 2));
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "profiles_select",
			description:
				"[Resource Instances] Select a profile by URL to open its detail panel. " +
				"Automatically switches to the Profiles tab.",
			inputSchema: {
				type: "object",
				properties: {
					url: {
						type: "string",
						description: "Profile URL to select",
					},
				},
				required: ["url"],
			},
			execute: async (args: { url: string }) => {
				actionsRef.current.profilesSelect(args.url);
				return textResult(`Selected profile: ${args.url}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "profiles_select_tab",
			description:
				"[Resource Instances] Switch the profile detail tab. " +
				"A profile must be selected first via profiles_select.",
			inputSchema: {
				type: "object",
				properties: {
					tab: {
						type: "string",
						enum: [
							"differential",
							"snapshot",
							"fhirschema",
							"structuredefinition",
						],
						description: "Detail tab to switch to",
					},
				},
				required: ["tab"],
			},
			execute: async (args: {
				tab: "differential" | "snapshot" | "fhirschema" | "structuredefinition";
			}) => {
				actionsRef.current.profilesSelectTab(args.tab);
				return textResult(`Switched to ${args.tab} tab`);
			},
		});

		navigator.modelContext.registerTool({
			name: "search_params_list",
			description:
				"[Resource Instances] List all SearchParameter resources available for the current resource type. " +
				"Returns id, url, code, name, type, and description for each parameter.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				try {
					const params = await actionsRef.current.searchParamsList();
					return textResult(JSON.stringify(params, null, 2));
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
