import { createFileRoute } from "@tanstack/react-router";
import { resourceTypePageFromParams, validateSearch } from "./resource-create.$resourceType";

const PageComponent = () => {
	const Page = resourceTypePageFromParams();
	const { id } = Route.useParams();
	return <Page id={id} />;
};

export const Route = createFileRoute("/resource-edit/$resourceType/$id")({
	component: PageComponent,
	validateSearch: validateSearch,
	staticData: {
		title: "View Definition",
	},
});
