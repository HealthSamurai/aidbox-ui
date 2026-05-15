import { ResourceEditorPage } from "@aidbox-ui/components/ResourceEditor/page";
import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { validateSearch } from "./resource.$resourceType.create";

const initialResource: Resource = {
	resource: "Patient",
	resourceType: "ViewDefinition",
	status: "draft",
	select: [],
} as Resource;

const PageComponent = () => {
	const navigate = useNavigate();
	const { tab, mode } = useSearch({ from: "/data-lineage/views/create" });

	return (
		<ResourceEditorPage
			initialResource={initialResource}
			resourceType="ViewDefinition"
			tab={tab}
			mode={mode}
			navigate={navigate}
			onCreated={(id) =>
				navigate({
					to: "/data-lineage/views/edit/$id",
					params: { id },
					search: {
						tab: "builder" as const,
						mode: "json" as const,
						builderTab: "form" as const,
					},
				})
			}
		/>
	);
};

export const Route = createFileRoute("/data-lineage/views/create")({
	component: PageComponent,
	validateSearch,
	staticData: { title: "Create View" },
	loader: () => ({ breadCrumb: "Create" }),
});
