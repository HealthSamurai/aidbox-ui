import { ResourceEditorPage } from "@aidbox-ui/components/ResourceEditor/page";
import {
	createFileRoute,
	useMatch,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { validateSearch } from "./resource.$resourceType.create";

const PageComponent = () => {
	const { id } = Route.useParams();
	const navigate = useNavigate({ from: "/resource/$resourceType/edit/$id" });
	const { tab } = useSearch({ from: "/resource/$resourceType/edit/$id" });
	const { resourceType } = useMatch({
		from: "/resource/$resourceType/edit/$id",
	}).params;
	return (
		<ResourceEditorPage
			id={id}
			resourceType={resourceType}
			tab={tab}
			navigate={navigate}
		/>
	);
};

export const Route = createFileRoute("/resource/$resourceType/edit/$id")({
	component: PageComponent,
	validateSearch,
	loader: (cx) => ({
		breadCrumb: cx.params.id,
	}),
});
