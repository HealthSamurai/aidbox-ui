import { ResourceEditorPageWithLoader } from "@aidbox-ui/components/ResourceEditor/page";
import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { validateSearch } from "./resource.$resourceType.create";

const PageComponent = () => {
	const { id } = Route.useParams();
	const navigate = useNavigate({ from: "/analytics/views/edit/$id" });
	const { tab, mode } = useSearch({
		from: "/analytics/views/edit/$id",
	});
	return (
		<ResourceEditorPageWithLoader
			id={id}
			resourceType="ViewDefinition"
			tab={tab}
			mode={mode}
			navigate={navigate}
			onDeleted={() =>
				navigate({
					to: "/analytics/views",
					search: { q: undefined, page: undefined, pageSize: undefined },
				})
			}
		/>
	);
};

export const Route = createFileRoute("/analytics/views/edit/$id")({
	component: PageComponent,
	validateSearch,
	loader: (cx) => ({ breadCrumb: cx.params.id }),
});
