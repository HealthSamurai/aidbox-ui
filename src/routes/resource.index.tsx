import { createFileRoute } from "@tanstack/react-router";
import { Browser } from "../components/ResourceBrowser/browser";

export const Route = createFileRoute("/resource/")({
	component: RouteComponent,
	validateSearch: (search) => ({
		q: typeof search.q === "string" && search.q ? search.q : undefined,
	}),
});

function RouteComponent() {
	return <Browser />;
}
