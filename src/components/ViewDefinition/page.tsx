import type { ViewDefinition } from "@aidbox-ui/fhir-types/org-sql-on-fhir-ig";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type {
	CodeEditorView,
	OperationOutcome,
	OperationOutcomeIssue,
} from "@health-samurai/react-components";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { useBlocker, useNavigate, useSearch } from "@tanstack/react-router";
import * as YAML from "js-yaml";
import * as Lucide from "lucide-react";
import React from "react";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { findJsonPathOffset } from "../../utils/json-path-offset";
import { EditTabContent } from "../ResourceEditor/edit-tab-content";
import { VersionsTab } from "../ResourceEditor/versions-tab";
import * as Constants from "./constants";
import {
	BuilderContent,
	useViewDefinitionActions,
} from "./editor-panel-content";
import type * as Types from "./types";

const fetchViewDefinition = (
	client: ReturnType<typeof useAidboxClient>,
	id: string,
) => {
	return client.read<ViewDefinition>({
		type: "ViewDefinition",
		id: id,
	});
};

export const ViewDefinitionContext =
	React.createContext<Types.ViewDefinitionContextProps>({
		viewDefinition: undefined,
		setViewDefinition: () => {},
		isLoadingViewDef: true,
		runResult: undefined,
		setRunResult: () => {},
		runResultPageSize: 30,
		setRunResultPageSize: () => {},
		runResultPage: 1,
		setRunResultPage: () => {},
		runViewDefinition: undefined,
		setRunViewDefinition: () => {},
		isDirty: false,
		setIsDirty: () => {},
		runError: undefined,
		setRunError: () => {},
		issueClickRef: { current: undefined },
	});

export const ViewDefinitionResourceTypeContext =
	React.createContext<Types.ViewDefinitionResourceTypeContextProps>({
		viewDefinitionResourceType: undefined,
		setViewDefinitionResourceType: () => {},
	});

export const ViewDefinitionErrorPage = ({
	viewDefinitionError,
}: {
	viewDefinitionError: Error;
}) => {
	return (
		<div className="px-4 py-5">
			<div className="text-text-secondary">
				Error while fetching View Definition:
			</div>
			<div className="text-text-error-primary">
				{viewDefinitionError.message}
			</div>
		</div>
	);
};

const PageTabsHeader = ({ id }: { id?: string }) => {
	const navigate = useNavigate();

	const createSearch = useSearch({
		from: "/resource/ViewDefinition/create",
		shouldThrow: false,
	});
	const editSearch = useSearch({
		from: "/resource/ViewDefinition/edit/$id",
		shouldThrow: false,
	});
	const search = createSearch || editSearch;
	const pageTab = search?.pageTab ?? "builder";

	const handlePageTabChange = (value: Types.ViewDefinitionPageTab) => {
		navigate({
			from:
				createSearch !== undefined
					? "/resource/ViewDefinition/create"
					: "/resource/ViewDefinition/edit/$id",
			search: (prev: Record<string, unknown>) => ({
				...prev,
				pageTab: value,
			}),
		});
	};

	return (
		<HSComp.Tabs
			value={pageTab}
			onValueChange={handlePageTabChange}
			className="flex flex-col grow min-h-0"
		>
			<div className="flex items-center bg-bg-primary px-4 border-b h-10 flex-none">
				<HSComp.TabsList>
					<HSComp.TabsTrigger value="builder">
						ViewDefinition Builder
					</HSComp.TabsTrigger>
					<HSComp.TabsTrigger value="edit">Edit</HSComp.TabsTrigger>
					{id && (
						<HSComp.TabsTrigger value="versions">History</HSComp.TabsTrigger>
					)}
				</HSComp.TabsList>
			</div>
			<HSComp.TabsContent value="builder" className="grow min-h-0">
				<BuilderContent />
			</HSComp.TabsContent>
			<HSComp.TabsContent value="edit" className="grow min-h-0">
				<VDEditTab />
			</HSComp.TabsContent>
			{id && (
				<HSComp.TabsContent value="versions" className="grow min-h-0">
					<VersionsTab id={id} resourceType="ViewDefinition" />
				</HSComp.TabsContent>
			)}
		</HSComp.Tabs>
	);
};

