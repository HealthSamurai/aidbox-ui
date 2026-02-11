import { createFileRoute } from "@tanstack/react-router";
import { useAidboxClient } from "../AidboxClient";
import { ResourcesPage } from "../components/ResourceBrowser/page";

export const Route = createFileRoute("/resource/$resourceType/")({
	component: RouteComponent,
	staticData: {
		title: "View Definition",
	},
	validateSearch: (search) => {
		const res: { searchQuery?: string; identifier?: string } = {};

		if (typeof search.searchQuery === "string") {
			res.searchQuery = search.searchQuery;
		}

		if (typeof search.identifier === "string") {
			res.identifier = search.identifier;
		}

		return res;
	},
});

function RouteComponent() {
	const { resourceType } = Route.useParams();
	const client = useAidboxClient();
	return <ResourcesPage client={client} resourceType={resourceType} />;
}
