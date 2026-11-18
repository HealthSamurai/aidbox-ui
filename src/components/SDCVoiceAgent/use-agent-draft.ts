import { toast } from "@health-samurai/react-components";
import { useEffect, useMemo, useRef, useState } from "react";
import { type AgentDraft, agentToDraft } from "./agent-form";
import {
	nextVersion,
	usePromptLineage,
	useSaveVoiceAgent,
	useSaveVoicePrompt,
	useVoiceAgent,
	type VoiceAgent,
} from "./api";
import { errorText } from "./use-agent-run";

/**
 * The edited agent: what is on screen, what is stored, and what it takes to
 * reconcile the two. The prompt lives in its own versioned resource, so saving
 * an agent is really two saves.
 */

const EMPTY_DRAFT: AgentDraft = {
	title: "",
	status: "draft",
	promptUrl: "",
	promptText: "",
	questionnaires: [],
	context: [],
	stt: "",
	tts: "",
	llm: "",
	extractorLlm: "",
};

/**
 * The agent as $save-agent takes it: every model field references its
 * contained Device. The operation materializes those Devices; playground uses
 * this same shape but leaves them contained.
 */
function draftToAgent(
	draft: AgentDraft,
	providerOf: (kind: "llm" | "stt" | "tts") => string | undefined,
	existing?: VoiceAgent,
): VoiceAgent {
	const models = [
		{ field: "llm", kind: "llm" as const, name: draft.llm },
		{ field: "stt", kind: "stt" as const, name: draft.stt },
		{ field: "tts", kind: "tts" as const, name: draft.tts },
		{ field: "extractorLlm", kind: "llm" as const, name: draft.extractorLlm },
	].filter((model) => model.name);
	const provider = (field: string, kind: "llm" | "stt" | "tts", name: string) =>
		existing?.contained?.find(
			(device) => device.id === field && device.modelNumber === name,
		)?.manufacturer ?? providerOf(kind);

	return {
		...existing,
		resourceType: "SDCVoiceAgent",
		id: draft.id,
		title: draft.title || undefined,
		status: draft.status,
		prompt: draft.promptUrl || undefined,
		questionnaire: draft.questionnaires.length
			? draft.questionnaires
			: undefined,
		context: draft.context.length
			? draft.context
					.filter((slot) => slot.name && slot.type)
					// `key` only exists to keep React rows stable while editing
					.map(({ key: _key, ...slot }) => slot)
			: undefined,
		// the box reads the maker off these and drops them; the saved agent points
		// at the Devices it created
		contained: models.length
			? models.map((model) => ({
					resourceType: "Device" as const,
					id: model.field,
					modelNumber: model.name,
					manufacturer: provider(model.field, model.kind, model.name),
					status: "active" as const,
				}))
			: undefined,
		stt: draft.stt ? { reference: "#stt" } : undefined,
		tts: draft.tts ? { reference: "#tts" } : undefined,
		llm: draft.llm ? { reference: "#llm" } : undefined,
		extractorLlm: draft.extractorLlm
			? { reference: "#extractorLlm" }
			: undefined,
	};
}

/**
 * The url whose stored text the editor should adopt, or undefined to leave what
 * is on screen alone.
 *
 * Only a lineage that actually has a revision has text to give. A url with none
 * is one being typed for the first time, and adopting its empty text would wipe
 * the prompt keystroke by keystroke as the name is entered.
 */
function adoptableLineage({
	hasRevisions,
	loaded,
	stale,
	url,
}: {
	hasRevisions: boolean;
	loaded: boolean;
	/** Data still belonging to the previously requested url. */
	stale: boolean;
	url: string;
}) {
	return url.trim() && loaded && hasRevisions && !stale ? url : undefined;
}

