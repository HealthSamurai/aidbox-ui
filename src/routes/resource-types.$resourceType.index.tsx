import { createFileRoute } from "@tanstack/react-router";
import { Resources } from "../components/ResourceBrowser/resources";
import { ResourcesPage } from "../components/ResourceBrowser/resources-page";

export const Route = createFileRoute("/resource-types/$resourceType/")({
	component: RouteComponent,
	staticData: {
		title: "View Definition",
	},
});

function RouteComponent() {
	const { resourceType } = Route.useParams();
	return <ResourcesPage resourceType={resourceType} />;
}
