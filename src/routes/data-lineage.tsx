import { createFileRoute } from "@tanstack/react-router";
import { DataLineagePage } from "../components/DataLineage/page";

export const Route = createFileRoute("/data-lineage")({
	staticData: { title: "Data Lineage" },
	loader: () => ({ breadCrumb: "Data Lineage" }),
	component: DataLineagePage,
});
