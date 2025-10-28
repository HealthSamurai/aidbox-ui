import { createFileRoute } from "@tanstack/react-router";
import { ResourcesPage } from "../components/ResourceBrowser/page";

export const Route = createFileRoute("/resource/ViewDefinition/")({
	component: RouteComponent,
	staticData: {
		title: "View Definition",
	},
	validateSearch: (search) => {
		if (typeof search.searchQuery === "string") {
			return { searchQuery: search.searchQuery };
		} else {
			return {};
		}
	},
});

function RouteComponent() {
	return <ResourcesPage resourceType={"ViewDefinition"} />;
}
