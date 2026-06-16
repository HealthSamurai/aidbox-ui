import { ResourceEditorPageWithLoader } from "@aidbox-ui/components/ResourceEditor/page";
import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { validateSearch } from "./resource.$resourceType.create";

const PageComponent = () => {
	const { id } = Route.useParams();
	const navigate = useNavigate({ from: "/analytics/sqlview/edit/$id" });
	const { tab, mode } = useSearch({
		from: "/analytics/sqlview/edit/$id",
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
					to: "/analytics",
				})
			}
		/>
	);
};

export const Route = createFileRoute("/analytics/sqlview/edit/$id")({
	component: PageComponent,
	validateSearch,
	loader: (cx) => ({ breadCrumb: cx.params.id }),
});
