import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnalyticsListPage, validateAnalyticsSearch } from "./analytics.index";

function QueriesRoute() {
	const search = Route.useSearch();
	const text = search.q ?? "";
	const tags = search.tags ?? [];
	const navigate = useNavigate({ from: "/analytics/queries/" });
	const setText = (next: string) =>
		navigate({
			search: (prev) => ({ ...prev, q: next || undefined }),
			replace: true,
		});
	const setTags = (next: string[]) =>
		navigate({
			search: (prev) => ({ ...prev, tags: next.length > 0 ? next : undefined }),
			replace: true,
		});
	return (
		<AnalyticsListPage
			kind="query"
			text={text}
			tags={tags}
			setText={setText}
			setTags={setTags}
		/>
	);
}

export const Route = createFileRoute("/analytics/queries/")({
	staticData: { title: "Queries" },
	component: QueriesRoute,
	validateSearch: validateAnalyticsSearch,
});
