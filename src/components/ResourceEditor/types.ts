export const RESOURCE_EDITOR_TABS = ["edit", "history", "builder"] as const;
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

export const BUILDER_TABS = ["form", "code", "sql"] as const;
export type BuilderTab = (typeof BUILDER_TABS)[number];
const builderTabSet = new Set(BUILDER_TABS);
export const isBuilderTab = (x: unknown): x is BuilderTab => {
	return builderTabSet.has(x as BuilderTab);
};

export const pageId = "ResourceEditor";
