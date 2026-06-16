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
		profile: ["https://sql-on-fhir.org/ig/StructureDefinition/SQLQuery"],
	},
	status: "active",
	type: {
		coding: [
			{
				system: "https://sql-on-fhir.org/ig/CodeSystem/LibraryTypesCodes",
				code: "sql-query",
			},
		],
	},
} as Resource;

const PageComponent = () => {
	const navigate = useNavigate();
	const { tab, mode } = useSearch({ from: "/analytics/queries/create" });

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

export const Route = createFileRoute("/analytics/queries/create")({
	component: PageComponent,
	validateSearch,
	staticData: { title: "Create Query" },
	loader: () => ({ breadCrumb: "Create" }),
});