const EditTabActions = ({
	onSave,
	onDelete,
}: {
	onSave: () => void;
	onDelete: () => void;
}) => {
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);

	return (
		<>
			{viewDefinitionContext.originalId && (
				<HSComp.Button
					variant="ghost"
					size="small"
					className="px-0! text-text-secondary! hover:text-text-primary!"
					onClick={onDelete}
				>
					<Lucide.Trash2Icon className="w-4 h-4" />
					Delete
				</HSComp.Button>
			)}
			<HSComp.Button
				variant="ghost"
				size="small"
				className="px-0! text-text-link! hover:text-text-link/80!"
				onClick={onSave}
			>
				<Lucide.SaveIcon className="w-4 h-4" />
				Save
			</HSComp.Button>
			<HSComp.Separator orientation="vertical" className="h-6!" />
		</>
	);
};

const VDEditTab = () => {
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);
	const viewDefinition = viewDefinitionContext.viewDefinition;
	const aidboxClient: AidboxClientR5 = useAidboxClient();
	const { handleSave, handleDelete } = useViewDefinitionActions(aidboxClient);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const indent = 2;

	const [mode, setMode] =
		React.useState<Types.ViewDefinitionEditorMode>("json");
	const [resourceText, setResourceText] = React.useState<string>(() => {
		if (!viewDefinition) return "";
		return JSON.stringify(viewDefinition, undefined, indent);
	});

	const editorViewRef = React.useRef<CodeEditorView | null>(null);
	const handleViewCallback = React.useCallback((view: CodeEditorView) => {
		editorViewRef.current = view;
	}, []);

	const handleIssueClick = React.useCallback(
		(issue: OperationOutcomeIssue) => {
			const view = editorViewRef.current;
			if (!view || mode !== "json" || !issue.expression?.length) return;
			const offset = findJsonPathOffset(
				view.state.doc.toString(),
				issue.expression[0],
			);
			if (offset == null) return;
			view.dispatch({
				selection: EditorSelection.cursor(offset),
				effects: EditorView.scrollIntoView(offset, { y: "center" }),
			});
			view.focus();
		},
		[mode],
	);
	viewDefinitionContext.issueClickRef.current = handleIssueClick;

	const prevViewDefinitionRef = React.useRef(viewDefinition);
	React.useEffect(() => {
		if (viewDefinition && viewDefinition !== prevViewDefinitionRef.current) {
			prevViewDefinitionRef.current = viewDefinition;
			try {
				const currentParsed =
					mode === "json" ? JSON.parse(resourceText) : YAML.load(resourceText);
				if (
					currentParsed &&
					JSON.stringify(currentParsed) === JSON.stringify(viewDefinition)
				) {
					return;
				}
			} catch {
				// parsing failed, update editor
			}
			const text =
				mode === "yaml"
					? YAML.dump(viewDefinition, { indent })
					: JSON.stringify(viewDefinition, undefined, indent);
			setResourceText(text);
		}
	}, [viewDefinition, mode, resourceText]);

	const triggerFormat = () => {
		try {
			const parsed =
				mode === "json" ? JSON.parse(resourceText) : YAML.load(resourceText);
			const text =
				mode === "yaml"
					? YAML.dump(parsed, { indent })
					: JSON.stringify(parsed, null, indent);
			setResourceText(text);
		} catch {
			// If parsing fails, we keep the current value
		}
	};

	const handleSetMode = (newMode: Types.ViewDefinitionEditorMode) => {
		try {
			const parsed =
				mode === "json" ? JSON.parse(resourceText) : YAML.load(resourceText);
			const newText =
				newMode === "yaml"
					? YAML.dump(parsed, { indent })
					: JSON.stringify(parsed, null, indent);
			setResourceText(newText);
		} catch {
			// If parsing fails, we keep the current value
		}
		setMode(newMode);
	};

	const handleSetResourceText = (text: string) => {
		setResourceText(text);
		try {
			const parsed = mode === "json" ? JSON.parse(text) : YAML.load(text);
			viewDefinitionContext.setViewDefinition(parsed as ViewDefinition);
			viewDefinitionContext.setIsDirty(true);
		} catch {
			// keeps text as-is if parsing failed
		}
	};

	if (viewDefinitionContext.isLoadingViewDef || !viewDefinition) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Loading ViewDefinition...</div>
				</div>
			</div>
		);
	}

	return (
		<>
			<HSComp.ResizablePanelGroup direction="vertical" className="h-full">
				<HSComp.ResizablePanel minSize={20}>
					<EditTabContent
						mode={mode}
						setMode={handleSetMode}
						triggerFormat={triggerFormat}
						resourceText={resourceText}
						defaultResourceText={resourceText}
						setResourceText={handleSetResourceText}
						viewCallback={handleViewCallback}
						actions={
							<EditTabActions
								onSave={handleSave}
								onDelete={() => setIsDeleteDialogOpen(true)}
							/>
						}
						resourceType="ViewDefinition"
						storageKey="viewDefinition-editProfileOpen"
						autoSaveId="view-definition-edit-horizontal-panel"
					/>
				</HSComp.ResizablePanel>
				{viewDefinitionContext.runError && (
					<>
						<HSComp.ResizableHandle />
						<HSComp.ResizablePanel defaultSize={30} minSize={10}>
							<HSComp.OperationOutcomeView
								resource={viewDefinitionContext.runError}
								onIssueClick={handleIssueClick}
								className="h-full overflow-auto"
							/>
						</HSComp.ResizablePanel>
					</>
				)}
			</HSComp.ResizablePanelGroup>

			<HSComp.AlertDialog
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			>
				<HSComp.AlertDialogContent>
					<HSComp.AlertDialogHeader>
						<HSComp.AlertDialogTitle>
							Delete ViewDefinition?
						</HSComp.AlertDialogTitle>
					</HSComp.AlertDialogHeader>
					<HSComp.AlertDialogDescription>
						Are you sure you want to delete this ViewDefinition? This action
						cannot be undone.
					</HSComp.AlertDialogDescription>
					<HSComp.AlertDialogFooter>
						<HSComp.AlertDialogCancel>Cancel</HSComp.AlertDialogCancel>
						<HSComp.AlertDialogAction
							variant="primary"
							danger
							onClick={() => {
								viewDefinitionContext.setIsDirty(false);
								handleDelete();
								setIsDeleteDialogOpen(false);
							}}
						>
							<Lucide.Trash2Icon className="w-4 h-4" />
							Delete
						</HSComp.AlertDialogAction>
					</HSComp.AlertDialogFooter>
				</HSComp.AlertDialogContent>
			</HSComp.AlertDialog>
		</>
	);
};

