import type { RefObject } from "react";
import { useEffect } from "react";
import type { CanonicalResourceActions } from "./canonical-resource-context";

function textResult(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

const TOOL_NAMES = [
	"get_resource_info",
	"get_active_view",
	"set_active_view",
	"get_resource_json",
	"get_structure_elements",
	"get_valueset_expansion",
	"search_valueset_expansion",
	"open_in_editor",
] as const;

export function useWebMCPCanonicalResource(
	actionsRef: RefObject<CanonicalResourceActions>,
) {
	useEffect(() => {
		if (!navigator.modelContext) return;

		navigator.modelContext.registerTool({
			name: "get_resource_info",
			description:
				"[Canonical Resource] Get basic info about the current canonical resource: name, url, version, resourceType, and packageId.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const info = actionsRef.current.getResourceInfo();
				return textResult(JSON.stringify(info, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "get_active_view",
			description:
				"[Canonical Resource] Get the currently active view tab (json, differential, snapshot, or expansion).",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const view = actionsRef.current.getActiveView();
				return textResult(JSON.stringify({ view }));
			},
		});

		navigator.modelContext.registerTool({
			name: "set_active_view",
			description:
				"[Canonical Resource] Switch the active view tab. Available tabs depend on the resource type: " +
				"StructureDefinition/FHIRSchema have json, differential, snapshot; " +
				"ValueSet has json, expansion; " +
				"others have json only.",
			inputSchema: {
				type: "object",
				properties: {
					view: {
						type: "string",
						description:
							"Tab to switch to (json, differential, snapshot, or expansion)",
					},
				},
				required: ["view"],
			},
			execute: async (args: { view: string }) => {
				try {
					actionsRef.current.setActiveView(args.view);
					return textResult(`Switched to "${args.view}" view`);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "get_resource_json",
			description:
				"[Canonical Resource] Get the full FHIR resource JSON for the current canonical resource.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const json = actionsRef.current.getResourceJson();
				if (!json) return textResult("Resource JSON is not loaded yet");
				return textResult(JSON.stringify(json, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "get_structure_elements",
			description:
				"[Canonical Resource] Get the structure elements (differential or snapshot) for a StructureDefinition or FHIRSchema resource. " +
				"Returns an error if the current resource is not a StructureDefinition or FHIRSchema.",
			inputSchema: {
				type: "object",
				properties: {
					type: {
						type: "string",
						enum: ["differential", "snapshot"],
						description:
							"Which element view to retrieve: differential or snapshot",
					},
				},
				required: ["type"],
			},
			execute: async (args: { type: "differential" | "snapshot" }) => {
				try {
					actionsRef.current.setActiveView(args.type);
					const elements = await actionsRef.current.getStructureElements(
						args.type,
					);
					return textResult(JSON.stringify(elements, null, 2));
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "get_valueset_expansion",
			description:
				"[Canonical Resource] Expand a ValueSet and return the list of concepts [{system, code, display}]. " +
				"Returns an error if the current resource is not a ValueSet or if expansion fails.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				try {
					actionsRef.current.setActiveView("expansion");
					const concepts = await actionsRef.current.getValueSetExpansion();
					const limited = concepts.slice(0, 100);
					return textResult(
						JSON.stringify(
							{
								total: concepts.length,
								showing: limited.length,
								concepts: limited,
							},
							null,
							2,
						),
					);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "search_valueset_expansion",
			description:
				"[Canonical Resource] Search within a ValueSet expansion by filter string. " +
				"Filters server-side by code or display. Returns matching concepts and total count. " +
				"Returns an error if the current resource is not a ValueSet.",
			inputSchema: {
				type: "object",
				properties: {
					filter: {
						type: "string",
						description: "Search string to filter concepts by code or display",
					},
				},
				required: ["filter"],
			},
			execute: async (args: { filter: string }) => {
				try {
					actionsRef.current.setActiveView("expansion");
					const result = await actionsRef.current.searchValueSetExpansion(
						args.filter,
					);
					const limited = {
						...result,
						concepts: result.concepts.slice(0, 100),
						showing: Math.min(result.concepts.length, 100),
					};
					return textResult(JSON.stringify(limited, null, 2));
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "open_in_editor",
			description:
				"[Canonical Resource] Navigate to the resource editor page for the current canonical resource.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.openInEditor();
				return textResult("Navigated to resource editor");
			},
		});

		return () => {
			for (const name of TOOL_NAMES) {
				navigator.modelContext?.unregisterTool(name);
			}
		};
	}, [actionsRef]);
}
