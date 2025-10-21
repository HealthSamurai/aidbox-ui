import {
	ResourceEditorPage,
	ResourceEditorPageWithLoader,
} from "@aidbox-ui/components/ResourceEditor/page";
import {
	type EditorMode,
	isEditorMode,
	isResourceEditorTab,
	type ResourceEditorTab,
} from "@aidbox-ui/components/ResourceEditor/types";
import { useLocalStorage } from "@aidbox-ui/hooks";
import {
	createFileRoute,
	useMatch,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";

export type ViewDefinitionSearch = {
	tab: ResourceEditorTab;
	mode: EditorMode;
};

export function validateSearch(
	rawSearch: Record<string, unknown>,
): ViewDefinitionSearch {
	let tab: ResourceEditorTab;
	if (isResourceEditorTab(rawSearch.tab)) {
		tab = rawSearch.tab;
	} else if (rawSearch.tab === undefined) {
		tab = "code";
	} else {
		console.error("Invalid tab", rawSearch.tab, "force to 'code'");
		tab = "code";
	}

	let mode: EditorMode;
	if (isEditorMode(rawSearch.mode)) {
		mode = rawSearch.mode;
	} else if (rawSearch.mode === undefined) {
		mode = "json";
	} else {
		console.error("Invalid mode", rawSearch.mode, "force to 'code'");
		mode = "json";
	}
	return { tab, mode };
}

const PageComponent = () => {
	const { tab, mode } = useSearch({ from: "/resource/$resourceType/create" });
	const { resourceType } = useMatch({
		from: "/resource/$resourceType/create",
	}).params;
	const navigate = useNavigate();
	return (
		<ResourceEditorPage
			initialResource={{ resourceType: resourceType }}
			resourceType={resourceType}
			tab={tab}
			mode={mode}
			navigate={navigate}
		/>
	);
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
