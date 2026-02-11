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
import { storeSelectedTab } from "../../routes/resource.$resourceType.create";
import {
	findJsonPathOffset,
	findYamlPathOffset,
	getIssueLineNumbers,
} from "../../utils/json-path-offset";
import { BuilderContent } from "../ViewDefinition/editor-panel-content";
import { ViewDefinitionProvider } from "../ViewDefinition/page";
import { DeleteButton, SaveButton } from "./action";
import { fetchResource } from "./api";
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
			<div className="flex items-center justify-center h-full text-red-500">
				<div className="text-center">
					<div className="text-lg mb-2">Failed to load resource</div>
					<div className="text-sm">Resource not found</div>
				</div>
			</div>
		);

	return <ResourceEditorPage initialResource={resourceData} {...props} />;
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
	const [resourceText, setResourceText] = React.useState<string>(() => {
		if (mode === "yaml") {
			return YAML.dump(initialResource, { indent });
		}
		return JSON.stringify(initialResource, undefined, indent);
	});

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

	const editorViewRef = React.useRef<CodeEditorView | null>(null);

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
		const expressions = saveError.issue
			.flatMap((i) => i.expression ?? [])
			.filter(Boolean);
		if (expressions.length === 0) return undefined;
		return getIssueLineNumbers(resourceText, expressions, mode);
	}, [saveError, resourceText, mode]);

	const isViewDefinition = resourceType === "ViewDefinition";

	const tabs = [];

	if (isViewDefinition) {
		tabs.push({
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
			/>
		</>
	);

	tabs.push({
		trigger: <HSComp.TabsTrigger value="edit">Edit</HSComp.TabsTrigger>,
		content: (
			<HSComp.TabsContent value={"edit"}>
				<EditTabContent
					mode={mode}
					setMode={setMode}
					triggerFormat={triggerFormat}
					resourceText={resourceText}
					defaultResourceText={resourceText}
					setResourceText={(text: string) => {
						setResourceText(text);
						setSaveError(null);
						try {
							const parsed =
								mode === "yaml" ? YAML.load(text) : JSON.parse(text);
							setResource(parsed);
						} catch {
							// again, keeps text as-is if parsing failed
						}
					}}
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
				/>
			</HSComp.TabsContent>
		),
	});

	if (id) {
		tabs.push({
			trigger: <HSComp.TabsTrigger value="history">History</HSComp.TabsTrigger>,
			content: (
				<HSComp.TabsContent value={"history"}>
					<VersionsTab id={id} resourceType={resourceType} />
				</HSComp.TabsContent>
			),
		});
	}

	const handleOnTabSelect = (value: ResourceEditorTab) => {
		storeSelectedTab(value);
		navigate({
			search: (prev: Record<string, unknown>) => ({ ...prev, tab: value }),
		});
	};

	const content = (
		<HSComp.Tabs
			defaultValue={tab}
			onValueChange={handleOnTabSelect}
			className="grow min-h-0"
		>
			<div className="flex items-center bg-bg-primary px-4 border-b h-10 flex-none">
				<HSComp.TabsList>{tabs.map((t) => t.trigger)}</HSComp.TabsList>
			</div>
			{tabs.map((t) => t.content)}
		</HSComp.Tabs>
	);

	if (isViewDefinition) {
		return (
			<ViewDefinitionProvider id={id} initialResource={initialResource}>
				{content}
			</ViewDefinitionProvider>
		);
	}

	return content;
};
