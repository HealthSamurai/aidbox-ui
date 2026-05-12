import { createFileRoute } from "@tanstack/react-router";
import { DataLineageQueries } from "../components/DataLineage/queries";

export const Route = createFileRoute("/data-lineage/queries/")({
	staticData: { title: "Queries" },
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
	component: DataLineageQueries,
});
