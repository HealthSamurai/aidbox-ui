import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnalyticsListPage, validateAnalyticsSearch } from "./analytics.index";

function ViewsRoute() {
	const { q: searchQ = "" } = Route.useSearch();
	const navigate = useNavigate({ from: "/analytics/views/" });
	const setSearchQ = (next: string) =>
		navigate({
			search: (prev) => ({ ...prev, q: next || undefined }),
			replace: true,
		});
	return (
		<AnalyticsListPage kind="view" searchQ={searchQ} setSearchQ={setSearchQ} />
	);
}

export const Route = createFileRoute("/analytics/views/")({
	staticData: { title: "Views" },
	component: ViewsRoute,
	validateSearch: validateAnalyticsSearch,
});
