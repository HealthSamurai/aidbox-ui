import { ResourceEditorPage } from "@aidbox-ui/components/ResourceEditor/editor-page";
import {
	isResourceEditorTab,
	type ResourceEditorTab,
} from "@aidbox-ui/components/ResourceEditor/types";
import {
	createFileRoute,
	useMatch,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";

export type ViewDefinitionSearch = {
	tab: ResourceEditorTab;
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
	return { tab };
}

const PageComponent = () => {
	const { tab } = useSearch({ from: "/resource/$resourceType/create" });
	const { resourceType } = useMatch({
		from: "/resource/$resourceType/create",
	}).params;
	const navigate = useNavigate();
	return (
		<ResourceEditorPage
			resourceType={resourceType}
			tab={tab}
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
