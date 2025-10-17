export const RESOURCE_EDITOR_TABS = ["code", "version"] as const;
export type ResourceEditorTab = (typeof RESOURCE_EDITOR_TABS)[number];

const resourceEditorTabSet = new Set(RESOURCE_EDITOR_TABS);
export const isResourceEditorTab = (x: unknown): x is ResourceEditorTab => {
	return resourceEditorTabSet.has(x as ResourceEditorTab);
};

export type EditorMode = "json" | "yaml";

export const queryKey = "ResourceEditor";
