import { createFileRoute } from "@tanstack/react-router";
import { SearchParamsStats } from "../components/database/search-params-stats";

export const Route = createFileRoute("/database/search-params")({
	staticData: { title: "Search params stats" },
	loader: () => ({ breadCrumb: "Search params stats" }),
	component: SearchParamsStats,
});
