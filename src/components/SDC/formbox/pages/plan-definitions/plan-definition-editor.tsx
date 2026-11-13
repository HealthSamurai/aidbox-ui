import { useAidboxClient } from "@aidbox-ui/AidboxClient";
import type {
	OperationOutcome,
	PlanDefinition,
	Questionnaire,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import type { SDCConfig } from "@aidbox-ui/fhir-types/io-health-samurai-sdc-r4";
import {
	Button,
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	Skeleton,
	TabsContent,
	toast,
} from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Columns3Cog } from "lucide-react";
import { useMemo, useState } from "react";
import { FhirPathLspProvider } from "../../../../ViewDefinition/fhirpath-lsp-context";
import { SaveDiagnostics } from "../../../shared/save-diagnostics";
import {
	UnsavedChangesDialog,
	useUnsavedChangesGuard,
} from "../../../shared/unsaved-changes";
import {
	sdcRequest,
	usePlanDefinition,
	useQuestionnaireMetadata,
	useSavePlanDefinition,
} from "../../api/plan-definitions";
import {
	ResourceRequestError,
	toOperationOutcome,
} from "../../api/resource-error";
import {
	NavbarBreadcrumbSlot,
	NavbarRightSlot,
} from "../../layout/navbar-slot";
import { editorShortcutHandler } from "../../shared/editor-shortcuts";
import { generateId } from "../../shared/id";
import {
	isOperationOutcomeError,
	OperationOutcomeProvider,
} from "../../shared/operation-outcome-context";
import { useResourceCode } from "../../shared/resource-code";
import { ResourceEditorContent } from "../../shared/resource-code-editor";
import { ResourceEditorToolbar } from "../../shared/resource-editor-toolbar";
import { getAidboxApiURL, getResourceEditorUrl } from "../../utils";
import { FormPreviewDialog } from "../questionnaires/form-preview-dialog";
import { PlanDefinitionAddQuestionnairesDialog } from "./plan-definition-add-questionnaires-dialog";
import { validatePlanDefinitionCode } from "./plan-definition-code";
import { PlanDefinitionConditionEditor } from "./plan-definition-condition-editor";
import {
	editablePlanDefinition,
	usePlanDefinitionDraft,
} from "./plan-definition-draft";
import { PlanDefinitionGraph } from "./plan-definition-graph";
import type { PlanDefinitionGraphEdge } from "./plan-definition-graph-model";
import {
	answerItems,
	buildPlanDefinition,
	generatePlanDefinitionUrl,
	newPlanDefinition,
	type PlanDefinitionActionDraft,
	planDefinitionErrors,
} from "./plan-definition-model";
import { PlanDefinitionPrefillEditor } from "./plan-definition-prefill-editor";
import { PlanDefinitionPreview } from "./plan-definition-preview";
import {
	PlanDefinitionActionSettings,
	PlanDefinitionProperties,
	PlanDefinitionPropertiesPanel,
	PlanDefinitionSettings,
} from "./plan-definition-properties";
import {
	planDefinitionVariables,
	usePlanDefinitionQuestionnaires,
} from "./plan-definition-questionnaires";
import {
	PlanDefinitionQuickLook,
	type PlanDefinitionQuickLookTarget,
} from "./plan-definition-quick-look";
import { usePlanDefinitionRuleHighlight } from "./plan-definition-rule-highlight";
import { usePlanDefinitionRuleModes } from "./plan-definition-rule-modes";
import { PlanDefinitionSaveDialog } from "./plan-definition-save-dialog";

