import type { ViewDefinitionEditorTab } from "@aidbox-ui/components/ViewDefinition/types";
import { createFileRoute, useParams } from "@tanstack/react-router";
import ViewDefinitionPage from "../components/ViewDefinition/page";

export type ViewDefinitionSearch = {
	tab: ViewDefinitionEditorTab;
};

export const tabs: Set<ViewDefinitionEditorTab> = new Set([
	"form",
	"code",
	"sql",
]);

export function validateSearch(
	search: Record<string, unknown>,
): ViewDefinitionSearch {
	let tab: ViewDefinitionEditorTab;
	if (tabs.has(search.tab as ViewDefinitionEditorTab)) {
		tab = search.tab as ViewDefinitionEditorTab;
	} else if (search.tab === undefined) {
		tab = "code";
	} else {
		console.error("Invalid tab", search.tab, "force to 'code'");
		tab = "code";
	}
	return { tab };
}

export const resourceTypePageFromParams = () => {
	// NOTE: we need to specify `from` or Router here, on the router side
	const { resourceType } = useParams({ strict: false });
	switch (resourceType) {
		case "ViewDefinition":
			return ViewDefinitionPage;
		default:
			return (_: { id?: string }) => <div>TODO</div>;
	}
};

const PageComponent = () => {
	const Page = resourceTypePageFromParams();
	return <Page />;
};

export const Route = createFileRoute("/resource-create/$resourceType")({
	component: PageComponent,
	validateSearch,
	staticData: {
		title: "View Definition",
	},
});
