export const RESOURCE_EDITOR_TABS = ["code", "version"] as const;
export type ResourceEditorTab = (typeof RESOURCE_EDITOR_TABS)[number];
const resourceEditorTabSet = new Set(RESOURCE_EDITOR_TABS);
export const isResourceEditorTab = (x: unknown): x is ResourceEditorTab => {
	return resourceEditorTabSet.has(x as ResourceEditorTab);
};

export const EDITOR_MODES = ["json", "yaml"] as const;
export type EditorMode = (typeof EDITOR_MODES)[number];
const editorModeSet = new Set(EDITOR_MODES);
export const isEditorMode = (x: unknown): x is EditorMode => {
	return editorModeSet.has(x as EditorMode);
};

export const pageId = "ResourceEditor";
