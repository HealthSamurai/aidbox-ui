export const RESOURCE_EDITOR_TABS = [
	"edit",
	"history",
	"builder",
	"stats",
	"indexes",
	"sqlquery",
	"lineage",
] as const;
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

/**
 * Resource types that register a custom "builder" tab in `ResourceEditor/page`.
 * Keep in sync with the `tabs.push({ value: "builder", ... })` branches there.
 */
export const RESOURCE_TYPES_WITH_BUILDER = new Set([
	"ViewDefinition",
	"AccessPolicy",
	"SearchParameter",
	"ValueSet",
	"CodeSystem",
]);

/**
 * Default ResourceEditor tab for first-time navigation to a resource type.
 * Resource types with a custom builder prefer it over the raw JSON editor —
 * the builder is the authoring UI the editor was designed for.
 */
export const defaultTabFor = (resourceType: string): ResourceEditorTab =>
	RESOURCE_TYPES_WITH_BUILDER.has(resourceType) ? "builder" : "edit";
