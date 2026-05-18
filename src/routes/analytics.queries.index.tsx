import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnalyticsListPage, validateAnalyticsSearch } from "./analytics.index";

function QueriesRoute() {
	const { q: searchQ = "" } = Route.useSearch();
	const navigate = useNavigate({ from: "/analytics/queries/" });
	const setSearchQ = (next: string) =>
		navigate({
			search: (prev) => ({ ...prev, q: next || undefined }),
			replace: true,
		});
	return (
		<AnalyticsListPage kind="query" searchQ={searchQ} setSearchQ={setSearchQ} />
	);
}

export const Route = createFileRoute("/analytics/queries/")({
	staticData: { title: "Queries" },
	component: QueriesRoute,
	validateSearch: validateAnalyticsSearch,
});
