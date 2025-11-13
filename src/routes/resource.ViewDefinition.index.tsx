import { createFileRoute } from "@tanstack/react-router";
import { useAidboxClient } from "../AidboxClient";
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
	const client = useAidboxClient();
	return <ResourcesPage client={client} resourceType={"ViewDefinition"} />;
}
