import { createFileRoute } from "@tanstack/react-router";
import { DataLineageViews } from "../components/DataLineage/views";

export const Route = createFileRoute("/data-lineage/views/")({
	staticData: { title: "Views" },
	validateSearch: (search) => ({
		q: typeof search.q === "string" && search.q ? search.q : undefined,
		page:
			typeof search.page === "number" && search.page > 0
				? search.page
				: undefined,
		pageSize:
			typeof search.pageSize === "number" && search.pageSize > 0
				? search.pageSize
				: undefined,
	}),
	component: DataLineageViews,
});
