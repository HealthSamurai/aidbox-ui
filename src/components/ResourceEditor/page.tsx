import type {
	OperationOutcome,
	OperationOutcomeIssue,
	Resource,
} from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { isOperationOutcome } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { CodeEditorView } from "@health-samurai/react-components";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import type * as Router from "@tanstack/react-router";
import * as YAML from "js-yaml";
import React from "react";
import { useAidboxClient } from "../../AidboxClient";
import { useUnsavedChangesBlocker } from "../../hooks/useUnsavedChangesBlocker";
import { storeSelectedTab } from "../../routes/resource.$resourceType.create";
import {
	findJsonPathOffset,
	findYamlPathOffset,
	outcomeToIssueLines,
} from "../../utils/json-path-offset";
import { useWebMCPResourceEditor } from "../../webmcp/resource-editor";
import type { ResourceEditorActions } from "../../webmcp/resource-editor-context";
import { AccessPolicyBuilderContent } from "../AccessPolicy/builder-content";
import { AccessPolicyProvider } from "../AccessPolicy/page";
import { EmptyState } from "../empty-state";
import { BuilderContent } from "../ViewDefinition/editor-panel-content";
import { ViewDefinitionProvider } from "../ViewDefinition/page";
import { DeleteButton, SaveButton, type SaveHandle } from "./action";
import { deleteResource, fetchResource } from "./api";
import { EditTabContent } from "./edit-tab-content";
import { type EditorMode, pageId, type ResourceEditorTab } from "./types";
import { VersionsTab } from "./versions-tab";

interface ResourceEditorPageProps {
	id?: string;
	resourceType: string;
	tab: ResourceEditorTab;
	mode: EditorMode;
	indent?: number;
	navigate: <T extends string>(
		opts: Router.NavigateOptions<Router.RegisteredRouter, T, T>,
	) => Promise<void>;
}

export const ResourceEditorPageWithLoader = (
	props: ResourceEditorPageProps,
) => {
	const client = useAidboxClient();

	const { resourceType, id } = props;

	const {
		data: resourceData,
		isLoading,
		error,
	} = useQuery({
		enabled: id !== undefined,
		queryKey: [pageId, resourceType, id],
		queryFn: async () => {
			if (!id) throw new Error("Impossible");
			return await fetchResource(client, resourceType, id);
		},
		retry: false,
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Loading Resource...</div>
					<div className="text-sm">ID: {id}</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full text-red-500">
				<div className="text-center">
					<div className="text-lg mb-2">Failed to load resource</div>
					<div className="text-sm">{error.message}</div>
				</div>
			</div>
		);
	}

	if (!resourceData)
		return (
			<EmptyState
				title="Failed to load resource"
				description="Resource not found"
			/>
		);

	const meta = (resourceData as Record<string, unknown>).meta as
		| Record<string, unknown>
		| undefined;

	return (
		<ResourceEditorPage
			key={String(meta?.versionId ?? "")}
			initialResource={resourceData}
			{...props}
		/>
	);
};

