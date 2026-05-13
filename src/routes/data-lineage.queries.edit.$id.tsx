import { ResourceEditorPageWithLoader } from "@aidbox-ui/components/ResourceEditor/page";
import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { validateSearch } from "./resource.$resourceType.create";

const PageComponent = () => {
	const { id } = Route.useParams();
	const navigate = useNavigate({ from: "/data-lineage/queries/edit/$id" });
	const { tab, mode } = useSearch({
		from: "/data-lineage/queries/edit/$id",
	});
	return (
		<ResourceEditorPageWithLoader
			id={id}
			resourceType="Library"
			tab={tab}
			mode={mode}
			navigate={navigate}
			onDeleted={() =>
				navigate({
					to: "/data-lineage/queries",
					search: { q: undefined, page: undefined, pageSize: undefined },
				})
			}
		/>
	);
};

export const Route = createFileRoute("/data-lineage/queries/edit/$id")({
	component: PageComponent,
	validateSearch,
	loader: (cx) => ({ breadCrumb: cx.params.id }),
});
