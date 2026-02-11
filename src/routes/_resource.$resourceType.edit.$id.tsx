import { ResourceEditorPageWithLoader } from "@aidbox-ui/components/ResourceEditor/page";
import {
	createFileRoute,
	useMatch,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { validateSearch } from "./_resource.$resourceType.create";

const PageComponent = () => {
	const { id } = Route.useParams();
	const navigate = useNavigate({ from: "/_resource/$resourceType/edit/$id" });
	const { tab, mode } = useSearch({
		from: "/_resource/$resourceType/edit/$id",
	});
	const { resourceType } = useMatch({
		from: "/_resource/$resourceType/edit/$id",
	}).params;
	return (
		<ResourceEditorPageWithLoader
			id={id}
			resourceType={resourceType}
			tab={tab}
			mode={mode}
			navigate={navigate}
		/>
	);
};

export const Route = createFileRoute("/_resource/$resourceType/edit/$id")({
	component: PageComponent,
	validateSearch,
	loader: (cx) => ({
		breadCrumb: cx.params.id,
	}),
});