export function useAgentDraft(
	agentId: string | undefined,
	providerOf: (kind: "llm" | "stt" | "tts") => string | undefined,
) {
	const [draft, setDraft] = useState<AgentDraft>(EMPTY_DRAFT);
	const agentQuery = useVoiceAgent(agentId);
	const agent = agentQuery.data;
	// follows the editor, not the saved agent: picking another lineage has to
	// bring its text with it
	const lineageQuery = usePromptLineage(draft.promptUrl);
	// keepPreviousData holds the last lineage while a new url loads, and a
	// disabled query (empty url after New) keeps its last success. Neither list
	// belongs to the url on screen.
	const revisions = useMemo(
		() =>
			draft.promptUrl.trim() && !lineageQuery.isPlaceholderData
				? (lineageQuery.data ?? [])
				: [],
		[draft.promptUrl, lineageQuery.data, lineageQuery.isPlaceholderData],
	);
	const saveAgent = useSaveVoiceAgent();
	const savePrompt = useSaveVoicePrompt();
	const [saveError, setSaveError] = useState<unknown>(null);

	// Saving hands back a fresh agent object for the same id, and that must not
	// wipe what is being typed: the text belongs to the lineage, not the agent.
	// A different agent starts clean and lets its own lineage fill the box. The
	// id lives in a ref written only inside the effect — never during render.
	const lastAgentId = useRef<string | undefined>(undefined);
	useEffect(() => {
		const sameAgent = Boolean(agent?.id) && agent?.id === lastAgentId.current;
		lastAgentId.current = agent?.id;
		setDraft((current) => (sameAgent ? current : agentToDraft(agent, "")));
	}, [agent]);

	// …and whichever lineage the form points at brings its own text along
	const headPrompt = revisions[0]?.prompt ?? "";
	const lineageUrl = adoptableLineage({
		hasRevisions: revisions.length > 0,
		loaded: lineageQuery.isSuccess,
		stale: lineageQuery.isPlaceholderData,
		url: draft.promptUrl,
	});
	useEffect(() => {
		if (lineageUrl !== undefined) {
			setDraft((current) => ({ ...current, promptText: headPrompt }));
		}
	}, [lineageUrl, headPrompt]);

	// Until the lineage has loaded there is no way to tell an empty prompt from
	// an unread one, and saving on that guess would overwrite a stored revision
	// with nothing.
	const lineageReady =
		!draft.promptUrl.trim() ||
		(lineageQuery.isSuccess && !lineageQuery.isPlaceholderData);
	// Held over the placeholder window on purpose: while a newly typed url loads,
	// the marker keeps its last answer rather than blinking off once per
	// keystroke. `lineageReady` still gates saving on genuinely loaded data.
	const promptDirty = draft.promptText !== headPrompt;
	const content = (value: AgentDraft) =>
		JSON.stringify({
			...value,
			context: value.context.map(({ key: _key, ...slot }) => slot),
		});
	const isDirty = content(draft) !== content(agentToDraft(agent, headPrompt));

	async function persistPrompt(mode: "overwrite" | "new-version") {
		const url = draft.promptUrl.trim();
		if (!url) return;

		const head = revisions[0];
		const resource =
			mode === "overwrite" && head
				? { ...head, prompt: draft.promptText }
				: {
						resourceType: "SDCVoicePrompt" as const,
						url,
						status: "active" as const,
						version: nextVersion(revisions),
						prompt: draft.promptText,
					};

		setSaveError(null);
		try {
			await savePrompt.mutateAsync(resource);
		} catch (error) {
			setSaveError(error);
			toast.error(errorText(error));
			throw error;
		}
		toast.success(
			mode === "overwrite"
				? `Prompt v${head?.version} replaced`
				: `Prompt saved as v${resource.version}`,
		);
	}

	return {
		agent,
		agentQuery,
		draft,
		isDirty,
		lineageReady,
		patch: (values: Partial<AgentDraft>) =>
			setDraft((current) => ({ ...current, ...values })),
		persistAgent: async () => {
			setSaveError(null);
			try {
				return await saveAgent.mutateAsync(
					draftToAgent(draft, providerOf, agent),
				);
			} catch (error) {
				setSaveError(error);
				throw error;
			}
		},
		persistPrompt,
		promptDirty,
		revisions,
		saving: saveAgent.isPending || savePrompt.isPending,
		saveError,
	};
}