export function PlanDefinitionEditorPage({
	planDefinitionId,
	questionnaireIds = [],
}: {
	planDefinitionId?: string;
	questionnaireIds?: string[];
}) {
	const [createdPlanDefinition, setCreatedPlanDefinition] = useState<{
		id: string;
		key: string;
	}>();
	const editorKey =
		planDefinitionId && planDefinitionId === createdPlanDefinition?.id
			? createdPlanDefinition.key
			: (planDefinitionId ?? "new");
	const planDefinition = usePlanDefinition(planDefinitionId);
	const questionnaires = useQuestionnaireMetadata();
	const aidboxClient = useAidboxClient();
	const configuration = useQuery({
		queryKey: ["sdc-configurations", "effective"],
		queryFn: ({ signal }) =>
			sdcRequest<Pick<SDCConfig, "builder">>(aidboxClient, "/$sdc-config", {
				method: "POST",
				signal,
			}),
	});
	if (
		(planDefinitionId && planDefinition.isLoading) ||
		questionnaires.isLoading ||
		configuration.isLoading
	)
		return <Skeleton className="m-6 h-96" />;
	if (planDefinition.isError || questionnaires.isError || configuration.isError)
		return (
			<div role="alert" className="p-6 text-text-error-primary">
				Could not load the package designer.{" "}
				<Button
					variant="secondary"
					onClick={() => {
						if (planDefinitionId) void planDefinition.refetch();
						void questionnaires.refetch();
						void configuration.refetch();
					}}
				>
					Retry
				</Button>
			</div>
		);
	const initialQuestionnaires = questionnaireIds.flatMap((id) => {
		const questionnaire = questionnaires.data?.resources.find(
			(questionnaire) => questionnaire.id === id,
		);
		return questionnaire ? [questionnaire] : [];
	});
	if (
		!planDefinitionId &&
		initialQuestionnaires.length !== questionnaireIds.length
	)
		return (
			<div role="alert" className="p-6 text-text-error-primary">
				Some selected forms could not be loaded. Return to Forms and update your
				selection.
			</div>
		);
	return (
		<PlanDefinitionEditor
			key={editorKey}
			initialPlanDefinition={planDefinition.data}
			initialQuestionnaires={initialQuestionnaires}
			questionnaires={questionnaires.data?.resources ?? []}
			urlPrefix={configuration.data?.builder?.["form-url-prefix"]}
			onCreated={(id) => setCreatedPlanDefinition({ id, key: editorKey })}
		/>
	);
}

function hasUnsavedPlanDefinition(
	planDefinition: PlanDefinition,
	savedDraft: string,
	savedPlanDefinition?: PlanDefinition,
	codeDirty = false,
) {
	return (
		JSON.stringify(planDefinition) !== savedDraft ||
		(!savedPlanDefinition && Boolean(planDefinition.action?.length)) ||
		codeDirty
	);
}

function problemActionIndex(path: string) {
	return path.startsWith("action.") ? Number(path.split(".")[1]) : null;
}

function problemPropertiesTab(path: string) {
	if (path.includes(".condition.")) return "condition";
	if (path.includes(".prefill.")) return "prefill";
	return "settings";
}

function PlanDefinitionResourceLink({
	planDefinition,
}: {
	planDefinition?: PlanDefinition;
}) {
	if (!planDefinition?.id) return null;

	return (
		<Button variant="ghost" asChild>
			<a
				data-test-id="plan-definition-editor__open-resource-link"
				href={getResourceEditorUrl("PlanDefinition", planDefinition.id)}
			>
				<Columns3Cog className="size-4" />
				Open resource
			</a>
		</Button>
	);
}

