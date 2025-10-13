import type { ViewDefinitionEditorTab } from "@aidbox-ui/components/ViewDefinition/types";
import { createFileRoute } from "@tanstack/react-router";
import ViewDefinitionPage from "../components/ViewDefinition/page";

const PageComponent = () => {
	const { id, resourceType } = Route.useParams();
	switch (resourceType) {
		case "ViewDefinition":
			return <ViewDefinitionPage id={id} />;
		default:
			return <div>TODO</div>;
	}
};

type ResourcePageSearch = {
	tab: ViewDefinitionEditorTab;
};

const tabs: Set<ViewDefinitionEditorTab> = new Set(["form", "code", "sql"]);

export const Route = createFileRoute("/resource-types/$resourceType/$id")({
	component: PageComponent,
	validateSearch: (search: Record<string, unknown>): ResourcePageSearch => {
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
	},
	staticData: {
		title: "View Definition",
	},
});
