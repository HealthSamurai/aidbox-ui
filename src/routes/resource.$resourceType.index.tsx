import { createFileRoute } from "@tanstack/react-router";
import { ResourcesPage } from "../components/ResourceBrowser/page";

export const Route = createFileRoute("/resource/$resourceType/")({
	component: RouteComponent,
	staticData: {
		title: "View Definition",
	},
});

function RouteComponent() {
	const { resourceType } = Route.useParams();
	return <ResourcesPage resourceType={resourceType} />;
}
