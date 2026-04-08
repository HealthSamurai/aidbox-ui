import { createFileRoute } from "@tanstack/react-router";
import { PackageDetail } from "../components/IGBrowser/package-detail";

const VALID_TABS = new Set(["package-info", "examples"]);

export const Route = createFileRoute("/ig/$packageId/")({
	component: PackageDetail,
	validateSearch: (search) => ({
		tab: VALID_TABS.has(search.tab as string)
			? (search.tab as "package-info" | "examples")
			: undefined,
		view: search.view === "json" ? ("json" as const) : undefined,
		q: typeof search.q === "string" ? search.q : undefined,
		page: typeof search.page === "number" ? search.page : undefined,
	}),
});
