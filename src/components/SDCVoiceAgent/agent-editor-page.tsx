import { useAidboxClient } from "@aidbox-ui/AidboxClient";
import {
	AppSelectContent,
	AppSelectItem,
} from "@aidbox-ui/components/app-select";
import { ConfirmDialog } from "@aidbox-ui/components/confirm-dialog";
import { SaveDiagnostics } from "@aidbox-ui/components/save-diagnostics";
import {
	UnsavedChangesDialog,
	useUnsavedChangesGuard,
} from "@aidbox-ui/components/unsaved-changes";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	IconButton,
	Input,
	Label,
	Select,
	SelectTrigger,
	SelectValue,
	Skeleton,
	toast,
} from "@health-samurai/react-components";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Ellipsis, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type AgentDraft, AgentForm } from "./agent-form";
import {
	type PromptReview,
	useDeleteVoiceAgent,
	usePromptLineages,
	useResourceTypes,
	useReviewPrompt,
	useVoiceQuestionnaires,
} from "./api";
import { CallResultsPanel } from "./call-results";
import type { ContextCandidate } from "./context-picker";
import { ConversationPanel, type Transport } from "./conversation-panel";
import {
	readVoiceTestConfig,
	TestSettingsDialog,
	testConnection,
	testConnections,
	type VoiceProvider,
	type VoiceTestConfig,
	writeVoiceTestConfig,
} from "./test-settings-dialog";
import { useAgentDraft } from "./use-agent-draft";
import { errorText, useAgentRun } from "./use-agent-run";
import { useConversation } from "./use-conversation";

/**
 * One agent, edited and heard on the same screen. Identity sits in the header
 * because it names the thing being edited; everything that shapes the
 * conversation lives in the tabs below.
 */

/**
 * A number the agent can actually dial: E.164, or a SIP address. Deliberately
 * strict, because the cost of a loose match is a stranger being interviewed.
 */
function dialable(value: string) {
	const trimmed = value.trim();
	return (
		/^\+[1-9]\d{7,14}$/.test(trimmed) || /^sips?:[^\s@]+@[^\s@]+$/.test(trimmed)
	);
}

/**
 * The single reason a run cannot start, in the order the user would hit them.
 * Empty means go.
 */
export function whyNotRunnable({
	dialable: numberOk,
	missing,
	named,
	phoneTransport,
	unfilled,
}: {
	dialable: boolean;
	missing: string[];
	named: boolean;
	phoneTransport: boolean;
	unfilled: string[];
}) {
	if (!named) return "Name the agent first.";
	if (missing.length) return `Add ${missing.join(" and ")} first.`;
	if (phoneTransport && !numberOk) {
		return "Enter a number in E.164 form (+15551234567) or a SIP address.";
	}
	if (unfilled.length) return `Choose ${unfilled.join(", ")} before starting.`;
	return "";
}

export function patientPhone(patient?: ContextCandidate) {
	const telecom = patient?.telecom;
	if (!Array.isArray(telecom)) return "";
	const phone = telecom.find(
		(item) =>
			item &&
			typeof item === "object" &&
			"system" in item &&
			item.system === "phone" &&
			"value" in item &&
			typeof item.value === "string",
	);
	return phone && typeof phone === "object" && "value" in phone
		? String(phone.value)
		: "";
}

function missingTestModels(
	config: VoiceTestConfig,
	draft: AgentDraft,
	transport: Transport,
) {
	if (transport === "phone") return [];
	return [
		testConnection(config, "llm") && !draft.llm ? "a language model" : null,
		transport === "browser" && testConnection(config, "stt") && !draft.stt
			? "a speech-to-text model"
			: null,
		(transport === "browser" || transport === "demo") &&
		testConnection(config, "tts") &&
		!draft.tts
			? "a voice"
			: null,
	].filter(Boolean) as string[];
}

