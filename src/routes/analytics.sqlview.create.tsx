import { ResourceEditorPage } from "@aidbox-ui/components/ResourceEditor/page";
import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { validateSearch } from "./resource.$resourceType.create";

const initialResource: Resource = {
	resourceType: "Library",
	meta: {
		profile: ["https://sql-on-fhir.org/ig/StructureDefinition/SQLView"],
	},
	status: "active",
	type: {
		coding: [
			{
				system: "https://sql-on-fhir.org/ig/CodeSystem/LibraryTypesCodes",
				code: "sql-view",
			},
		],
	},
} as Resource;

const PageComponent = () => {
	const navigate = useNavigate();
	const { tab, mode } = useSearch({ from: "/analytics/sqlview/create" });

	return (
		<ResourceEditorPage
			initialResource={initialResource}
			resourceType="Library"
			tab={tab}
			mode={mode}
			navigate={navigate}
			onCreated={() => navigate({ to: "/analytics" })}
		/>
	);
};

export const Route = createFileRoute("/analytics/sqlview/create")({
	component: PageComponent,
	validateSearch,
	staticData: { title: "Create SQLView" },
	loader: () => ({ breadCrumb: "Create" }),
});
