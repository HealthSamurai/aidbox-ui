import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

const pages = [
	{
		name: "resource_browser",
		description: "List of all FHIR resource types",
		path: "/resource",
	},
	{
		name: "resources_list",
		description:
			"List of resources for a specific type. Requires: resourceType",
		path: "/resource/$resourceType",
	},
	{
		name: "create_resource",
		description: "Form to create a new resource. Requires: resourceType",
		path: "/resource/$resourceType/create",
	},
	{
		name: "edit_resource",
		description:
			"Form to edit an existing resource. Requires: resourceType, id",
		path: "/resource/$resourceType/edit/$id",
	},
	{
		name: "rest_console",
		description: "REST API console for executing HTTP requests",
		path: "/rest",
	},
	{
		name: "db_console",
		description: "Database SQL console",
		path: "/db-console",
	},
	{
		name: "fhir_packages",
		description: "List of installed FHIR packages",
		path: "/ig",
	},
	{
		name: "import_package",
		description: "Import a FHIR package",
		path: "/ig/add",
	},
	{
		name: "package_detail",
		description: "View details of a FHIR package. Requires: packageId",
		path: "/ig/$packageId",
	},
	{
		name: "canonical_resource",
		description:
			"View a canonical resource within a FHIR package. Requires: packageId, resourceType, resourceId",
		path: "/ig/$packageId/resource/$resourceType/$resourceId",
	},
] as const;

export function useWebMCPNavigation() {
	const navigate = useNavigate();
	const routerState = useRouterState();
	const navigateRef = useRef(navigate);
	navigateRef.current = navigate;

	const currentPath = routerState.location.pathname;

	useEffect(() => {
		if (!navigator.modelContext) return;

		navigator.modelContext.registerTool({
			name: "list_pages",
			description:
				"Returns all available pages in the Aidbox UI application with their names, descriptions, required parameters, and paths. Also returns the current page path.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => ({
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								currentPath,
								pages: pages.map((p) => ({
									name: p.name,
									description: p.description,
									path: p.path,
								})),
							},
							null,
							2,
						),
					},
				],
			}),
		});

		navigator.modelContext.registerTool({
			name: "navigate",
			description:
				"Navigate to a page in the Aidbox UI. Use list_pages first to see available pages and their required parameters.",
			inputSchema: {
				type: "object",
				properties: {
					page: {
						type: "string",
						description: `Page name. One of: ${pages.map((p) => p.name).join(", ")}`,
					},
					resourceType: {
						type: "string",
						description:
							"FHIR resource type (e.g. Patient, Observation). Required for: resources_list, create_resource, edit_resource, canonical_resource",
					},
					id: {
						type: "string",
						description: "Resource ID. Required for: edit_resource",
					},
					packageId: {
						type: "string",
						description:
							"FHIR package ID. Required for: package_detail, canonical_resource",
					},
					resourceId: {
						type: "string",
						description:
							"Canonical resource ID. Required for: canonical_resource",
					},
				},
				required: ["page"],
			},
			execute: async (args: {
				page: string;
				resourceType?: string;
				id?: string;
				packageId?: string;
				resourceId?: string;
			}) => {
				const page = pages.find((p) => p.name === args.page);
				if (!page) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Unknown page "${args.page}". Use list_pages to see available pages.`,
							},
						],
					};
				}

				let path = page.path as string;
				if (args.resourceType) {
					path = path.replace(
						"$resourceType",
						encodeURIComponent(args.resourceType),
					);
				}
				if (args.id) {
					path = path.replace("$id", encodeURIComponent(args.id));
				}
				if (args.packageId) {
					path = path.replace("$packageId", encodeURIComponent(args.packageId));
				}
				if (args.resourceId) {
					path = path.replace(
						"$resourceId",
						encodeURIComponent(args.resourceId),
					);
				}

				if (path.includes("$")) {
					const missing = path.match(/\$\w+/g) || [];
					return {
						content: [
							{
								type: "text" as const,
								text: `Missing required parameters: ${missing.join(", ")}`,
							},
						],
					};
				}

				navigateRef.current({ to: path });

				return {
					content: [
						{
							type: "text" as const,
							text: `Navigated to ${page.name} (${path})`,
						},
					],
				};
			},
		});

		return () => {
			navigator.modelContext?.unregisterTool("list_pages");
			navigator.modelContext?.unregisterTool("navigate");
		};
	}, [currentPath]);
}
