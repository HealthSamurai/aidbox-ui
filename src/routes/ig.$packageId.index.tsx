import { createFileRoute } from "@tanstack/react-router";
import { PackageDetail } from "../components/IGBrowser/package-detail";

export const Route = createFileRoute("/ig/$packageId/")({
	component: PackageDetail,
	validateSearch: (search) => ({
		tab: search.tab === "package-info" ? ("package-info" as const) : undefined,
		view: search.view === "json" ? ("json" as const) : undefined,
		q: typeof search.q === "string" ? search.q : undefined,
		page: typeof search.page === "number" ? search.page : undefined,
	}),
});
