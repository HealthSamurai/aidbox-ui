import "@mcp-b/global";

const pages = [
	{
		name: "resource_browser",
		description: "List of all FHIR resource types",
		path: "/resource",
	},
	{
		name: "resources_list",
		description:
			"List of resources for a specific type. Path param: resourceType",
		path: "/resource/{resourceType}",
	},
	{
		name: "create_resource",
		description: "Form to create a new resource. Path param: resourceType",
		path: "/resource/{resourceType}/create",
	},
	{
		name: "edit_resource",
		description:
			"Form to edit an existing resource. Path params: resourceType, id",
		path: "/resource/{resourceType}/edit/{id}",
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
		description: "View details of a FHIR package. Path param: packageId",
		path: "/ig/{packageId}",
	},
	{
		name: "canonical_resource",
		description:
			"View a canonical resource within a FHIR package. Path params: packageId, resourceType, resourceId",
		path: "/ig/{packageId}/resource/{resourceType}/{resourceId}",
	},
];

if (navigator.modelContext) {
	navigator.modelContext.registerTool({
		name: "list_pages",
		description:
			"Returns all available pages in the Aidbox UI with their names, descriptions, and URL paths.",
		inputSchema: { type: "object", properties: {} },
		execute: async () => ({
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(pages, null, 2),
				},
			],
		}),
	});
}
