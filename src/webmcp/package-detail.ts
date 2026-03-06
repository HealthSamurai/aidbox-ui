import type { RefObject } from "react";
import { useEffect } from "react";
import type { PackageDetailActions } from "./package-detail-context";

function textResult(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

const TOOL_NAMES = [
	"get_active_tab",
	"set_active_tab",
	"get_package_info",
	"set_package_info_view",
	"search_canonicals",
	"select_canonical",
	"reinstall_package",
	"delete_package",
] as const;

export function useWebMCPPackageDetail(
	actionsRef: RefObject<PackageDetailActions>,
) {
	useEffect(() => {
		if (!navigator.modelContext) return;

		navigator.modelContext.registerTool({
			name: "get_active_tab",
			description:
				'[Package Detail] Get the currently active tab ("canonicals" or "package-info").',
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const tab = actionsRef.current.getActiveTab();
				return textResult(JSON.stringify({ tab }));
			},
		});

		navigator.modelContext.registerTool({
			name: "set_active_tab",
			description:
				"[Package Detail] Switch between the Canonicals and Package Info tabs.",
			inputSchema: {
				type: "object",
				properties: {
					tab: {
						type: "string",
						enum: ["canonicals", "package-info"],
						description: "Tab to switch to",
					},
				},
				required: ["tab"],
			},
			execute: async (args: { tab: string }) => {
				actionsRef.current.setActiveTab(args.tab);
				return textResult(`Switched to "${args.tab}" tab`);
			},
		});

		navigator.modelContext.registerTool({
			name: "get_package_info",
			description:
				"[Package Detail] Get package metadata. " +
				'Use format="visual" for a key-value summary, or format="json" for the full metadata object.',
			inputSchema: {
				type: "object",
				properties: {
					format: {
						type: "string",
						enum: ["visual", "json"],
						description:
							'Output format: "visual" (default) for key-value summary, "json" for full metadata',
					},
				},
			},
			execute: async (args: Record<string, unknown>) => {
				const format = (args.format as "visual" | "json") ?? "visual";
				const info = actionsRef.current.getPackageInfo(format);
				return textResult(JSON.stringify(info, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "set_package_info_view",
			description:
				'[Package Detail] Switch the Package Info sub-tab between "visual" and "json" views. ' +
				"Auto-switches to the Package Info tab if not already on it.",
			inputSchema: {
				type: "object",
				properties: {
					view: {
						type: "string",
						enum: ["visual", "json"],
						description: "View to switch to",
					},
				},
				required: ["view"],
			},
			execute: async (args: { view: string }) => {
				actionsRef.current.setPackageInfoView(args.view);
				return textResult(`Switched to "${args.view}" view`);
			},
		});

		navigator.modelContext.registerTool({
			name: "search_canonicals",
			description:
				"[Package Detail] Search canonical resources in this package. " +
				"Returns paginated results with resourceType, url, and id. " +
				"Auto-switches to the Canonicals tab if not already on it.",
			inputSchema: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description:
							"Optional search query to filter by resource type or URL",
					},
					page: {
						type: "number",
						description: "Page number (1-based, default: 1)",
					},
				},
			},
			execute: async (args: Record<string, unknown>) => {
				const query = args.query as string | undefined;
				const page = (args.page as number) ?? 1;
				const result = await actionsRef.current.searchCanonicals(query, page);
				return textResult(JSON.stringify(result, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "select_canonical",
			description:
				"[Package Detail] Navigate to a canonical resource detail page. " +
				"Use search_canonicals first to find resource IDs.",
			inputSchema: {
				type: "object",
				properties: {
					id: {
						type: "string",
						description: "Resource ID (from search_canonicals results)",
					},
				},
				required: ["id"],
			},
			execute: async (args: { id: string }) => {
				actionsRef.current.selectCanonical(args.id);
				return textResult(`Navigating to resource ${args.id}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "reinstall_package",
			description:
				"[Package Detail] Reinstall the current package from the registry. " +
				"Triggers the reinstall confirmation dialog and immediately confirms.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.reinstallPackage();
				return textResult("Reinstall triggered");
			},
		});

		navigator.modelContext.registerTool({
			name: "delete_package",
			description:
				"[Package Detail] Delete the current package. " +
				"Triggers the delete and navigates back to the package list.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.deletePackage();
				return textResult("Delete triggered");
			},
		});

		return () => {
			for (const name of TOOL_NAMES) {
				navigator.modelContext?.unregisterTool(name);
			}
		};
	}, [actionsRef]);
}