const ViewDefinitionPage = ({ id }: { id?: string }) => {
	const aidboxClient = useAidboxClient();

	const [resouceTypeForViewDefinition, setResouceTypeForViewDefinition] =
		React.useState<string>();
	const [viewDefinition, setViewDefinition] = React.useState<ViewDefinition>();
	const [runViewDefinition, setRunViewDefinition] =
		React.useState<ViewDefinition>();

	const [runResult, setRunResult] = React.useState<string>();
	const [runResultPage, setRunResultPage] = React.useState(1);
	const [runResultPageSize, setRunResultPageSize] = React.useState(30);
	const [runError, setRunError] = React.useState<OperationOutcome>();
	const issueClickRef = React.useRef<
		((issue: OperationOutcomeIssue) => void) | undefined
	>(undefined);
	const [isDirty, _setIsDirty] = React.useState(false);
	const isDirtyRef = React.useRef(false);
	const setIsDirty = React.useCallback(
		(value: boolean | ((prev: boolean) => boolean)) => {
			_setIsDirty((prev) => {
				const next = typeof value === "function" ? value(prev) : value;
				isDirtyRef.current = next;
				return next;
			});
		},
		[],
	);

	const { proceed, reset, status } = useBlocker({
		shouldBlockFn: ({ current, next }) => {
			if (!isDirtyRef.current) return false;
			if (current.pathname === next.pathname) return false;
			return true;
		},
		enableBeforeUnload: () => isDirtyRef.current,
		withResolver: true,
	});

	const viewDefinitionQuery = useQuery({
		queryKey: [Constants.PageID, id],
		queryFn: async () => {
			const viewDefinitionPlaceholder: ViewDefinition = {
				resource: "Patient",
				resourceType: "ViewDefinition",
				status: "draft",
				select: [],
			};
			let response: ViewDefinition = viewDefinitionPlaceholder;
			if (id) {
				const result = await fetchViewDefinition(aidboxClient, id);
				if (result.isErr()) {
					throw new Error(
						Utils.parseOperationOutcome(result.value.resource)
							.map(
								({ expression, diagnostics }) =>
									`${expression}: ${diagnostics}`,
							)
							.join("; "),
						{ cause: result.value.resource },
					);
				}
				response = result.value.resource;
			}
			setResouceTypeForViewDefinition(response.resource);
			setViewDefinition(response);
			return response;
		},
		retry: false,
		refetchOnWindowFocus: false,
	});

	if (viewDefinitionQuery.error)
		return (
			<ViewDefinitionErrorPage
				viewDefinitionError={viewDefinitionQuery.error}
			/>
		);

	return (
		<ViewDefinitionContext.Provider
			value={{
				originalId: id,
				viewDefinition: viewDefinition,
				setViewDefinition: setViewDefinition,
				isLoadingViewDef: viewDefinitionQuery.isLoading,
				runResult: runResult,
				setRunResult: setRunResult,
				runResultPage: runResultPage,
				setRunResultPage: setRunResultPage,
				runResultPageSize: runResultPageSize,
				setRunResultPageSize: setRunResultPageSize,
				runViewDefinition: runViewDefinition,
				setRunViewDefinition: setRunViewDefinition,
				isDirty: isDirty,
				setIsDirty: setIsDirty,
				runError: runError,
				setRunError: setRunError,
				issueClickRef: issueClickRef,
			}}
		>
			<ViewDefinitionResourceTypeContext.Provider
				value={{
					viewDefinitionResourceType: resouceTypeForViewDefinition,
					setViewDefinitionResourceType: setResouceTypeForViewDefinition,
				}}
			>
				<PageTabsHeader id={id} />
			</ViewDefinitionResourceTypeContext.Provider>

			<HSComp.AlertDialog open={status === "blocked"}>
				<HSComp.AlertDialogContent>
					<HSComp.AlertDialogHeader>
						<HSComp.AlertDialogTitle>Unsaved changes</HSComp.AlertDialogTitle>
					</HSComp.AlertDialogHeader>
					<HSComp.AlertDialogDescription>
						You have unsaved changes. Are you sure you want to leave this page?
						Your changes will be lost.
					</HSComp.AlertDialogDescription>
					<HSComp.AlertDialogFooter>
						<HSComp.AlertDialogCancel onClick={reset}>
							Cancel
						</HSComp.AlertDialogCancel>
						<HSComp.AlertDialogAction
							variant="primary"
							danger
							onClick={proceed}
						>
							Leave
						</HSComp.AlertDialogAction>
					</HSComp.AlertDialogFooter>
				</HSComp.AlertDialogContent>
			</HSComp.AlertDialog>
		</ViewDefinitionContext.Provider>
	);
};

export default ViewDefinitionPage;
