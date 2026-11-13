import { createFileRoute, useParams, useSearch } from "@tanstack/react-router";
import { PlanDefinitionEditorPage } from "../components/SDC/formbox/pages/plan-definitions/plan-definition-editor";

export const Route = createFileRoute("/forms/packages")({
	component: PackageEditorRoute,
});

/** Keep the editor mounted when the first save changes its URL. */
function PackageEditorRoute() {
	const params = useParams({
		from: "/forms/packages/$packageId",
		shouldThrow: false,
	});
	const search = useSearch({
		from: "/forms/packages/new",
		shouldThrow: false,
	});
	return (
		<PlanDefinitionEditorPage
			planDefinitionId={params?.packageId}
			questionnaireIds={search?.forms}
		/>
	);
}
