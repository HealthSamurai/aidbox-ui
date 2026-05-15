import type { OperationOutcomeIssue } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { ResourceEditorTab } from "../components/ResourceEditor/types";

export interface ResourceEditorActions {
	switchTab: (tab: ResourceEditorTab) => void;
	getTab: () => ResourceEditorTab;
	editorSwitchMode: (mode: "json" | "yaml") => void;
	editorGetMode: () => "json" | "yaml";
	editorGetValue: () => string;
	editorSetValue: (value: string) => void;
	editorFormat: () => void;
	editorSave: () => Promise<
		| { status: "ok"; id: string }
		| { status: "error"; issues: OperationOutcomeIssue[] }
	>;
	editorGetValidationErrors: () => OperationOutcomeIssue[] | null;
	editorToggleProfilePanel: () => void;
	editorGetProfile: () => {
		open: boolean;
		profileKey?: string;
		profileName?: string;
		profileUrl?: string;
		isDefault?: boolean;
	};
	editorChooseProfile: (key: string) => void;
	editorDelete: () => Promise<
		{ status: "ok" } | { status: "error"; message: string }
	>;
	historyListVersions: () =>
		| {
				versionId: string;
				date: string;
		  }[]
		| null;
	historySelectVersion: (versionId: string) => void;
	historyGetSelected: () => {
		versionId: string;
		date: string;
		content: string;
	} | null;
	historyGetViewMode: () => "raw" | "diff";
	historySwitchViewMode: (mode: "raw" | "diff") => void;
	historyGetRawMode: () => "json" | "yaml";
	historySwitchRawMode: (mode: "json" | "yaml") => void;
	historyRestore: () => Promise<
		{ status: "ok" } | { status: "error"; message: string }
	>;
	historyGetSelectedDiff: () => string | null;
}
