import type {
	ViewDefinitionEditorTab,
	ViewDefinitionPageTab,
} from "@aidbox-ui/components/ViewDefinition/types";
import { createFileRoute } from "@tanstack/react-router";
import ViewDefinitionPage from "../components/ViewDefinition/page";

export type ViewDefinitionSearch = {
	pageTab: ViewDefinitionPageTab;
	tab: ViewDefinitionEditorTab;
};

const pageTabs: Set<ViewDefinitionPageTab> = new Set([
	"builder",
	"edit",
	"versions",
]);

export const editorTabs: Set<ViewDefinitionEditorTab> = new Set([
	"form",
	"code",
	"sql",
]);

export function validateSearch(
	search: Record<string, unknown>,
): ViewDefinitionSearch {
	let pageTab: ViewDefinitionPageTab;
	if (pageTabs.has(search.pageTab as ViewDefinitionPageTab)) {
		pageTab = search.pageTab as ViewDefinitionPageTab;
	} else if (search.pageTab === undefined) {
		pageTab = "builder";
	} else {
		console.error("Invalid pageTab", search.pageTab, "force to 'builder'");
		pageTab = "builder";
	}

	let tab: ViewDefinitionEditorTab;
	if (editorTabs.has(search.tab as ViewDefinitionEditorTab)) {
		tab = search.tab as ViewDefinitionEditorTab;
	} else if (search.tab === undefined) {
		tab = "code";
	} else {
		console.error("Invalid tab", search.tab, "force to 'code'");
		tab = "code";
	}
	return { pageTab, tab };
}

const TITLE = "View Definition";

export const Route = createFileRoute("/resource/ViewDefinition/create")({
	component: ViewDefinitionPage,
	validateSearch,
	staticData: {
		title: TITLE,
	},
	loader: () => ({
		breadCrumb: TITLE,
	}),
});
