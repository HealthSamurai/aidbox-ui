import { createFileRoute } from "@tanstack/react-router";
import { PackageDetail } from "../components/IGBrowser/package-detail";

export const Route = createFileRoute("/ig/$packageId/")({
	component: PackageDetail,
	validateSearch: (search): { tab?: string; view?: "json"; q?: string } => ({
		tab:
			typeof search.tab === "string" && search.tab.length > 0
				? search.tab
				: undefined,
		view: search.view === "json" ? ("json" as const) : undefined,
		q: typeof search.q === "string" ? search.q : undefined,
	}),
});
