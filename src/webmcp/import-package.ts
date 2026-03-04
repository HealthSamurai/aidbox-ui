import type { RefObject } from "react";
import { useEffect } from "react";
import type { ImportPackageActions } from "./import-package-context";

function textResult(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

const TOOL_NAMES = [
	"get_package_import_method",
	"set_package_import_method",
	"method_registry_search_package",
	"method_registry_select_package",
	"get_packages_to_install",
	"method_url_add_url",
	"import_packages",
	"get_import_status",
	"show_import_logs",
] as const;

export function useWebMCPImportPackage(
	actionsRef: RefObject<ImportPackageActions>,
) {
	useEffect(() => {
		if (!navigator.modelContext) return;

		navigator.modelContext.registerTool({
			name: "get_package_import_method",
			description:
				"[Import Package] Get the currently selected import method (registry, url, or file).",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const method = actionsRef.current.getImportMethod();
				return textResult(JSON.stringify({ method }));
			},
		});

		navigator.modelContext.registerTool({
			name: "set_package_import_method",
			description:
				"[Import Package] Switch the import method tab. Use this before interacting with a specific method's tools.",
			inputSchema: {
				type: "object",
				properties: {
					method: {
						type: "string",
						enum: ["registry", "url", "file"],
						description: "The import method to switch to",
					},
				},
				required: ["method"],
			},
			execute: async (args: { method: "registry" | "url" | "file" }) => {
				actionsRef.current.setImportMethod(args.method);
				return textResult(`Switched to "${args.method}" import method`);
			},
		});

		navigator.modelContext.registerTool({
			name: "method_registry_search_package",
			description:
				"[Import Package] Search the FHIR package registry by query. " +
				"Only available when import method is 'registry'. " +
				"Returns an array of {name, version} objects.",
			inputSchema: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "Search query to filter packages by name",
					},
				},
				required: ["query"],
			},
			execute: async (args: { query: string }) => {
				const all = actionsRef.current.searchRegistryPackage(args.query);
				const packages = all.slice(0, 20);
				return textResult(
					JSON.stringify(
						{ total: all.length, showing: packages.length, packages },
						null,
						2,
					),
				);
			},
		});

		navigator.modelContext.registerTool({
			name: "method_registry_select_package",
			description:
				"[Import Package] Toggle selection of a registry package for import. " +
				"Use method_registry_search_package first to find packages. " +
				"ID format: name#version (e.g. hl7.fhir.r4.core#4.0.1).",
			inputSchema: {
				type: "object",
				properties: {
					id: {
						type: "string",
						description:
							"Package ID in name#version format (e.g. hl7.fhir.r4.core#4.0.1)",
					},
				},
				required: ["id"],
			},
			execute: async (args: { id: string }) => {
				actionsRef.current.selectRegistryPackage(args.id);
				return textResult(`Toggled selection for package ${args.id}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "get_packages_to_install",
			description:
				"[Import Package] Get the list of packages/URLs/files currently selected for import.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const result = actionsRef.current.getPackagesToInstall();
				return textResult(JSON.stringify(result, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "method_url_add_url",
			description:
				"[Import Package] Add a URL to the import list. " +
				"Only available when import method is 'url'.",
			inputSchema: {
				type: "object",
				properties: {
					url: {
						type: "string",
						description: "URL to a .tar.gz FHIR package file",
					},
				},
				required: ["url"],
			},
			execute: async (args: { url: string }) => {
				actionsRef.current.addUrl(args.url);
				return textResult(`Added URL: ${args.url}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "import_packages",
			description:
				"[Import Package] Trigger the import of all selected packages/URLs/files. " +
				"Returns the import result.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const result = await actionsRef.current.importPackages();
				return textResult(result);
			},
		});

		navigator.modelContext.registerTool({
			name: "get_import_status",
			description:
				"[Import Package] Check if an import is currently in progress and how many log entries exist.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const status = actionsRef.current.getImportStatus();
				return textResult(JSON.stringify(status));
			},
		});

		navigator.modelContext.registerTool({
			name: "show_import_logs",
			description:
				"[Import Package] Get the import log messages. Returns the last 50 log entries.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const logs = actionsRef.current.getImportLogs();
				return textResult(
					JSON.stringify(
						{ total: logs.length, logs: logs.slice(-50) },
						null,
						2,
					),
				);
			},
		});

		return () => {
			for (const name of TOOL_NAMES) {
				navigator.modelContext?.unregisterTool(name);
			}
		};
	}, [actionsRef]);
}
