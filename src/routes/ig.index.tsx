import { createFileRoute } from "@tanstack/react-router";
import { Browser } from "../components/IGBrowser/browser";

export const Route = createFileRoute("/ig/")({
	component: RouteComponent,
	validateSearch: (search: {
		q?: unknown;
		tags?: unknown;
	}): { q?: string; tags?: string[] } => {
		const out: { q?: string; tags?: string[] } = {};
		if (typeof search.q === "string" && search.q.length > 0) out.q = search.q;
		if (Array.isArray(search.tags)) {
			const tags = search.tags.filter(
				(t): t is string => typeof t === "string" && t.length > 0,
			);
			if (tags.length > 0) out.tags = tags;
		} else if (typeof search.tags === "string" && search.tags.length > 0) {
			out.tags = [search.tags];
		}
		return out;
	},
});

function RouteComponent() {
	return <Browser />;
}
