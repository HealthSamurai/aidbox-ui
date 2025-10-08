import { createFileRoute } from "@tanstack/react-router";
import { Resources } from "../../../components/ResourceBrowser/resources";

export const Route = createFileRoute("/resource-types/$resourceType/")({
	component: RouteComponent,
	staticData: {
		title: "View Definition",
	},
});

function RouteComponent() {
	const { resourceType } = Route.useParams();
	return <Resources resourceType={resourceType} />;
}
