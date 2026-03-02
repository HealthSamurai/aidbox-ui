import { createFileRoute } from "@tanstack/react-router";
import { Browser } from "../components/IGBrowser/browser";

export const Route = createFileRoute("/ig/")({
	component: RouteComponent,
	validateSearch: (search) => ({
		q: typeof search.q === "string" && search.q ? search.q : undefined,
		sort:
			typeof search.sort === "string" && search.sort ? search.sort : undefined,
	}),
});

function RouteComponent() {
	return <Browser />;
}