/**
 * The Formbox voice agent editor as the ResourceEditor Builder tab. An agent
 * is saved together with its prompt through `/sdc/voice/$save-agent`, so the
 * tab keeps its own draft and Save rather than editing the resource JSON.
 */
export function VoiceAgentBuilderContent({
	agentId,
	onSaved,
	onDeleted,
}: {
	agentId?: string;
	/** After a save, once the tab is left: the Edit tab must not show stale JSON. */
	onSaved?: () => void;
	onDeleted?: () => void;
}) {
	const navigate = useNavigate();
	const savedRef = useRef(false);
	const onSavedRef = useRef(onSaved);
	useEffect(() => {
		onSavedRef.current = onSaved;
	});
	// Refreshing the editor right after a save would remount this tab and cut
	// off a call that has just started, so it waits until the tab goes away.
	useEffect(
		() => () => {
			if (savedRef.current) onSavedRef.current?.();
		},
		[],
	);
	const [transport, setTransport] = useState<Transport>("text");
	const [phone, setPhone] = useState(
		sessionStorage.getItem("sdc-voice-lab.phone") ?? "",
	);
	const [demoVoice, setDemoVoice] = useState("");
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [testSettingsOpen, setTestSettingsOpen] = useState(false);
	const [testConfig, setTestConfig] = useState(readVoiceTestConfig);
	// the last review, kept until dismissed or applied — a person reads the
	// findings, edits, and re-runs, and losing them on the first keystroke would
	// make that impossible
	const [review, setReview] = useState<PromptReview>();
	// slot name -> chosen resource id, filled in just before a call
	const [contextValues, setContextValues] = useState<Record<string, string>>(
		{},
	);
	const client = useAidboxClient();
	const queryClient = useQueryClient();
	const call = useConversation();

	// A custom OpenAI base still speaks the OpenAI wire protocol and is recorded
	// as that provider on the contained Device. Declared before the draft hook,
	// which saves those Devices along with the agent.
	const providerOf = useCallback(
		(kind: "llm" | "stt" | "tts") => {
			return testConfig.selection[kind];
		},
		[testConfig.selection],
	);

	const {
		agentQuery,
		draft,
		lineageReady,
		patch,
		persistAgent,
		persistPrompt,
		promptDirty,
		isDirty,
		revisions,
		saving,
		saveError,
	} = useAgentDraft(agentId, providerOf);
	const guard = useUnsavedChangesGuard(isDirty);
	const questionnairesQuery = useVoiceQuestionnaires();
	const lineagesQuery = usePromptLineages();
	const resourceTypesQuery = useResourceTypes();
	const deleteAgent = useDeleteVoiceAgent();
	const reviewPrompt = useReviewPrompt();

	const busy = saving || deleteAgent.isPending;
	const slots = draft.context.filter((slot) => slot.name && slot.type);
	const unfilled = slots.filter((slot) => !contextValues[slot.name]);
	const subjectSlot = slots.find((slot) => slot.type === "Patient");
	const named = Boolean(draft.title.trim() || draft.id);

	// A url alone is not a prompt: a new lineage needs text, while an existing
	// one needs at least one stored revision.
	const hasPrompt = Boolean(
		draft.promptUrl.trim() && (revisions.length > 0 || draft.promptText.trim()),
	);
	const missing = [
		hasPrompt ? null : "a prompt",
		draft.questionnaires.length ? null : "a questionnaire",
	].filter(Boolean) as string[];
	const savable = named && lineageReady && missing.length === 0;
	const blocker = !lineageReady
		? "Wait for the prompt to finish loading."
		: whyNotRunnable({
				dialable: dialable(phone),
				missing: [
					...missing,
					...missingTestModels(testConfig, draft, transport),
					transport === "demo" && !demoVoice ? "a patient voice" : null,
				].filter(Boolean) as string[],
				named,
				phoneTransport: transport === "phone",
				unfilled: unfilled.map((slot) => slot.label ?? slot.name),
			});

	/** Prompt first, then the agent: a run must never use a stale prompt. */
	async function save() {
		if (!lineageReady) {
			throw new Error("Wait for the prompt to finish loading before saving.");
		}
		if (!hasPrompt) throw new Error("Add a prompt before saving.");
		if (promptDirty && draft.promptUrl.trim()) {
			await persistPrompt(revisions[0] ? "overwrite" : "new-version");
		}
		const saved = await persistAgent();
		savedRef.current = true;
		if (!agentId && saved.id) {
			guard.allowNavigation();
			navigate({
				to: "/resource/$resourceType/edit/$id",
				params: { resourceType: "SDCVoiceAgent", id: saved.id },
				search: { tab: "builder", mode: "json", builderTab: "form" },
				ignoreBlocker: true,
			});
		}
		return saved.id;
	}

	const updateTestConfig = useCallback(
		(next: VoiceTestConfig) => {
			writeVoiceTestConfig(next);
			setTestConfig(next);
			void queryClient.invalidateQueries({ queryKey: ["sdc-voice-models"] });
		},
		[queryClient],
	);

	// $call takes the agent as a resource, so the draft travels as one — with no
	// id, which is what tells the box to keep it inside the Task rather than look
	// it up. Models ride along as contained Devices: picking one to try out this
	// way costs nothing in the database.
	const draftAgent = useMemo(() => {
		const models = [
			{ field: "llm", kind: "llm" as const, name: draft.llm },
			{ field: "stt", kind: "stt" as const, name: draft.stt },
			{ field: "tts", kind: "tts" as const, name: draft.tts },
			{ field: "extractorLlm", kind: "llm" as const, name: draft.extractorLlm },
		].filter((model) => model.name);

		return {
			resourceType: "SDCVoiceAgent",
			status: "active",
			prompt: draft.promptUrl || undefined,
			questionnaire: draft.questionnaires,
			// an empty label fails validation, and the box falls back to the name
			context: slots.map(({ key: _key, label, ...slot }) =>
				label ? { ...slot, label } : slot,
			),
			contained: models.map((model) => ({
				resourceType: "Device",
				id: model.field,
				modelNumber: model.name,
				manufacturer:
					agentQuery.data?.contained?.find(
						(device) =>
							device.id === model.field && device.modelNumber === model.name,
					)?.manufacturer ?? providerOf(model.kind),
				status: "active",
			})),
			...Object.fromEntries(
				models.map((model) => [model.field, { reference: `#${model.field}` }]),
			),
		};
	}, [agentQuery.data, draft, providerOf, slots]);

	const demoVoiceProvider =
		(agentQuery.data?.contained?.find(
			(device) => device.id === "tts" && device.modelNumber === draft.tts,
		)?.manufacturer as VoiceProvider | undefined) ?? testConfig.selection.tts;

	const browserCredentials = Object.fromEntries(
		(["llm", "stt", "tts"] as const).flatMap((kind) => {
			const connection = testConnection(testConfig, kind);
			return connection
				? [[kind, { apiKey: connection.apiKey, baseUrl: connection.baseUrl }]]
				: [];
		}),
	);

	const { run, stop } = useAgentRun({
		call,
		client,
		contextValues,
		demoVoice,
		// rehearsals send the unsaved wording along, so what you hear is what is
		// on screen rather than what was last stored
		// $call takes it as a resource, so it travels as one — with no id, which is
		// what tells the box this is a draft to keep inside the Task rather than
		// an agent to look up.
		draft: draftAgent,
		browserCredentials,
		phone,
		slots,
		transport,
		save: async () => {
			sessionStorage.setItem("sdc-voice-lab.phone", phone);
			return save();
		},
	});

	if (agentId && agentQuery.isPending) {
		return (
			<div className="flex flex-col gap-3 p-6">
				<Skeleton className="h-9 w-72" />
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	if (agentId && agentQuery.isError) {
		return (
			<p className="p-8 text-text-error-primary typo-body">
				Could not load this agent. {errorText(agentQuery.error)}
			</p>
		);
	}

	return (
		<div className="flex h-full flex-col gap-6 overflow-auto p-6">
			{/* The agent is the document being edited, so its identity and document
          actions form a header rather than another row of form controls. */}
			<header className="flex flex-wrap items-end gap-2 border-border-primary border-b pb-5">
				<div className="flex w-full max-w-sm flex-col gap-1">
					<Label
						htmlFor="voice-agent-title"
						className="px-0.5 text-text-secondary body14bold"
					>
						Agent name
					</Label>
					<Input
						id="voice-agent-title"
						data-test-id="agent-editor__title-input"
						className="w-full max-w-sm bg-bg-primary font-medium"
						placeholder="Untitled agent"
						value={draft.title}
						onChange={(e) => patch({ title: e.target.value })}
					/>
				</div>

				<div className="flex flex-col gap-1">
					<Label
						htmlFor="voice-agent-status"
						className="px-0.5 text-text-secondary body14bold"
					>
						Status
					</Label>
					<Select
						value={draft.status}
						onValueChange={(value) =>
							patch({ status: value as AgentDraft["status"] })
						}
					>
						<SelectTrigger
							id="voice-agent-status"
							data-test-id="agent-editor__status-dropdown"
							className="w-28 bg-bg-primary"
						>
							<SelectValue />
						</SelectTrigger>
						<AppSelectContent data-test-id="agent-editor__status-options">
							<AppSelectItem
								data-test-id="agent-editor__status-option"
								value="draft"
							>
								Draft
							</AppSelectItem>
							<AppSelectItem
								data-test-id="agent-editor__status-option"
								value="active"
							>
								Active
							</AppSelectItem>
							<AppSelectItem
								data-test-id="agent-editor__status-option"
								value="retired"
							>
								Retired
							</AppSelectItem>
						</AppSelectContent>
					</Select>
				</div>
				<Button
					variant="primary"
					data-test-id="agent-editor__save-button"
					disabled={busy || !savable}
					title={missing.length ? `Add ${missing.join(" and ")} first.` : ""}
					onClick={() =>
						void save()
							.then(() => toast.success("Agent saved"))
							.catch((error) => toast.error(errorText(error)))
					}
				>
					Save changes
				</Button>
				{draft.id ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<IconButton
								variant="ghost"
								className="ml-auto"
								aria-label="More agent actions"
								data-test-id="agent-editor__menu-button"
								disabled={busy}
								icon={<Ellipsis aria-hidden="true" className="size-4" />}
							/>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" data-test-id="agent-editor__menu">
							<DropdownMenuItem
								variant="destructive"
								className="justify-start"
								data-test-id="agent-editor__menu-delete-button"
								onClick={() => setDeleteOpen(true)}
							>
								<Trash2 aria-hidden="true" className="size-4" />
								Delete agent
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
				{missing.length ? (
					<p
						className="basis-full text-text-tertiary typo-label"
						data-test-id="agent-editor__missing-fields-text"
					>
						Add {missing.join(" and ")} before saving.
					</p>
				) : null}
			</header>

			<SaveDiagnostics error={saveError} />

			<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,7fr)_minmax(0,8fr)]">
				<AgentForm
					draft={draft}
					onChange={patch}
					questionnaires={questionnairesQuery.data ?? []}
					questionnairesPending={questionnairesQuery.isPending}
					lineages={lineagesQuery.data ?? []}
					lineagesPending={lineagesQuery.isPending}
					resourceTypes={resourceTypesQuery.data ?? []}
					resourceTypesPending={resourceTypesQuery.isPending}
					revisions={revisions}
					lineageReady={lineageReady}
					promptDirty={promptDirty}
					onOverwrite={() => void persistPrompt("overwrite").catch(() => {})}
					onReview={() => {
						setReview(undefined);
						reviewPrompt.mutate(
							{
								agent: draft.id,
								prompt: draft.promptText,
								credentials: browserCredentials.llm
									? { llm: browserCredentials.llm }
									: undefined,
							},
							{ onSuccess: setReview },
						);
					}}
					onReviewDismiss={() => {
						setReview(undefined);
						reviewPrompt.reset();
					}}
					onSaveNewVersion={() => persistPrompt("new-version")}
					onTestConfigChange={updateTestConfig}
					onTestSettingsOpen={() => setTestSettingsOpen(true)}
					review={review}
					reviewError={
						reviewPrompt.error ? errorText(reviewPrompt.error) : undefined
					}
					reviewing={reviewPrompt.isPending}
					saving={busy}
					testConfig={testConfig}
				/>

				<ConversationPanel
					transport={transport}
					onTransportChange={setTransport}
					phone={phone}
					onPhoneChange={setPhone}
					demoVoice={demoVoice}
					onDemoVoiceChange={setDemoVoice}
					demoVoiceProvider={demoVoiceProvider}
					demoVoiceTests={testConnections(testConfig, "tts")}
					slots={slots}
					contextValues={contextValues}
					onContextChange={(name, id, resource) => {
						setContextValues((current) => ({ ...current, [name]: id }));
						const slot = slots.find((item) => item.name === name);
						if (transport === "phone" && slot?.type === "Patient") {
							const value = patientPhone(resource);
							if (value) setPhone(value);
						}
					}}
					messages={call.messages}
					running={call.running}
					status={call.status}
					error={call.error}
					blocker={blocker}
					canStart={!blocker && !busy && !call.running}
					onMute={call.mute}
					onStart={() => {
						// the phone is the only transport that reaches a person, so it is
						// the only one that asks first
						if (transport === "phone") setConfirmOpen(true);
						else void run();
					}}
					onStop={() => void stop()}
					onSay={call.say}
				/>
			</div>

			{/* Below the two columns rather than inside one: the answers are read
          across — question, what was recorded, the words behind it — and that
          reads badly in half a screen. */}
			<CallResultsPanel
				callId={call.callId}
				enabled={call.callState === "ended"}
			/>

			<ConfirmDialog
				title="Place a real call"
				confirmLabel="Call"
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				description={
					<>
						Dial <span className="font-medium">{phone}</span>
						{subjectSlot && contextValues[subjectSlot.name] ? (
							<>
								{" "}
								for{" "}
								<span className="font-medium">
									{contextValues[subjectSlot.name]}
								</span>
							</>
						) : null}
						? The agent speaks to whoever answers and works through{" "}
						{draft.questionnaires.length === 1
							? "one questionnaire"
							: `${draft.questionnaires.length} questionnaires`}
						.
					</>
				}
				onConfirm={() => void run()}
			/>

			<TestSettingsDialog
				config={testConfig}
				onChange={updateTestConfig}
				open={testSettingsOpen}
				onOpenChange={setTestSettingsOpen}
			/>

			<ConfirmDialog
				title="Delete voice agent"
				confirmLabel="Delete"
				danger
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				onConfirm={async () => {
					await deleteAgent.mutateAsync(draft.id ?? "");
					setDeleteOpen(false);
					toast.success("Agent deleted");
					guard.allowNavigation();
					savedRef.current = false;
					window.dispatchEvent(new Event("aidbox-resource-deleted"));
					if (onDeleted) onDeleted();
					else
						navigate({
							to: "/resource/$resourceType",
							params: { resourceType: "SDCVoiceAgent" },
							ignoreBlocker: true,
						});
				}}
				description={
					<>
						Delete{" "}
						<span className="font-medium">
							{draft.title || draft.id || "this agent"}
						</span>
						? The prompt it points at is kept, so other agents using it are
						unaffected.
					</>
				}
			/>
			<UnsavedChangesDialog guard={guard} />
		</div>
	);
}
