import { createFileRoute } from "@tanstack/react-router";
import ViewDefinitionPage from "../components/ViewDefinition/page";

const PageComponent = () => {
	return <ViewDefinitionPage />;
};

export const Route = createFileRoute("/resource-types/$resourceType/new")({
	component: PageComponent,
	staticData: {
		title: "View Definition",
	},
});
