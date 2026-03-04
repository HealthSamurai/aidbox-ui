import type { RefObject } from "react";
import { useEffect } from "react";
import type { IGBrowserActions } from "./ig-browser-context";

function textResult(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

const TOOL_NAMES = [
	"list_packages",
	"sort_packages",
	"select_package",
	"open_installation_page",
] as const;

export function useWebMCPIGBrowser(actionsRef: RefObject<IGBrowserActions>) {
	useEffect(() => {
		if (!navigator.modelContext) return;

		navigator.modelContext.registerTool({
			name: "list_packages",
			description:
				"[FHIR Packages] Set the search filter and return the filtered list of installed FHIR packages. " +
				"Returns an array of {name, version, type} objects.",
			inputSchema: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description:
							"Optional search query to filter packages by name or type",
					},
				},
			},
			execute: async (args: Record<string, unknown>) => {
				const query = (args.query ?? args.search ?? args.filter) as
					| string
					| undefined;
				const packages = actionsRef.current.listPackages(query);
				const sort = actionsRef.current.getSort();
				return textResult(
					JSON.stringify(
						{
							sort,
							total: packages.length,
							packages,
						},
						null,
						2,
					),
				);
			},
		});

		navigator.modelContext.registerTool({
			name: "sort_packages",
			description:
				"[FHIR Packages] Sort the packages table by clicking a column header. " +
				"Works like a toggle: first call sorts asc, second call on the same column flips to desc. " +
				"Returns the resulting sort state.",
			inputSchema: {
				type: "object",
				properties: {
					column: {
						type: "string",
						enum: ["name", "type"],
						description: "Column to sort by",
					},
				},
				required: ["column"],
			},
			execute: async (args: { column: "name" | "type" }) => {
				actionsRef.current.sortPackages(args.column);
				const result = actionsRef.current.getSort();
				return textResult(JSON.stringify(result));
			},
		});

		navigator.modelContext.registerTool({
			name: "select_package",
			description:
				"[FHIR Packages] Navigate to a package detail page. " +
				"Use list_packages first to get package IDs (format: name#version).",
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
				actionsRef.current.selectPackage(args.id);
				return textResult(`Navigated to package ${args.id}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "open_installation_page",
			description:
				"[FHIR Packages] Navigate to the package installation page to import a new FHIR package.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				actionsRef.current.openInstallationPage();
				return textResult("Opened package installation page");
			},
		});

		return () => {
			for (const name of TOOL_NAMES) {
				navigator.modelContext?.unregisterTool(name);
			}
		};
	}, [actionsRef]);
}
