import { createFileRoute } from "@tanstack/react-router";
import { DataLineagePage } from "../components/DataLineage/page";

export const Route = createFileRoute("/analytics")({
	staticData: { title: "Analytics" },
	loader: () => ({ breadCrumb: "Analytics" }),
	component: DataLineagePage,
});
