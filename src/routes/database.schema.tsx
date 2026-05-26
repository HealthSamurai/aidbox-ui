import { createFileRoute } from "@tanstack/react-router";
import { SchemaExplorer } from "../components/database/schema-explorer";

export const Route = createFileRoute("/database/schema")({
	staticData: { title: "Schema explorer" },
	loader: () => ({ breadCrumb: "Schema explorer" }),
	component: SchemaExplorer,
});
