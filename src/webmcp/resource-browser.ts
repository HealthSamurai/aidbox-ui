import type { RefObject } from "react";
import { useEffect } from "react";
import type { ResourceBrowserActions } from "./resource-browser-context";

function textResult(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

const TOOL_NAMES = [
	"list_resource_types",
	"get_favorites",
	"toggle_favorite",
	"navigate_to_resource_type",
] as const;

export function useWebMCPResourceBrowser(
	actionsRef: RefObject<ResourceBrowserActions>,
) {
	useEffect(() => {
		if (!navigator.modelContext) return;

		navigator.modelContext.registerTool({
			name: "list_resource_types",
			description:
				"[Resource Browser] List all available FHIR resource types. " +
				"Optionally filter by name. Returns array of {resourceType, url, isFavorite}.",
			inputSchema: {
				type: "object",
				properties: {
					filter: {
						type: "string",
						description:
							"Optional filter string to search resource types by name",
					},
				},
			},
			execute: async (args: Record<string, unknown>) => {
				const filter = (args.filter ?? args.query ?? args.search) as
					| string
					| undefined;
				const types = actionsRef.current.listResourceTypes(filter);
				return textResult(
					JSON.stringify(
						{ total: types.length, resourceTypes: types },
						null,
						2,
					),
				);
			},
		});

		navigator.modelContext.registerTool({
			name: "get_favorites",
			description:
				"[Resource Browser] Get the list of favorite (pinned) resource types.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const favorites = actionsRef.current.getFavorites();
				return textResult(JSON.stringify(favorites, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "toggle_favorite",
			description:
				"[Resource Browser] Pin or unpin a resource type as favorite. " +
				"If already favorited, removes it; otherwise adds it.",
			inputSchema: {
				type: "object",
				properties: {
					resourceType: {
						type: "string",
						description: "The resource type name to toggle (e.g. 'Patient')",
					},
				},
				required: ["resourceType"],
			},
			execute: async (args: { resourceType: string }) => {
				const wasFav = actionsRef.current
					.getFavorites()
					.includes(args.resourceType);
				actionsRef.current.toggleFavorite(args.resourceType);
				return textResult(
					`${args.resourceType} ${wasFav ? "removed from" : "added to"} favorites`,
				);
			},
		});

		navigator.modelContext.registerTool({
			name: "navigate_to_resource_type",
			description:
				"[Resource Browser] Navigate to the resource instances page for a given resource type.",
			inputSchema: {
				type: "object",
				properties: {
					resourceType: {
						type: "string",
						description:
							"The resource type to navigate to (e.g. 'Patient', 'Observation')",
					},
				},
				required: ["resourceType"],
			},
			execute: async (args: { resourceType: string }) => {
				actionsRef.current.navigateToResourceType(args.resourceType);
				return textResult(`Navigated to ${args.resourceType}`);
			},
		});

		return () => {
			for (const name of TOOL_NAMES) {
				navigator.modelContext?.unregisterTool(name);
			}
		};
	}, [actionsRef]);
}
