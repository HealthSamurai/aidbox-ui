import type { RefObject } from "react";
import { useEffect } from "react";
import type { ResourceEditorActions } from "./resource-editor-context";

function textResult(text: string) {
	return { content: [{ type: "text" as const, text }] };
}

function getActions(ref: RefObject<ResourceEditorActions | null>) {
	const actions = ref.current;
	if (!actions) throw new Error("Resource editor actions not available");
	return actions;
}

const TOOL_NAMES = [
	"editor_switch_tab",
	"editor_get_tab",
	"editor_switch_mode",
	"editor_get_mode",
	"editor_get_value",
	"editor_set_value",
	"editor_format",
	"editor_save",
	"editor_get_validation_errors",
	"editor_toggle_profile_panel",
	"editor_get_profile",
	"editor_choose_profile",
	"editor_delete",
	"history_list_versions",
	"history_select_version",
	"history_get_selected",
	"history_get_view_mode",
	"history_switch_view_mode",
	"history_get_raw_mode",
	"history_switch_raw_mode",
	"history_restore",
	"history_get_selected_diff",
] as const;

export function useWebMCPResourceEditor(
	actionsRef: RefObject<ResourceEditorActions | null>,
) {
	useEffect(() => {
		if (!navigator.modelContext) return;

		navigator.modelContext.registerTool({
			name: "editor_switch_tab",
			description:
				"[Resource Editor] Switch the active tab. Available tabs: edit (JSON/YAML editor), " +
				"history (version history), builder (ViewDefinition Builder, only for ViewDefinition resources).",
			inputSchema: {
				type: "object",
				properties: {
					tab: {
						type: "string",
						enum: ["edit", "history", "builder"],
						description: "Tab to switch to",
					},
				},
				required: ["tab"],
			},
			execute: async (args: { tab: "edit" | "history" | "builder" }) => {
				getActions(actionsRef).switchTab(args.tab);
				return textResult(`Switched to ${args.tab} tab`);
			},
		});

		navigator.modelContext.registerTool({
			name: "editor_get_tab",
			description: "[Resource Editor] Get the currently active tab.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				return textResult(getActions(actionsRef).getTab());
			},
		});

		navigator.modelContext.registerTool({
			name: "editor_switch_mode",
			description:
				"[Resource Editor] Switch the editor between JSON and YAML modes.",
			inputSchema: {
				type: "object",
				properties: {
					mode: {
						type: "string",
						enum: ["json", "yaml"],
						description: "Editor mode to switch to",
					},
				},
				required: ["mode"],
			},
			execute: async (args: { mode: "json" | "yaml" }) => {
				getActions(actionsRef).editorSwitchMode(args.mode);
				return textResult(`Switched to ${args.mode} mode`);
			},
		});

		navigator.modelContext.registerTool({
			name: "editor_get_mode",
			description:
				"[Resource Editor] Get the current editor mode (json or yaml).",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				return textResult(getActions(actionsRef).editorGetMode());
			},
		});

		navigator.modelContext.registerTool({
			name: "editor_get_value",
			description:
				"[Resource Editor] Get the current text content of the editor.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				return textResult(getActions(actionsRef).editorGetValue());
			},
		});

		navigator.modelContext.registerTool({
			name: "editor_set_value",
			description:
				"[Resource Editor] Set the editor text content. " +
				"Must be valid JSON or YAML depending on the current mode.",
			inputSchema: {
				type: "object",
				properties: {
					value: {
						type: "string",
						description: "New editor content (JSON or YAML string)",
					},
				},
				required: ["value"],
			},
			execute: async (args: { value: string }) => {
				getActions(actionsRef).editorSetValue(args.value);
				return textResult("Editor value updated");
			},
		});

		navigator.modelContext.registerTool({
			name: "editor_format",
			description:
				"[Resource Editor] Format (pretty-print) the current editor content.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				getActions(actionsRef).editorFormat();
				return textResult("Formatted");
			},
		});

		navigator.modelContext.registerTool({
			name: "editor_save",
			description:
				"[Resource Editor] Save the current resource (create if new, update if existing). " +
				"Returns the saved resource ID on success or validation errors on failure.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				try {
					const result = await getActions(actionsRef).editorSave();
					if (result.status === "ok") {
						return textResult(`Saved successfully. ID: ${result.id}`);
					}
					return textResult(
						`Validation errors:\n${JSON.stringify(result.issues, null, 2)}`,
					);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "editor_get_validation_errors",
			description:
				"[Resource Editor] Get validation errors from the last save attempt.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const issues = getActions(actionsRef).editorGetValidationErrors();
				if (!issues || issues.length === 0)
					return textResult("No validation errors");
				return textResult(JSON.stringify(issues, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "editor_toggle_profile_panel",
			description: "[Resource Editor] Toggle the profile panel open or closed.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				getActions(actionsRef).editorToggleProfilePanel();
				return textResult("Profile panel toggled");
			},
		});

		navigator.modelContext.registerTool({
			name: "editor_get_profile",
			description:
				"[Resource Editor] Get information about the currently selected profile " +
				"and whether the profile panel is open.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const info = getActions(actionsRef).editorGetProfile();
				return textResult(JSON.stringify(info, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "editor_choose_profile",
			description:
				"[Resource Editor] Select a profile by its key. " +
				"Opens the profile panel if it's closed.",
			inputSchema: {
				type: "object",
				properties: {
					key: {
						type: "string",
						description: "Profile key to select",
					},
				},
				required: ["key"],
			},
			execute: async (args: { key: string }) => {
				getActions(actionsRef).editorChooseProfile(args.key);
				return textResult(`Selected profile: ${args.key}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "editor_delete",
			description:
				"[Resource Editor] Delete the current resource. " +
				"Only works on existing resources (not on the create page).",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				try {
					const result = await getActions(actionsRef).editorDelete();
					if (result.status === "ok") return textResult("Resource deleted");
					return textResult(`Error: ${result.message}`);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "history_list_versions",
			description:
				"[Resource Editor] List all history versions. " +
				"Returns version IDs and dates. Requires the History tab to be active.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const versions = getActions(actionsRef).historyListVersions();
				if (!versions) return textResult("History is not available");
				return textResult(JSON.stringify(versions, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "history_select_version",
			description:
				"[Resource Editor] Select a history version by its version ID.",
			inputSchema: {
				type: "object",
				properties: {
					versionId: {
						type: "string",
						description: "Version ID to select",
					},
				},
				required: ["versionId"],
			},
			execute: async (args: { versionId: string }) => {
				getActions(actionsRef).historySelectVersion(args.versionId);
				return textResult(`Selected version: ${args.versionId}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "history_get_selected",
			description:
				"[Resource Editor] Get the currently selected history version details " +
				"including version ID, date, and resource content.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				const selected = getActions(actionsRef).historyGetSelected();
				if (!selected) return textResult("No version selected");
				return textResult(JSON.stringify(selected, null, 2));
			},
		});

		navigator.modelContext.registerTool({
			name: "history_get_view_mode",
			description:
				"[Resource Editor] Get the current history view mode (raw or diff).",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				return textResult(getActions(actionsRef).historyGetViewMode());
			},
		});

		navigator.modelContext.registerTool({
			name: "history_switch_view_mode",
			description:
				"[Resource Editor] Switch history view between raw and diff modes.",
			inputSchema: {
				type: "object",
				properties: {
					mode: {
						type: "string",
						enum: ["raw", "diff"],
						description: "View mode to switch to",
					},
				},
				required: ["mode"],
			},
			execute: async (args: { mode: "raw" | "diff" }) => {
				getActions(actionsRef).historySwitchViewMode(args.mode);
				return textResult(`Switched to ${args.mode} view`);
			},
		});

		navigator.modelContext.registerTool({
			name: "history_get_raw_mode",
			description:
				"[Resource Editor] Get the raw view editor mode (json or yaml).",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				return textResult(getActions(actionsRef).historyGetRawMode());
			},
		});

		navigator.modelContext.registerTool({
			name: "history_switch_raw_mode",
			description:
				"[Resource Editor] Switch the raw view between JSON and YAML.",
			inputSchema: {
				type: "object",
				properties: {
					mode: {
						type: "string",
						enum: ["json", "yaml"],
						description: "Raw view mode to switch to",
					},
				},
				required: ["mode"],
			},
			execute: async (args: { mode: "json" | "yaml" }) => {
				getActions(actionsRef).historySwitchRawMode(args.mode);
				return textResult(`Switched raw view to ${args.mode}`);
			},
		});

		navigator.modelContext.registerTool({
			name: "history_restore",
			description:
				"[Resource Editor] Restore the currently selected history version. " +
				"Updates the resource to the selected version's content.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				try {
					const result = await getActions(actionsRef).historyRestore();
					if (result.status === "ok")
						return textResult("Version restored successfully");
					return textResult(`Error: ${result.message}`);
				} catch (e) {
					return textResult(
						`Error: ${e instanceof Error ? e.message : String(e)}`,
					);
				}
			},
		});

		navigator.modelContext.registerTool({
			name: "history_get_selected_diff",
			description:
				"[Resource Editor] Get the unified text diff between the selected history version " +
				"and its previous version. Switches to Diff view mode. Requires the History tab to be active.",
			inputSchema: { type: "object", properties: {} },
			execute: async () => {
				getActions(actionsRef).historySwitchViewMode("diff");
				const diff = getActions(actionsRef).historyGetSelectedDiff();
				if (!diff)
					return textResult(
						"No diff available (first version or History tab not active)",
					);
				return textResult(diff);
			},
		});

		return () => {
			for (const name of TOOL_NAMES) {
				navigator.modelContext?.unregisterTool(name);
			}
		};
	}, [actionsRef]);
}
