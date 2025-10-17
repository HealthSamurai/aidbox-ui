import { createFileRoute } from "@tanstack/react-router";
import {
	resourceTypePageFromParams,
	validateSearch,
} from "./resource.$resourceType.create";

const PageComponent = () => {
	const Page = resourceTypePageFromParams();
	const { id } = Route.useParams();
	return <Page id={id} />;
};

export const Route = createFileRoute("/resource/$resourceType/edit/$id")({
	component: PageComponent,
	validateSearch: validateSearch,
	staticData: {
		title: "View Definition",
	},
	loader: (cx) => ({
		breadCrumb: cx.params.id,
	}),
});
