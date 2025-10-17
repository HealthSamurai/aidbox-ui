import { createFileRoute } from "@tanstack/react-router";
import ViewDefinitionPage from "../components/ViewDefinition/page";
import { validateSearch } from "./resource.ViewDefinition.create";

const PageComponent = () => {
	const { id } = Route.useParams();
	return <ViewDefinitionPage id={id} />;
};

export const Route = createFileRoute("/resource/ViewDefinition/edit/$id")({
	component: PageComponent,
	validateSearch: validateSearch,
	staticData: {
		title: "Create",
	},
	loader: (cx) => ({
		breadCrumb: cx.params.id,
	}),
});
