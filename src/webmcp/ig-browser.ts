import type { RefObject } from "react";
import { useEffect } from "react";
import type { IGBrowserActions } from "./ig-browser-context";

function textResult(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

const TOOL_NAMES = [
	"list_packages",
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
				"The query supports tag chips combined with free text matched against name, version and description. " +
				"Tags include the install kind (#system, #direct, #transitive) and the package type (e.g. #fhir.core, #fhir.ig, #ig, #conformance). " +
				"Returns an array of {name, version, tags} objects.",
			inputSchema: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description:
							"Optional search query. Free text is fuzzy-matched against name, version and description; tokens prefixed with # (e.g. #system #direct #transitive) filter by tag.",
					},
				},
			},
			execute: async (args: Record<string, unknown>) => {
				const query = (args.query ?? args.search ?? args.filter) as
					| string
					| undefined;
				const packages = actionsRef.current.listPackages(query);
				return textResult(
					JSON.stringify(
						{
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
