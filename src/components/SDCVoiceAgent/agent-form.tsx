import { generateId } from "@aidbox-ui/utils";
import {
	Badge,
	Button,
	Checkbox,
	Combobox,
	IconButton,
	Input,
	Label,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Textarea,
} from "@health-samurai/react-components";
import {
	LoaderCircle,
	Plus,
	Search,
	Settings2,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useId, useState } from "react";
import {
	type PromptReview,
	type QuestionnaireOption,
	questionnaireCanonical,
	type VoiceAgent,
	type VoiceAgentContextSlot,
	type VoicePrompt,
} from "./api";
import { ModelField } from "./model-field";
import { PromptReviewPanel } from "./prompt-review";
import {
	testConnections,
	type VoiceProvider,
	type VoiceTestConfig,
} from "./test-settings-dialog";

/**
 * The agent editor. Five tabs over one column: the prompt is where the work
 * happens, the rest is setup you visit when something needs changing.
 */

export type AgentDraft = {
	id?: string;
	title: string;
	status: "draft" | "active" | "retired";
	promptUrl: string;
	promptText: string;
	questionnaires: string[];
	context: VoiceAgentContextSlot[];
	stt: string;
	tts: string;
	llm: string;
	extractorLlm: string;
};

export function agentToDraft(
	agent: VoiceAgent | undefined,
	promptText: string,
): AgentDraft {
	const modelName = (field: "llm" | "stt" | "tts" | "extractorLlm") => {
		const id = agent?.[field]?.reference.replace(/^#/, "");
		return (
			agent?.contained?.find((device) => device.id === id)?.modelNumber ?? ""
		);
	};

	return {
		id: agent?.id,
		title: agent?.title ?? "",
		status: agent?.status ?? "draft",
		promptUrl: agent?.prompt ?? "",
		promptText,
		questionnaires: agent?.questionnaire ?? [],
		context: agent?.context ?? [],
		stt: modelName("stt"),
		tts: modelName("tts"),
		llm: modelName("llm"),
		extractorLlm: modelName("extractorLlm"),
	};
}

const VISIBLE_QUESTIONNAIRES = 10;

function optionLabel(questionnaire: QuestionnaireOption) {
	const name =
		questionnaire.title ?? questionnaire.name ?? questionnaire.url ?? "";
	return questionnaire.status === "active" ? name : `${name} (draft)`;
}

/**
 * The newest version stored under each url, so a bare-url reference — what
 * agents saved before versions were pinned hold — can be matched to the one
 * revision it means.
 */
function newestVersions(questionnaires: QuestionnaireOption[]) {
	const newest = new Map<string, string | undefined>();
	for (const q of questionnaires) {
		if (!q.url) continue;
		const seen = newest.get(q.url);
		const newer =
			seen === undefined ||
			(q.version ?? "").localeCompare(seen ?? "", undefined, {
				numeric: true,
			}) > 0;
		if (newer) newest.set(q.url, q.version);
	}
	return newest;
}

/** Whether one row is ticked, by canonical or by the bare url it answers to. */
function chosenBy(
	chosen: string[],
	newest: Map<string, string | undefined>,
	questionnaire: QuestionnaireOption,
) {
	if (chosen.includes(questionnaireCanonical(questionnaire))) return true;
	const url = questionnaire.url;
	return Boolean(
		url && chosen.includes(url) && newest.get(url) === questionnaire.version,
	);
}

function promptEditorOpen(naming: boolean, url: string) {
	return naming || Boolean(url);
}

function firstPromptEmpty(
	pending: boolean,
	count: number,
	editorOpen: boolean,
) {
	return !pending && count === 0 && !editorOpen;
}

function PromptIdField({
	fieldId,
	lineages,
	lineagesPending,
	naming,
	value,
	onChange,
}: {
	fieldId: string;
	lineages: VoicePrompt[];
	lineagesPending: boolean;
	naming: boolean;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<div className="flex w-full max-w-sm flex-col gap-1.5">
			<Label htmlFor={`${fieldId}-prompt-url`}>Prompt ID</Label>
			{naming ? (
				<Input
					autoFocus
					id={`${fieldId}-prompt-url`}
					data-test-id="agent-form__prompt-url-input"
					className="bg-bg-primary font-mono"
					placeholder="http://your-org/voice/prompt/check-in"
					value={value}
					onChange={(e) => onChange(e.target.value)}
				/>
			) : (
				<Combobox
					className="bg-bg-primary"
					data-test-id="agent-form__prompt-url-dropdown"
					emptyText={lineagesPending ? "Loading…" : "No prompts yet."}
					options={lineages.map((lineage) => ({
						value: lineage.url ?? "",
						label: lineage.url ?? "",
					}))}
					placeholder="Choose a prompt…"
					searchPlaceholder="Search prompts…"
					value={value}
					onValueChange={onChange}
				/>
			)}
		</div>
	);
}

export function AgentForm({
	draft,
	onChange,
	questionnaires,
	questionnairesPending,
	lineages,
	lineagesPending,
	resourceTypes,
	resourceTypesPending,
	revisions,
	lineageReady,
	promptDirty,
	onOverwrite,
	onReview,
	onReviewDismiss,
	onSaveNewVersion,
	onTestConfigChange,
	onTestSettingsOpen,
	review,
	reviewError,
	reviewing,
	saving,
	testConfig,
}: {
	draft: AgentDraft;
	onChange: (patch: Partial<AgentDraft>) => void;
	questionnaires: QuestionnaireOption[];
	questionnairesPending: boolean;
	lineages: VoicePrompt[];
	lineagesPending: boolean;
	resourceTypes: string[];
	resourceTypesPending: boolean;
	revisions: VoicePrompt[];
	lineageReady: boolean;
	promptDirty: boolean;
	onOverwrite: () => void;
	onReview: () => void;
	onReviewDismiss: () => void;
	onSaveNewVersion: () => Promise<void>;
	onTestConfigChange: (config: VoiceTestConfig) => void;
	onTestSettingsOpen: () => void;
	review?: PromptReview;
	reviewError?: string;
	reviewing: boolean;
	saving: boolean;
	testConfig: VoiceTestConfig;
}) {
	const fieldId = useId();
	const currentVersion = revisions[0]?.version;
	// a brand-new lineage has no url to pick yet, so the field turns into an input
	const [naming, setNaming] = useState(false);
	const [questionnaireSearch, setQuestionnaireSearch] = useState("");
	// what was selected before New cleared it, so Cancel has something to put back
	const [beforeNaming, setBeforeNaming] = useState({ url: "", text: "" });
	const startNewPrompt = () => {
		setBeforeNaming({ url: draft.promptUrl, text: draft.promptText });
		onChange({ promptUrl: "", promptText: "" });
		setNaming(true);
	};
	const cancelNewPrompt = () => {
		onChange({ promptUrl: beforeNaming.url, promptText: beforeNaming.text });
		setNaming(false);
	};
	const editorOpen = promptEditorOpen(naming, draft.promptUrl);
	const noPrompts = firstPromptEmpty(
		lineagesPending,
		lineages.length,
		editorOpen,
	);

	// Two revisions of one url are two rows here, so the tick follows the
	// canonical rather than the url they share.
	const newestByUrl = newestVersions(questionnaires);

	// A page of questionnaires at a time. What is already on the agent is exempt
	// from both the search and the limit: a filter that hid a ticked box would
	// read as having unticked it.
	const isChosen = (q: QuestionnaireOption) =>
		chosenBy(draft.questionnaires, newestByUrl, q);
	const chosenQuestionnaires = questionnaires.filter(isChosen);
	const restQuestionnaires = questionnaires
		.filter((q) => !isChosen(q))
		.filter((q) =>
			optionLabel(q)
				.toLowerCase()
				.includes(questionnaireSearch.trim().toLowerCase()),
		);
	const visibleQuestionnaires = [
		...chosenQuestionnaires,
		...restQuestionnaires.slice(0, VISIBLE_QUESTIONNAIRES),
	];
	const hiddenQuestionnaires = Math.max(
		0,
		restQuestionnaires.length - VISIBLE_QUESTIONNAIRES,
	);

	const patchSlot = (index: number, patch: Partial<VoiceAgentContextSlot>) =>
		onChange({
			context: draft.context.map((slot, i) =>
				i === index ? { ...slot, ...patch } : slot,
			),
		});

	const addSlot = (name: string, type: string) =>
		onChange({
			context: [...draft.context, { name, type, key: generateId() }],
		});

	return (
		<Tabs
			defaultValue="prompt"
			className="flex flex-col gap-4"
			data-test-id="agent-form"
		>
			<TabsList data-test-id="agent-form__tabs">
				<TabsTrigger value="prompt" data-test-id="agent-form__prompt-tab">
					Prompt
					{/* always laid out, only painted when dirty: letting the dot come and
              go would resize the trigger and shift the whole row */}
					<span
						aria-hidden="true"
						className={`ml-1.5 size-1.5 rounded-full ${
							promptDirty ? "bg-text-link" : "bg-transparent"
						}`}
					/>
					{promptDirty ? (
						<span className="sr-only">unsaved changes</span>
					) : null}
				</TabsTrigger>
				<TabsTrigger
					value="questionnaires"
					data-test-id="agent-form__questionnaires-tab"
				>
					Questionnaires
					{draft.questionnaires.length ? (
						<Badge variant="secondary" className="ml-1.5">
							{draft.questionnaires.length}
						</Badge>
					) : null}
				</TabsTrigger>
				<TabsTrigger value="context" data-test-id="agent-form__context-tab">
					Context
					{draft.context.length ? (
						<Badge variant="secondary" className="ml-1.5">
							{draft.context.length}
						</Badge>
					) : null}
				</TabsTrigger>
				<TabsTrigger value="voice" data-test-id="agent-form__voice-tab">
					Voice
				</TabsTrigger>
			</TabsList>

			<TabsContent value="prompt" className="flex flex-col gap-3">
				<div
					hidden={!noPrompts}
					className="flex flex-col items-start gap-3 rounded border border-border-primary border-dashed p-6"
				>
					<div className="flex flex-col gap-1">
						<p className="font-medium text-text-primary typo-body">
							No prompts yet
						</p>
						<p className="max-w-prose text-text-secondary typo-body">
							Create a prompt to define what the agent says during a call.
						</p>
					</div>
					<Button
						variant="primary"
						size="small"
						data-test-id="agent-form__new-prompt-button"
						onClick={startNewPrompt}
					>
						<Plus aria-hidden="true" className="size-4" />
						New prompt
					</Button>
				</div>

				<div hidden={noPrompts} className="flex flex-col gap-3">
					<div className="flex flex-wrap items-end gap-2">
						<PromptIdField
							fieldId={fieldId}
							lineages={lineages}
							lineagesPending={lineagesPending}
							naming={naming}
							value={draft.promptUrl}
							onChange={(value) => onChange({ promptUrl: value })}
						/>
						{!naming ? (
							<Button
								variant="ghost"
								size="small"
								className="mb-1"
								data-test-id="agent-form__new-prompt-version-button"
								onClick={startNewPrompt}
							>
								<Plus aria-hidden="true" className="size-4" />
								New
							</Button>
						) : null}
						{currentVersion ? (
							<Badge
								variant="secondary"
								className="mb-1"
								data-test-id="agent-form__prompt-version-badge"
							>
								v{currentVersion}
							</Badge>
						) : null}
						<Button
							variant="ghost"
							size="small"
							className="mb-1"
							data-test-id="agent-form__analyze-prompt-button"
							aria-busy={reviewing || undefined}
							disabled={reviewing || !draft.promptText.trim()}
							onClick={onReview}
						>
							{reviewing ? (
								<LoaderCircle
									aria-hidden="true"
									className="size-4 animate-spin"
								/>
							) : (
								<Sparkles aria-hidden="true" className="size-4" />
							)}
							{reviewing ? "Analyzing…" : "Analyze"}
						</Button>
					</div>

					<div hidden={!editorOpen} className="flex flex-col gap-3">
						<Textarea
							id={`${fieldId}-prompt`}
							data-test-id="agent-form__prompt-textarea"
							aria-label="Prompt"
							className="h-80 resize-none field-sizing-fixed overflow-y-auto bg-bg-primary font-mono leading-relaxed"
							placeholder="You are calling a patient for a short check-in…"
							value={draft.promptText}
							onChange={(e) => onChange({ promptText: e.target.value })}
						/>

						{reviewError ? (
							<p
								role="alert"
								className="text-text-danger typo-label"
								data-test-id="agent-form__prompt-error-text"
							>
								{reviewError}
							</p>
						) : null}

						{review ? (
							<PromptReviewPanel
								review={review}
								current={draft.promptText}
								onApply={(improved) => {
									onChange({ promptText: improved });
									onReviewDismiss();
								}}
								onDismiss={onReviewDismiss}
							/>
						) : null}

						<div className="flex items-start justify-between gap-4">
							<div className="flex min-w-0 flex-wrap items-center gap-2">
								{currentVersion ? (
									<Button
										variant="secondary"
										size="small"
										data-test-id="agent-form__replace-prompt-version-button"
										disabled={
											!promptDirty ||
											!draft.promptText.trim() ||
											saving ||
											!lineageReady
										}
										onClick={onOverwrite}
									>
										Replace v{currentVersion}
									</Button>
								) : null}
								<Button
									variant="primary"
									size="small"
									data-test-id="agent-form__save-prompt-button"
									disabled={
										!draft.promptUrl.trim() ||
										!draft.promptText.trim() ||
										saving ||
										!lineageReady
									}
									onClick={async () => {
										// a failed save keeps the input open: the url is still the
										// only place the text lives
										try {
											await onSaveNewVersion();
											setNaming(false);
										} catch {
											// The draft hook keeps the save diagnostics visible.
										}
									}}
								>
									{currentVersion
										? `Save as v${Number(currentVersion) + 1}`
										: "Create prompt"}
								</Button>
								<span className="text-text-tertiary typo-label">
									{lineageReady && draft.promptUrl.trim() && !currentVersion
										? "Nothing stored under this url yet."
										: "Calls resolve the latest active revision."}
								</span>
							</div>
							{/* the way out sits apart from the two ways to save, so a stray
                  click does not land on it */}
							{naming ? (
								<Button
									variant="ghost"
									size="small"
									danger
									data-test-id="agent-form__cancel-new-prompt-button"
									disabled={saving}
									onClick={cancelNewPrompt}
								>
									Cancel
								</Button>
							) : (
								<Button
									variant="ghost"
									size="small"
									danger
									data-test-id="agent-form__discard-prompt-changes-button"
									disabled={!promptDirty || !lineageReady || saving}
									onClick={() =>
										onChange({ promptText: revisions[0]?.prompt ?? "" })
									}
								>
									Discard changes
								</Button>
							)}
						</div>
					</div>

					<div
						hidden={editorOpen}
						className="rounded border border-border-primary border-dashed p-6 text-text-secondary typo-body"
					>
						Choose a prompt above or create a new one.
					</div>
				</div>
			</TabsContent>

			<TabsContent value="questionnaires" className="flex flex-col gap-2">
				<Input
					className="bg-bg-primary"
					data-test-id="agent-form__questionnaire-search-input"
					aria-label="Search questionnaires"
					leftSlot={<Search />}
					placeholder="Search questionnaires…"
					value={questionnaireSearch}
					onChange={(e) => setQuestionnaireSearch(e.target.value)}
				/>
				<div className="flex min-h-[22rem] flex-col divide-y divide-border-primary overflow-y-auto rounded border border-border-primary">
					{visibleQuestionnaires.length === 0 ? (
						<p className="p-3 text-sm text-text-secondary">
							{questionnairesPending
								? "Loading…"
								: questionnaires.length === 0
									? "No questionnaires found."
									: "Nothing matches that search."}
						</p>
					) : (
						visibleQuestionnaires.map((questionnaire, index) => {
							const url = questionnaire.url ?? "";
							const canonical = questionnaireCanonical(questionnaire);
							const chosen = isChosen(questionnaire);
							// id, not url: two revisions share a url, and a stored resource
							// always has one. index only covers a server that sent neither
							const rowKey = questionnaire.id ?? `${canonical}-${index}`;
							const rowId = `${fieldId}-q-${rowKey}`;
							return (
								<label
									key={rowKey}
									htmlFor={rowId}
									data-test-id="agent-form__questionnaire-row"
									data-questionnaire={canonical}
									className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-bg-secondary"
								>
									<Checkbox
										id={rowId}
										data-test-id="agent-form__questionnaire-checkbox"
										className="mt-0.5"
										checked={chosen}
										onCheckedChange={() =>
											onChange({
												questionnaires: chosen
													? draft.questionnaires.filter(
															(it) => it !== canonical && it !== url,
														)
													: [...draft.questionnaires, canonical],
											})
										}
									/>
									<span className="flex min-w-0 flex-col">
										<span className="truncate text-sm text-text-primary">
											{questionnaire.title ?? questionnaire.name ?? url}
										</span>
										<span className="truncate font-mono text-text-tertiary text-xs">
											{canonical}
										</span>
									</span>
									{questionnaire.status !== "active" ? (
										<Badge variant="secondary" className="ml-auto shrink-0">
											{questionnaire.status}
										</Badge>
									) : null}
								</label>
							);
						})
					)}
				</div>
				<p className="text-text-tertiary typo-label">
					{hiddenQuestionnaires > 0
						? `${hiddenQuestionnaires} more, search to narrow down. `
						: ""}
					Asked in the order they are listed.
				</p>
			</TabsContent>

			<TabsContent value="context" className="flex flex-col gap-3">
				{draft.context.length === 0 ? (
					<div className="flex flex-col items-start gap-3 rounded border border-border-primary border-dashed p-6">
						<p className="max-w-prose text-sm text-text-secondary">
							Context is what the agent knows before it speaks. Each slot names
							a resource that is chosen when the call is placed, and its
							contents are written into the prompt, so the agent can greet
							someone by name instead of asking who it is talking to.
						</p>
						<p className="max-w-prose text-sm text-text-secondary">
							A phone call needs at least a Patient: that is who gets dialled.
						</p>
						<div className="flex gap-2">
							<Button
								variant="primary"
								size="small"
								data-test-id="agent-form__add-patient-slot-button"
								onClick={() => addSlot("patient", "Patient")}
							>
								<Plus className="size-4" />
								Add Patient
							</Button>
							<Button
								variant="secondary"
								size="small"
								data-test-id="agent-form__add-slot-button"
								onClick={() => addSlot("", "")}
							>
								Add another slot
							</Button>
						</div>
					</div>
				) : (
					<>
						{/* a grid, not a stack of cards: the column headings are worth
                saying once, not once per slot */}
						<div className="overflow-hidden rounded border border-border-primary">
							<div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2 border-border-primary border-b bg-bg-secondary px-3 py-2 text-text-tertiary typo-label">
								<span>Name</span>
								<span>Resource type</span>
								<span>Label</span>
								<span className="sr-only">Actions</span>
							</div>
							{draft.context.map((slot, index) => (
								<div
									key={slot.key ?? `${slot.name}-${slot.type}`}
									data-test-id="agent-form__context-slot-row"
									data-slot-index={index}
									className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2 border-border-primary border-b px-3 py-2 last:border-b-0"
								>
									<Input
										data-test-id="agent-form__context-slot-name-input"
										aria-label={`Slot ${index + 1} name`}
										className="bg-bg-primary font-mono"
										placeholder="patient"
										value={slot.name}
										onChange={(e) => patchSlot(index, { name: e.target.value })}
									/>
									<Combobox
										className="bg-bg-primary"
										data-test-id="agent-form__context-slot-type-dropdown"
										emptyText={
											resourceTypesPending
												? "Loading…"
												: "No such resource type."
										}
										options={resourceTypes.map((type) => ({
											value: type,
											label: type,
										}))}
										placeholder="Choose a type…"
										searchPlaceholder="Search types…"
										value={slot.type}
										onValueChange={(value) => patchSlot(index, { type: value })}
									/>
									<Input
										data-test-id="agent-form__context-slot-label-input"
										aria-label={`Slot ${index + 1} label`}
										className="bg-bg-primary"
										placeholder={slot.name || "Shown in the picker"}
										value={slot.label ?? ""}
										onChange={(e) =>
											patchSlot(index, { label: e.target.value })
										}
									/>
									<IconButton
										variant="ghost"
										data-test-id="agent-form__remove-context-slot-button"
										aria-label={`Remove slot ${slot.name || index + 1}`}
										onClick={() =>
											onChange({
												context: draft.context.filter((_, i) => i !== index),
											})
										}
										className="text-text-error-primary hover:text-text-error-primary hover:bg-bg-error-primary"
										icon={<Trash2 className="size-4" />}
									/>
								</div>
							))}
						</div>
						<p className="text-text-tertiary typo-label">
							Each slot is chosen when the call is placed, then written into the
							prompt under its name.
						</p>
						<div className="flex gap-2">
							<Button
								variant="secondary"
								size="small"
								data-test-id="agent-form__add-slot-button"
								onClick={() => addSlot("", "")}
							>
								<Plus className="size-4" />
								Add slot
							</Button>
							{!draft.context.some((slot) => slot.type === "Patient") && (
								<Button
									variant="secondary"
									size="small"
									data-test-id="agent-form__add-patient-slot-button"
									onClick={() => addSlot("patient", "Patient")}
								>
									<Plus className="size-4" />
									Add Patient
								</Button>
							)}
						</div>
					</>
				)}
			</TabsContent>

			<TabsContent value="voice" className="flex flex-col gap-3">
				<div className="flex items-center justify-between gap-3">
					<p className="text-text-secondary typo-label">
						Provider credentials can override deployment settings for browser
						rehearsals.
					</p>
					<Button
						variant="secondary"
						size="small"
						data-test-id="agent-form__test-settings-button"
						onClick={onTestSettingsOpen}
					>
						<Settings2 aria-hidden="true" className="size-4" />
						Test settings
					</Button>
				</div>
				<div className="grid gap-3 sm:grid-cols-3">
					{(["llm", "stt", "tts"] as const).map((kind) => {
						const field = kind === "llm" ? "llm" : kind;
						const label =
							kind === "llm"
								? "Language model"
								: kind === "stt"
									? "Speech to text"
									: "Voice";
						return (
							<ModelField
								key={kind}
								kind={kind}
								label={label}
								selectedProvider={testConfig.selection[kind]}
								tests={testConnections(testConfig, kind)}
								value={draft[field]}
								onProviderChange={(provider: VoiceProvider) =>
									onTestConfigChange({
										...testConfig,
										selection: { ...testConfig.selection, [kind]: provider },
									})
								}
								onChange={(value) => onChange({ [field]: value })}
							/>
						);
					})}
				</div>

				<div className="flex flex-col gap-1.5 border-border-primary border-t pt-4">
					<ModelField
						kind="llm"
						label="Extraction model"
						providerFilter={testConfig.selection.llm}
						selectedProvider={testConfig.selection.llm}
						tests={testConnections(testConfig, "llm")}
						value={draft.extractorLlm}
						onChange={(value) => onChange({ extractorLlm: value })}
					/>
					<p className="text-text-tertiary typo-label">
						Turns the finished transcript into answers. A separate call from the
						conversation, so it can be cheaper or stricter; falls back to the
						language model.
					</p>
				</div>
			</TabsContent>
		</Tabs>
	);
}
