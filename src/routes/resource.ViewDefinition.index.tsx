import { createFileRoute } from "@tanstack/react-router";
import { ResourcesPage } from "../components/ResourceBrowser/page";

export const Route = createFileRoute("/resource/ViewDefinition/")({
	component: RouteComponent,
	staticData: {
		title: "View Definition",
	},
});

function RouteComponent() {
	return <ResourcesPage resourceType={"ViewDefinition"} />;
}