export const ResourceEditorPage = ({
	id,
	resourceType,
	tab,
	mode,
	indent = 2,
	navigate,
	initialResource,
}: ResourceEditorPageProps & { initialResource: Resource }) => {
	const client = useAidboxClient();

	const [resource, setResource] = React.useState<Resource>(initialResource);
	const initialTextRef = React.useRef(
		mode === "yaml"
			? YAML.dump(initialResource, { indent })
			: JSON.stringify(initialResource, undefined, indent),
	);
	const [resourceText, setResourceText] = React.useState<string>(
		initialTextRef.current,
	);

	const triggerFormat = () => {
		let text: string;
		if (mode === "yaml") {
			text = YAML.dump(resource, { indent });
		} else {
			text = JSON.stringify(resource, null, indent);
		}
		setResourceText(text);
	};

	const setMode = (newMode: EditorMode) => {
		try {
			const parsed =
				mode === "json" ? JSON.parse(resourceText) : YAML.load(resourceText);
			const newText =
				newMode === "yaml"
					? YAML.dump(parsed, { indent })
					: JSON.stringify(parsed, null, indent);
			setResourceText(newText);
			initialTextRef.current = newText;
			setResource(parsed);
		} catch {
			// If parsing fails, we keep the current value
		}
		navigate({
			search: (prev: Record<string, unknown>) => ({
				...prev,
				mode: newMode,
			}),
		});
	};

	const {
		setIsDirty: setEditDirty,
		proceed: editProceed,
		reset: editReset,
		status: editBlockerStatus,
	} = useUnsavedChangesBlocker();
	const editDismissedRef = React.useRef(false);

	const handleTextChange = (text: string) => {
		setResourceText(text);
		setSaveError(null);
		setEditDirty(text !== initialTextRef.current);
		try {
			const parsed = mode === "yaml" ? YAML.load(text) : JSON.parse(text);
			setResource(parsed);
		} catch {
			// keeps text as-is if parsing failed
		}
	};

	const editorViewRef = React.useRef<CodeEditorView | null>(null);
	const saveRef = React.useRef<SaveHandle>(null!);

	const [saveError, setSaveError] = React.useState<OperationOutcome | null>(
		null,
	);

	const handleSaveError = React.useCallback((error: Error) => {
		if (isOperationOutcome(error.cause)) {
			setSaveError(error.cause);
		} else {
			setSaveError({
				resourceType: "OperationOutcome",
				issue: [
					{
						severity: "error",
						code: "exception",
						diagnostics: error.message,
					},
				],
			});
		}
	}, []);

	const handleIssueClick = React.useCallback(
		(issue: OperationOutcomeIssue) => {
			const view = editorViewRef.current;
			if (!view || !issue.expression?.length) return;
			const text = view.state.doc.toString();
			const offset =
				mode === "yaml"
					? findYamlPathOffset(text, issue.expression[0])
					: findJsonPathOffset(text, issue.expression[0]);
			if (offset == null) return;
			view.dispatch({
				selection: EditorSelection.cursor(offset),
				effects: EditorView.scrollIntoView(offset, { y: "center" }),
			});
			view.focus();
		},
		[mode],
	);

	const issueLineNumbers = React.useMemo(() => {
		if (!saveError?.issue) return undefined;
		const lines = outcomeToIssueLines(resourceText, saveError.issue, mode);
		return lines.length > 0 ? lines : undefined;
	}, [saveError, resourceText, mode]);

	const handleOnTabSelect = (value: ResourceEditorTab) => {
		if (editDismissedRef.current) {
			editDismissedRef.current = false;
			const text =
				mode === "yaml"
					? YAML.dump(initialResource, { indent })
					: JSON.stringify(initialResource, null, indent);
			setResourceText(text);
			initialTextRef.current = text;
			setResource(initialResource);
			setEditDirty(false);
			setSaveError(null);
		}
		storeSelectedTab(value);
		navigate({
			search: (prev: Record<string, unknown>) => ({ ...prev, tab: value }),
		});
	};

	const actionsRef = React.useRef<ResourceEditorActions>(null!);

	actionsRef.current = {
		switchTab: (value: ResourceEditorTab) => {
			storeSelectedTab(value);
			const url = new URL(window.location.href);
			url.searchParams.set("tab", value);
			window.history.pushState(window.history.state, "", url);
			window.dispatchEvent(new PopStateEvent("popstate"));
		},
		getTab: () => tab,
		editorSwitchMode: setMode,
		editorGetMode: () => mode,
		editorGetValue: () => resourceText,
		editorSetValue: handleTextChange,
		editorFormat: triggerFormat,
		editorSave: async () => {
			try {
				const result = await saveRef.current.save();
				return { status: "ok" as const, id: result.id ?? id ?? "" };
			} catch (e) {
				// handleSaveError already called by SaveButton's onError
				const issues =
					e instanceof Error && isOperationOutcome(e.cause)
						? e.cause.issue
						: [
								{
									severity: "error" as const,
									code: "exception" as const,
									diagnostics: e instanceof Error ? e.message : String(e),
								},
							];
				return { status: "error" as const, issues };
			}
		},
		editorGetValidationErrors: () => saveError?.issue ?? null,
		editorDelete: async () => {
			if (!id)
				return {
					status: "error",
					message: "Cannot delete: resource has no ID",
				};
			try {
				await deleteResource(client, resourceType, id);
				navigate({
					to: "/resource/$resourceType",
					params: { resourceType },
				});
				return { status: "ok" };
			} catch (e) {
				return {
					status: "error",
					message: e instanceof Error ? e.message : String(e),
				};
			}
		},
		// Stubs — overridden by EditTabContent/ProfilePanel
		editorToggleProfilePanel: () => {},
		editorGetProfile: () => ({ open: false }),
		editorChooseProfile: () => {},
		// Stubs — overridden by VersionsTab
		historyListVersions: () => null,
		historySelectVersion: () => {},
		historyGetSelected: () => null,
		historyGetViewMode: () => "raw",
		historySwitchViewMode: () => {},
		historyGetRawMode: () => "json",
		historySwitchRawMode: () => {},
		historyRestore: async () => ({
			status: "error",
			message: "History tab is not active",
		}),
		historyGetSelectedDiff: () => null,
	};

	useWebMCPResourceEditor(actionsRef);

	const isViewDefinition = resourceType === "ViewDefinition";
	const isAccessPolicy = resourceType === "AccessPolicy";

	const tabs: {
		value: string;
		trigger: React.ReactNode;
		content: React.ReactNode;
	}[] = [];

	if (isViewDefinition) {
		tabs.push({
			value: "builder",
			trigger: (
				<HSComp.TabsTrigger value="builder">
					ViewDefinition Builder
				</HSComp.TabsTrigger>
			),
			content: (
				<HSComp.TabsContent value="builder" className="grow min-h-0">
					<BuilderContent />
				</HSComp.TabsContent>
			),
		});
	}

	const editActions = (
		<>
			{id && (
				<DeleteButton client={client} resourceType={resourceType} id={id} />
			)}
			<SaveButton
				resourceType={resourceType}
				id={id}
				resource={resourceText}
				mode={mode}
				client={client}
				onError={handleSaveError}
				onSuccess={() => setEditDirty(false)}
				saveRef={saveRef}
			/>
		</>
	);

	if (isAccessPolicy) {
		tabs.push({
			value: "builder",
			trigger: (
				<HSComp.TabsTrigger value="builder">Dev Tool</HSComp.TabsTrigger>
			),
			content: (
				<HSComp.TabsContent value="builder" className="grow min-h-0">
					<AccessPolicyBuilderContent />
				</HSComp.TabsContent>
			),
		});
	}

	tabs.push({
		value: "edit",
		trigger: <HSComp.TabsTrigger value="edit">Edit</HSComp.TabsTrigger>,
		content: (
			<HSComp.TabsContent value={"edit"}>
				<EditTabContent
					mode={mode}
					setMode={setMode}
					triggerFormat={triggerFormat}
					resourceText={resourceText}
					defaultResourceText={resourceText}
					setResourceText={handleTextChange}
					viewCallback={(view) => {
						editorViewRef.current = view;
					}}
					actions={editActions}
					saveError={saveError}
					onIssueClick={handleIssueClick}
					issueLineNumbers={issueLineNumbers}
					resourceType={resourceType}
					storageKey="resourceEditor-profileOpen"
					autoSaveId="resource-editor-horizontal-panel"
					actionsRef={actionsRef}
				/>
			</HSComp.TabsContent>
		),
	});

	if (id) {
		tabs.push({
			value: "history",
			trigger: <HSComp.TabsTrigger value="history">History</HSComp.TabsTrigger>,
			content: (
				<HSComp.TabsContent value={"history"}>
					<VersionsTab
						id={id}
						resourceType={resourceType}
						actionsRef={actionsRef}
					/>
				</HSComp.TabsContent>
			),
		});
	}

	const availableTabs = tabs.map((t) => t.value);
	const effectiveTab = availableTabs.includes(tab) ? tab : availableTabs[0];

	const content = (
		<>
			<HSComp.Tabs
				value={effectiveTab}
				onValueChange={handleOnTabSelect}
				className="grow min-h-0"
			>
				{tabs.length > 1 && (
					<div className="flex items-center bg-bg-primary px-4 border-b h-10 flex-none">
						<HSComp.TabsList>{tabs.map((t) => t.trigger)}</HSComp.TabsList>
					</div>
				)}
				{tabs.map((t) => t.content)}
			</HSComp.Tabs>

			<HSComp.AlertDialog open={editBlockerStatus === "blocked"}>
				<HSComp.AlertDialogContent>
					<HSComp.AlertDialogHeader>
						<HSComp.AlertDialogTitle>Unsaved changes</HSComp.AlertDialogTitle>
					</HSComp.AlertDialogHeader>
					<HSComp.AlertDialogDescription>
						You have unsaved changes. Are you sure you want to leave this page?
						Your changes will be lost.
					</HSComp.AlertDialogDescription>
					<HSComp.AlertDialogFooter>
						<HSComp.AlertDialogCancel onClick={editReset}>
							Cancel
						</HSComp.AlertDialogCancel>
						<HSComp.AlertDialogAction
							variant="primary"
							danger
							onClick={() => {
								setEditDirty(false);
								editDismissedRef.current = true;
								setSaveError(null);
								editProceed?.();
							}}
						>
							Leave
						</HSComp.AlertDialogAction>
					</HSComp.AlertDialogFooter>
				</HSComp.AlertDialogContent>
			</HSComp.AlertDialog>
		</>
	);

	if (isViewDefinition) {
		return (
			<ViewDefinitionProvider id={id} initialResource={initialResource}>
				{content}
			</ViewDefinitionProvider>
		);
	}

	if (isAccessPolicy) {
		return (
			<AccessPolicyProvider id={id} initialResource={initialResource}>
				{content}
			</AccessPolicyProvider>
		);
	}

	return content;
};
