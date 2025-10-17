import { ResourceEditorPage } from "@aidbox-ui/components/ResourceEditor/Page";
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
			return ResourceEditorPage;
	}
};

const PageComponent = () => {
	const Page = resourceTypePageFromParams();
	return <Page />;
};

const TITLE = "Create";

export const Route = createFileRoute("/resource/$resourceType/create")({
	component: PageComponent,
	validateSearch,
	staticData: {
		title: TITLE,
	},
	loader: () => ({
		breadCrumb: TITLE,
	}),
});
