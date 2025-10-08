import { createFileRoute } from "@tanstack/react-router";
import ViewDefinitionPage from "../../../components/ViewDefinition/page";

const PageComponent = () => {
	const { id, resourceType } = Route.useParams();
	switch (resourceType) {
		case "ViewDefinition":
			return <ViewDefinitionPage id={id} />;
		default:
			return <div>TODO</div>;
	}
};

export const Route = createFileRoute("/resource-types/$resourceType/$id")({
	component: PageComponent,
	staticData: {
		title: "View Definitions",
	},
});