export function PlanDefinitionEditor({
	initialPlanDefinition,
	initialQuestionnaires = [],
	questionnaires,
	urlPrefix,
	onCreated,
}: {
	initialPlanDefinition?: PlanDefinition;
	initialQuestionnaires?: Questionnaire[];
	questionnaires: Questionnaire[];
	urlPrefix?: string;
	onCreated?: (planDefinitionId: string) => void;
}) {
	const navigate = useNavigate();
	const draft = usePlanDefinitionDraft(() => {
		const source =
			initialPlanDefinition ??
			newPlanDefinition(initialQuestionnaires, urlPrefix);
		return editablePlanDefinition({
			...source,
			url:
				source.url || generatePlanDefinitionUrl(source.title ?? "", urlPrefix),
		});
	});
	const {
		planDefinition,
		updatePlanDefinition,
		actionKeys,
		selection,
		setSelection,
		selectedEdge,
		selectedIndex,
		updateAction,
	} = draft;
	const [automaticUrl, setAutomaticUrl] = useState(!initialPlanDefinition?.url);
	const [savedPlanDefinition, setSavedPlanDefinition] = useState(
		initialPlanDefinition,
	);
	const [savedDraft, setSavedDraft] = useState(() =>
		JSON.stringify(planDefinition),
	);
	const [confirmSave, setConfirmSave] = useState<PlanDefinition | null>(null);
	const [designerView, setDesignerView] = useState("graph");
	const [formPropertiesTab, setPropertiesTab] = useState("settings");
	const propertiesTab = selectedIndex === null ? "settings" : formPropertiesTab;
	const [isSorting, setIsSorting] = useState(false);
	const [isAddingForms, setIsAddingForms] = useState(false);
	const [preview, setPreview] = useState<PlanDefinition | null>(null);
	const [quickLook, setQuickLook] =
		useState<PlanDefinitionQuickLookTarget | null>(null);
	const [validationRequested, setValidationRequested] = useState(false);
	const [validation, setValidation] = useState<{
		outcome: OperationOutcome;
		draft: PlanDefinition;
		source: PlanDefinition;
	} | null>(null);
	const save = useSavePlanDefinition();
	const interactionDisabled = save.isPending || isSorting;
	const applyResource = (next: PlanDefinition) => {
		validatePlanDefinitionCode(next);
		const nextDraft = editablePlanDefinition(next);
		draft.replacePlanDefinition(nextDraft);
		ruleModes.reset();
		setValidation(
			validation && JSON.stringify(next) === JSON.stringify(validation.source)
				? {
						...validation,
						draft: nextDraft,
					}
				: null,
		);
		setAutomaticUrl(false);
	};
	const code = useResourceCode({
		getResource: () => buildPlanDefinition(planDefinition),
		onApply: applyResource,
		validate: validatePlanDefinitionCode,
	});
	const activeView = code.mode === "code" ? "code" : designerView;
	const dirty = hasUnsavedPlanDefinition(
		planDefinition,
		savedDraft,
		savedPlanDefinition,
		code.dirty,
	);
	const guard = useUnsavedChangesGuard(dirty);
	const actions: PlanDefinitionActionDraft[] = planDefinition.action ?? [];
	const propertiesRef = usePlanDefinitionRuleHighlight(selectedEdge, actions);
	const actionKey = actionKeys[selectedIndex ?? -1];
	const action = selectedIndex === null ? undefined : actions[selectedIndex];
	const formData = usePlanDefinitionQuestionnaires(actions, questionnaires);
	const { questions, loading: loadingForms } = formData;
	const selectedQuestionnaire = formData.forms[selectedIndex ?? -1];
	const prefillQuestions = questions.filter(
		(question) => question.actionId !== action?.id,
	);
	const targets = answerItems(selectedQuestionnaire?.data?.item);
	const targetLinkIds = new Set(targets.map((item) => item.linkId));
	const targetQuestions = questions.filter(
		(question) =>
			question.actionId === action?.id &&
			targetLinkIds.has(question.item.linkId),
	);
	const variables = planDefinitionVariables(actions);
	const resource = useMemo(
		() => buildPlanDefinition(planDefinition),
		[planDefinition],
	);
	const compiledConditions = resource.action?.[selectedIndex ?? 0]?.condition;
	const problems = planDefinitionErrors(resource);
	const outcome =
		validation?.draft === planDefinition ? validation.outcome : null;
	const errors = validationRequested ? problems : {};
	const actionPath = `action.${selectedIndex}`;
	const propertiesErrorTabs = new Set<string>(
		Object.keys(errors)
			.filter((path) =>
				action
					? path === actionPath || path.startsWith(`${actionPath}.`)
					: !path.startsWith("action."),
			)
			.map(problemPropertiesTab),
	);
	const ruleModes = usePlanDefinitionRuleModes({
		action,
		actionKey,
		questions,
		actions,
		prefillQuestions,
		targets,
		loading: loadingForms,
		compiledConditions,
		onChange: updateAction,
	});
	const selectProblem = (path: string) => {
		const index = problemActionIndex(path);
		setSelection(index ?? "plan-definition");
		if (index !== null) setPropertiesTab(problemPropertiesTab(path));
	};
	const showSaveError = (
		error: unknown,
		submittedDraft: PlanDefinition,
		source: PlanDefinition,
	) => {
		const nextValidation = {
			outcome: toOperationOutcome(error),
			draft: submittedDraft,
			source,
		};
		setValidation(nextValidation);
		setConfirmSave(null);
		if (code.mode === "form") {
			setDesignerView("graph");
			const expression = nextValidation.outcome.issue.find(
				isOperationOutcomeError,
			)?.expression?.[0];
			if (expression) {
				const index = (submittedDraft.action ?? []).findIndex((_, index) =>
					new RegExp(
						`^PlanDefinition\\.action\\[${index}\\](?:\\.|\\[|$)`,
					).test(expression),
				);
				setSelection(index < 0 ? "plan-definition" : index);
				setPropertiesTab(
					new RegExp(
						`^PlanDefinition\\.action\\[${index}\\]\\.condition(?:\\.|\\[|$)`,
					).test(expression)
						? "condition"
						: new RegExp(
									`^PlanDefinition\\.action\\[${index}\\]\\.extension(?:\\.|\\[|$)`,
								).test(expression)
							? "prefill"
							: "settings",
				);
			}
		}
		toast.error(
			error instanceof Error ? error.message : "Could not save package",
		);
	};
	const handleSave = async ({
		confirmed = false,
		createNew = false,
	}: {
		confirmed?: boolean;
		createNew?: boolean;
	} = {}) => {
		if (save.isPending || isSorting) return;
		setValidationRequested(true);
		const candidate = confirmed ? confirmSave : code.read();
		if (!candidate) return;
		const candidateProblems = planDefinitionErrors(candidate);
		const firstError = Object.keys(candidateProblems)[0];
		if (firstError) {
			showProblems(candidateProblems);
			selectProblem(firstError);
			return;
		}
		if (savedPlanDefinition?.status === "active" && !confirmed) {
			setConfirmSave(candidate);
			return;
		}
		const nextResource: PlanDefinition = createNew
			? {
					...candidate,
					id: generateId(),
					meta: undefined,
					status: "draft",
				}
			: candidate;
		const submittedDraft =
			code.mode === "code" ? editablePlanDefinition(candidate) : planDefinition;
		if (code.mode === "code") {
			draft.replacePlanDefinition(submittedDraft);
			ruleModes.reset();
		}
		setValidation(null);
		try {
			const saved = await save.mutateAsync(nextResource);
			setSavedDraft(
				JSON.stringify({
					...submittedDraft,
					id: saved.id,
					meta: saved.meta,
					version: saved.version,
					status: saved.status,
				}),
			);
			setSavedPlanDefinition(saved);
			code.reset(saved);
			updatePlanDefinition({
				id: saved.id,
				meta: saved.meta,
				version: saved.version,
				status: saved.status,
			});
			setAutomaticUrl(false);
			setConfirmSave(null);
			toast.success("Package saved");
			const savedId = saved.id ?? nextResource.id;
			if (savedId && savedId !== savedPlanDefinition?.id) {
				guard.allowNavigation();
				onCreated?.(savedId);
				void navigate({
					to: "/forms/packages/$packageId",
					params: { packageId: savedId },
					replace: true,
				});
			}
		} catch (error) {
			showSaveError(error, submittedDraft, candidate);
		}
	};
	const showProblems = (problems: Record<string, string>) => {
		if (code.mode === "form") {
			code.setError(null);
			setDesignerView("graph");
			return;
		}
		code.setError(
			new ResourceRequestError(
				{
					resourceType: "OperationOutcome",
					issue: Object.entries(problems).map(([path, diagnostics]) => ({
						severity: "error",
						code: "invalid",
						diagnostics,
						expression: [path],
					})),
				},
				0,
			),
		);
	};
	const openPreview = () => {
		const next = code.read();
		if (next) setPreview(next);
	};
	const graphScope = getAidboxApiURL("/fhir/PlanDefinition");
	const graphId = savedPlanDefinition?.id
		? `id:${encodeURIComponent(savedPlanDefinition.id)}`
		: "new";
	const graphProps = {
		storageKey: `formbox-plan-definition-graph:v1:${graphScope}/${graphId}`,
		planDefinitionTitle: planDefinition.title ?? "",
		planDefinitionSelected: selection === "plan-definition",
		onSelectPlanDefinition: () => {
			setSelection("plan-definition");
		},
		onQuickLook: setQuickLook,
		onQuickLookPlanDefinition: () => setQuickLook("plan-definition"),
		actions,
		actionKeys,
		questionnaires: formData.questionnaires,
		selectedIndex,
		selectedEdgeId: selectedEdge?.id,
		errors,
		loading: loadingForms,
		loadError: formData.loadError,
		onRetry: formData.retry,
		onSelect: (index: number | null) => {
			setSelection(index);
		},
		onSelectRule: (edge: PlanDefinitionGraphEdge) => {
			setSelection({ ...edge });
			setPropertiesTab(edge.kind);
		},
		onAddForms: () => setIsAddingForms(true),
	};

	return (
		<OperationOutcomeProvider outcome={outcome}>
			<FhirPathLspProvider>
				<NavbarBreadcrumbSlot>
					{planDefinition.title?.trim()}
				</NavbarBreadcrumbSlot>
				<UnsavedChangesDialog guard={guard} />
				<FormPreviewDialog
					form={preview}
					loadResource={false}
					onOpenChange={() => setPreview(null)}
				/>
				<PlanDefinitionSaveDialog
					planDefinition={confirmSave}
					savedPlanDefinition={savedPlanDefinition}
					isSaving={save.isPending}
					onOpenChange={(open) => !open && setConfirmSave(null)}
					onSave={() => void handleSave({ confirmed: true })}
					onCreate={() => void handleSave({ confirmed: true, createNew: true })}
				/>
				{isAddingForms && (
					<PlanDefinitionAddQuestionnairesDialog
						questionnaires={questionnaires}
						onOpenChange={setIsAddingForms}
						onAdd={(questionnaires) => {
							draft.addForms(questionnaires);
							setPropertiesTab("settings");
							setIsAddingForms(false);
						}}
					/>
				)}
				<NavbarRightSlot>
					<div className="flex items-center gap-2">
						<PlanDefinitionResourceLink planDefinition={savedPlanDefinition} />
						<Button
							data-test-id="plan-definition-editor__save-button"
							disabled={interactionDisabled}
							onClick={() => void handleSave()}
						>
							{save.isPending ? "Saving…" : "Save"}
						</Button>
					</div>
				</NavbarRightSlot>
				<fieldset
					className="flex min-h-0 min-w-0 flex-1 flex-col"
					data-test-id="plan-definition-editor"
					aria-label="Package editor"
					onKeyDownCapture={editorShortcutHandler({
						primary: openPreview,
						format: code.formatShortcut,
						disabled: interactionDisabled,
					})}
				>
					<ResizablePanelGroup
						direction="horizontal"
						autoSaveId="plan-definition-quick-look-layout"
					>
						<ResizablePanel
							id="plan-definition-editor-main"
							order={1}
							defaultSize={quickLook ? 60 : 100}
							minSize={30}
							className="flex min-h-0 min-w-0 flex-col"
						>
							{Boolean(code.error ?? outcome) && (
								<div className="shrink-0 p-4">
									<SaveDiagnostics
										error={code.error ?? outcome}
										onIssueClick={code.revealIssue}
									/>
								</div>
							)}
							<ResourceEditorToolbar
								label="Package"
								tabs={[
									{
										value: "graph",
										label: "Graph",
										testId: "plan-definition-editor__graph-tab",
									},
									{
										value: "preview",
										label: "Preview",
										testId: "plan-definition-editor__preview-tab",
									},
									{ value: "code", label: "Code" },
								]}
								mode={activeView}
								onModeChange={(mode) => {
									code.changeMode(mode === "code" ? "code" : "form");
									if (mode !== "code") setDesignerView(mode);
								}}
								disabled={interactionDisabled}
							/>
							<div className="min-h-0 flex-1" hidden={activeView !== "preview"}>
								<PlanDefinitionPreview planDefinition={resource} />
							</div>
							<div
								className="flex min-h-0 flex-1 flex-col"
								hidden={activeView === "preview"}
							>
								<ResourceEditorContent
									mode={code.mode}
									resourceType="PlanDefinition"
									value={code.text}
									onChange={(text) => {
										if (text !== code.text) {
											code.setText(text);
											setValidation(null);
										}
									}}
									onFormat={code.format}
									language={code.language}
									onLanguageChange={code.changeLanguage}
									focusIssue={code.focusIssue}
									readOnly={save.isPending}
								>
									<ResizablePanelGroup
										direction="vertical"
										autoSaveId="plan-definition-bottom-inspector-layout"
									>
										<ResizablePanel
											id="plan-definition-designer"
											order={1}
											defaultSize={65}
											minSize={30}
										>
											<PlanDefinitionGraph
												key={graphScope}
												{...graphProps}
												disabled={save.isPending}
												onReorder={(from, to) => {
													if (!save.isPending) draft.reorderActions(from, to);
												}}
												onSortingChange={setIsSorting}
												onDuplicate={(index) => {
													if (interactionDisabled) return;
													draft.duplicateAction(index);
													setPropertiesTab("settings");
												}}
												onDelete={(index) => {
													if (!interactionDisabled) draft.deleteAction(index);
												}}
											/>
										</ResizablePanel>
										<PlanDefinitionPropertiesPanel open={selection !== null}>
											<PlanDefinitionProperties
												panelRef={propertiesRef}
												action={action}
												actionIndex={selectedIndex ?? undefined}
												tab={propertiesTab}
												onTabChange={(tab) => {
													if (action) setPropertiesTab(tab);
												}}
												disabled={interactionDisabled}
												errorTabs={propertiesErrorTabs}
												advancedMode={ruleModes.controls[propertiesTab]}
											>
												{action ? (
													<>
														<TabsContent
															value="settings"
															forceMount
															hidden={propertiesTab !== "settings"}
															className="min-h-0 space-y-4 p-4"
														>
															<PlanDefinitionActionSettings
																action={action}
																actionPath={actionPath}
																actionIndex={selectedIndex ?? -1}
																errors={errors}
																onChange={updateAction}
															/>
														</TabsContent>
														<TabsContent
															value="condition"
															forceMount
															hidden={propertiesTab !== "condition"}
															className="min-h-0 p-4"
														>
															<PlanDefinitionConditionEditor
																key={actionKey}
																action={action}
																mode={ruleModes.conditionMode}
																rules={ruleModes.conditionRules}
																questions={questions}
																actions={actions}
																loading={loadingForms}
																loadError={formData.loadError}
																onRetry={formData.retry}
																compiledConditions={compiledConditions}
																variables={variables}
																errors={errors}
																actionPath={actionPath}
																actionIndex={selectedIndex ?? -1}
																onChange={updateAction}
															/>
														</TabsContent>
														<TabsContent
															value="prefill"
															forceMount
															hidden={propertiesTab !== "prefill"}
															className="min-h-0 p-4"
														>
															<PlanDefinitionPrefillEditor
																action={action}
																compiledAction={
																	resource.action?.[selectedIndex ?? -1]
																}
																actionPath={actionPath}
																actionIndex={selectedIndex ?? -1}
																targets={targets}
																targetQuestions={targetQuestions}
																prefillQuestions={prefillQuestions}
																loadingForms={loadingForms}
																ready={Boolean(
																	selectedQuestionnaire?.isSuccess,
																)}
																advanced={ruleModes.prefillAdvanced}
																variables={variables}
																errors={errors}
																onAdvancedChange={ruleModes.setPrefillAdvanced}
																onChange={updateAction}
															/>
														</TabsContent>
													</>
												) : (
													<TabsContent value="settings" className="min-h-0 p-4">
														<PlanDefinitionSettings
															planDefinition={planDefinition}
															errors={errors}
															automaticUrl={automaticUrl}
															urlPrefix={urlPrefix}
															setAutomaticUrl={setAutomaticUrl}
															onChange={updatePlanDefinition}
														/>
													</TabsContent>
												)}
											</PlanDefinitionProperties>
										</PlanDefinitionPropertiesPanel>
									</ResizablePanelGroup>
								</ResourceEditorContent>
							</div>
						</ResizablePanel>
						{quickLook && (
							<>
								<ResizableHandle aria-label="Resize quick look" />
								<ResizablePanel
									id="plan-definition-quick-look"
									order={2}
									defaultSize={40}
									minSize={25}
									maxSize={70}
								>
									<PlanDefinitionQuickLook
										target={quickLook}
										planDefinition={resource}
										onClose={() => setQuickLook(null)}
									/>
								</ResizablePanel>
							</>
						)}
					</ResizablePanelGroup>
				</fieldset>
			</FhirPathLspProvider>
		</OperationOutcomeProvider>
	);
}
