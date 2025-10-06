import { createFileRoute } from "@tanstack/react-router";
import ViewDefinitionPage from "../../components/ViewDefinition/page";

const PageComponent = () => {
	const { id } = Route.useParams();
	return <ViewDefinitionPage id={id} />;
};

export const Route = createFileRoute("/ViewDefinition/$id")({
	component: PageComponent,
	staticData: {
		title: "View Definitions",
	},
});
