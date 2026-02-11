import { ResourceEditorPage } from "@aidbox-ui/components/ResourceEditor/page";
import {
	type BuilderTab,
	type EditorMode,
	isBuilderTab,
	isEditorMode,
	isResourceEditorTab,
	type ResourceEditorTab,
} from "@aidbox-ui/components/ResourceEditor/types";
import {
	createFileRoute,
	useMatch,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";

export type ResourceEditorSearch = {
	tab: ResourceEditorTab;
	mode: EditorMode;
	builderTab: BuilderTab;
};

const STORAGE_KEY_TAB = "resourceEditor-selectedTab";
const STORAGE_KEY_BUILDER_TAB = "resourceEditor-selectedBuilderTab";

function getStoredTab(): ResourceEditorTab | null {
	try {
		const val = localStorage.getItem(STORAGE_KEY_TAB);
		return isResourceEditorTab(val) ? val : null;
	} catch {
		return null;
	}
}

function getStoredBuilderTab(): BuilderTab | null {
	try {
		const val = localStorage.getItem(STORAGE_KEY_BUILDER_TAB);
		return isBuilderTab(val) ? val : null;
	} catch {
		return null;
	}
}

export function storeSelectedTab(tab: ResourceEditorTab) {
	try {
		localStorage.setItem(STORAGE_KEY_TAB, tab);
	} catch {}
}

export function storeSelectedBuilderTab(builderTab: BuilderTab) {
	try {
		localStorage.setItem(STORAGE_KEY_BUILDER_TAB, builderTab);
	} catch {}
}

export function validateSearch(
	rawSearch: Record<string, unknown>,
): ResourceEditorSearch {
	let tab: ResourceEditorTab;
	if (isResourceEditorTab(rawSearch.tab)) {
		tab = rawSearch.tab;
	} else if (rawSearch.tab === undefined) {
		tab = getStoredTab() ?? "edit";
	} else {
		console.error("Invalid tab", rawSearch.tab, "force to 'edit'");
		tab = "edit";
	}

	let mode: EditorMode;
	if (isEditorMode(rawSearch.mode)) {
		mode = rawSearch.mode;
	} else if (rawSearch.mode === undefined) {
		mode = "json";
	} else {
		console.error("Invalid mode", rawSearch.mode, "force to 'json'");
		mode = "json";
	}

	let builderTab: BuilderTab;
	if (isBuilderTab(rawSearch.builderTab)) {
		builderTab = rawSearch.builderTab;
	} else {
		builderTab = getStoredBuilderTab() ?? "form";
	}

	return { tab, mode, builderTab };
}

const PageComponent = () => {
	const { tab, mode } = useSearch({ from: "/resource/$resourceType/create" });
	const { resourceType } = useMatch({
		from: "/resource/$resourceType/create",
	}).params;
	const navigate = useNavigate();

	const isViewDefinition = resourceType === "ViewDefinition";

	const initialResource = isViewDefinition
		? {
				resource: "Patient",
				resourceType: "ViewDefinition",
				status: "draft",
				select: [],
			}
		: { resourceType: resourceType };

	const effectiveTab = isViewDefinition && tab === "edit" ? "builder" : tab;

	return (
		<ResourceEditorPage
			initialResource={initialResource}
			resourceType={resourceType}
			tab={effectiveTab}
			mode={mode}
			navigate={navigate}
		/>
	)
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
