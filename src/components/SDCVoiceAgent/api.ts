import { type AidboxClientR5, useAidboxClient } from "@aidbox-ui/AidboxClient";
import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core/index";
import { boxJson, boxRequest } from "@aidbox-ui/utils/http";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";

const VOICE_AGENTS_QUERY_KEY = ["sdc-voice-agents"] as const;
const VOICE_PROMPTS_QUERY_KEY = ["sdc-voice-prompts"] as const;
const QUESTIONNAIRES_QUERY_KEY = ["sdc-voice-questionnaires"] as const;
const AGENT_RESOURCE_TYPE = "SDCVoiceAgent";
const PROMPT_RESOURCE_TYPE = "SDCVoicePrompt";
const PAGE_SIZE = 200;
const CONTEXT_CANDIDATES = 50;

export type VoiceAgentContextSlot = {
	name: string;
	type: string;
	label?: string;
	/** Client-side only: keeps a row identity while its name is still empty. */
	key?: string;
};

type BoxResource = {
	resourceType: string;
	id?: string;
	meta?: { lastUpdated?: string };
};

export type VoiceAgent = BoxResource & {
	resourceType: "SDCVoiceAgent";
	url?: string;
	name?: string;
	title?: string;
	status: "draft" | "active" | "retired";
	description?: string;
	prompt?: string;
	questionnaire?: string[];
	context?: VoiceAgentContextSlot[];
	// How the editor tells $save-agent who offers each model: the box reads the
	// maker off these, creates the real Devices, and drops them.
	contained?: {
		resourceType: "Device";
		id: string;
		modelNumber?: string;
		manufacturer?: string;
		status: "active";
	}[];
	stt?: { reference: string };
	tts?: { reference: string };
	llm?: { reference: string };
	extractorLlm?: { reference: string };
	maxAttempts?: number;
	retryDelayMinutes?: number;
	maxDurationMinutes?: number;
};

export type QuestionnaireOption = BoxResource & {
	url?: string;
	version?: string;
	title?: string;
	name?: string;
	status?: string;
};

/**
 * How an agent refers to one questionnaire revision.
 *
 * A url alone means "whichever revision is current when the call is placed".
 * Pinning the version is what lets two revisions of the same url be told
 * apart — without it both read as the same choice.
 */
export function questionnaireCanonical({
	url,
	version,
}: Pick<QuestionnaireOption, "url" | "version">) {
	if (!url) return "";
	return version ? `${url}|${version}` : url;
}

export type VoicePrompt = BoxResource & {
	resourceType: "SDCVoicePrompt";
	url?: string;
	title?: string;
	status?: "draft" | "active" | "retired";
	version?: string;
	prompt?: string;
};

function bundleResources<T extends BoxResource>(
	bundle: Bundle,
	resourceType: string,
) {
	return (
		bundle.entry?.flatMap((entry) => {
			const resource = entry.resource as unknown;
			return resource &&
				typeof resource === "object" &&
				"resourceType" in resource &&
				resource.resourceType === resourceType
				? [resource as T]
				: [];
		}) ?? []
	);
}

async function fetchBundle(
	client: AidboxClientR5,
	resourceType: string,
	params: Array<[string, string]> = [],
) {
	// A caller's own `_count` or `_sort` replaces the default, not joins it.
	const defaults: Array<[string, string]> = [
		["_count", String(PAGE_SIZE)],
		["_sort", "-_lastUpdated"],
	];
	return boxJson<Bundle>(
		client,
		{
			method: "GET",
			url: `/fhir/${resourceType}`,
			params: [
				...defaults.filter(([key]) => !params.some(([name]) => name === key)),
				...params,
			],
		},
		`Failed to fetch ${resourceType}`,
	);
}

async function saveResource<T extends BoxResource>(
	client: AidboxClientR5,
	resourceType: string,
	resource: T,
	failureMessage: string,
) {
	const isUpdate = Boolean(resource.id);
	return boxJson<T>(
		client,
		{
			method: isUpdate ? "PUT" : "POST",
			url: isUpdate
				? `/fhir/${resourceType}/${encodeURIComponent(resource.id ?? "")}`
				: `/fhir/${resourceType}`,
			headers: { Prefer: "return=representation" },
			body: JSON.stringify(resource),
		},
		failureMessage,
	);
}

async function fetchAgent(client: AidboxClientR5, id: string) {
	// through the box rather than plain FHIR: models are stored as Device
	// references and the editor works in names
	return boxJson<VoiceAgent>(
		client,
		{ method: "GET", url: `/sdc/voice/agent/${encodeURIComponent(id)}` },
		"Failed to fetch agent",
	);
}

async function deleteAgent(client: AidboxClientR5, id: string) {
	await boxRequest(
		client,
		{
			method: "DELETE",
			url: `/fhir/${AGENT_RESOURCE_TYPE}/${encodeURIComponent(id)}`,
		},
		"Failed to delete agent",
	);
}

/**
 * Every revision of one prompt lineage, newest version first. The agent points
 * at the lineage url, and a call resolves the latest active revision — so the
 * head of this list is what a call would actually say.
 */
async function fetchPromptLineage(client: AidboxClientR5, url: string) {
	const revisions = bundleResources<VoicePrompt>(
		await fetchBundle(client, PROMPT_RESOURCE_TYPE, [["url", url]]),
		PROMPT_RESOURCE_TYPE,
	);

	return revisions.sort((left, right) =>
		(right.version ?? "").localeCompare(left.version ?? "", undefined, {
			numeric: true,
		}),
	);
}

/**
 * One entry per prompt lineage, newest revision first. The agent points at a
 * url, so the picker lists urls, not individual revisions.
 */
async function fetchPromptLineages(client: AidboxClientR5) {
	const revisions = bundleResources<VoicePrompt>(
		await fetchBundle(client, PROMPT_RESOURCE_TYPE),
		PROMPT_RESOURCE_TYPE,
	);

	const byUrl = new Map<string, VoicePrompt>();
	for (const revision of revisions) {
		const url = revision.url;
		if (!url) continue;
		const seen = byUrl.get(url);
		const newer =
			!seen ||
			(revision.version ?? "").localeCompare(seen.version ?? "", undefined, {
				numeric: true,
			}) > 0;
		if (newer) byUrl.set(url, revision);
	}

	return [...byUrl.values()];
}

async function fetchQuestionnaires(client: AidboxClientR5) {
	// ponytail: draft questionnaires are listed too, so a work-in-progress form
	// can be tried out. Restore ["status", "active"] once drafts stop being the
	// only thing to test against.
	const bundle = await fetchBundle(client, "Questionnaire");

	// An agent refers to a questionnaire by canonical url. One without a url
	// cannot be referred to at all, so it is not an option to offer.
	return bundleResources<QuestionnaireOption>(bundle, "Questionnaire").filter(
		(questionnaire) => Boolean(questionnaire.url),
	);
}

export function useVoiceAgent(id?: string) {
	const client = useAidboxClient();
	return useQuery({
		enabled: Boolean(id),
		queryFn: () => fetchAgent(client, id ?? ""),
		queryKey: [...VOICE_AGENTS_QUERY_KEY, "detail", id],
	});
}

export function usePromptLineage(url?: string) {
	const client = useAidboxClient();
	return useQuery({
		enabled: Boolean(url),
		// Every keystroke in the url field is a new query key. Without this each
		// one would drop to pending and the editor's unsaved-changes marker would
		// blink once per character; holding the previous lineage keeps it steady.
		placeholderData: keepPreviousData,
		queryFn: () => fetchPromptLineage(client, url ?? ""),
		queryKey: [...VOICE_PROMPTS_QUERY_KEY, url],
	});
}

export function usePromptLineages() {
	const client = useAidboxClient();
	return useQuery({
		queryFn: () => fetchPromptLineages(client),
		queryKey: [...VOICE_PROMPTS_QUERY_KEY, "lineages"],
	});
}

/**
 * Resource types the box actually knows about. A slot typed by hand is a typo
 * away from an empty picker and a refused call, so the editor picks from here.
 */
async function fetchResourceTypes(client: AidboxClientR5) {
	const types = await boxJson<Array<{ type?: string }>>(
		client,
		{ method: "GET", url: "/$sdc-resource-types" },
		"Failed to fetch resource types",
	);
	return types.map((entry) => entry.type).filter(Boolean) as string[];
}

export function useResourceTypes() {
	const client = useAidboxClient();
	return useQuery({
		queryFn: () => fetchResourceTypes(client),
		queryKey: ["sdc-resource-types"],
		staleTime: Number.POSITIVE_INFINITY,
	});
}

/** `name` is what gets saved and sent; `label` is what a person reads. */
export type VoiceModel = { provider: string; name: string; label?: string };

type VoiceCatalogue = {
	kind: string;
	default: string;
	models: VoiceModel[];
	providers?: Array<{ provider: string; configured: boolean }>;
};

export function mergeVoiceCatalogues(
	catalogues: VoiceCatalogue[],
	tests: Array<{ provider: string }>,
) {
	const overridden = new Set(tests.map(({ provider }) => provider));
	const models = new Map<string, VoiceModel>();

	catalogues.forEach((catalogue, index) => {
		const requestedProvider = tests[index - 1]?.provider;
		for (const model of catalogue.models) {
			if (index === 0 && overridden.has(model.provider)) continue;
			const provider = requestedProvider ?? model.provider;
			models.set(`${provider}:${model.name}`, { ...model, provider });
		}
	});

	return [...models.values()];
}

export function mergeVoiceProviderStatuses(
	catalogues: VoiceCatalogue[],
	tests: Array<{ provider: string }>,
) {
	const overridden = new Set(tests.map(({ provider }) => provider));
	const providers = new Map<string, boolean>();

	catalogues.forEach((catalogue, index) => {
		for (const status of catalogue.providers ?? []) {
			if (index === 0 && overridden.has(status.provider)) continue;
			providers.set(status.provider, status.configured);
		}
	});

	return [...providers].map(([provider, configured]) => ({
		provider,
		configured,
	}));
}

/**
 * Models of one kind the deployment can reach. `enabled` holds the request
 * back until the field is actually opened: three of these live on the page and
 * most edits never touch them.
 */
/** What a finished conversation left behind, as the lab shows it. */
export type CallResults = {
	task: string;
	status: string;
	rehearsal?: boolean;
	transcript?: string;
	transcriptRef?: string;
	/** The resources as stored, so the lab can show them without a console trip. */
	taskResource?: unknown;
	transcriptResource?: unknown;
	provenanceResource?: unknown;
	extractedResources?: unknown[];
	provenance?: string;
	/** What the answers turned into downstream: Observations and the like. */
	extracted?: string[];
	/**
	 * Why the answers are missing, when they are. A model that cannot do
	 * structured output produces no answers, and so does a person who said
	 * nothing — only one of those is worth re-running.
	 */
	extractionErrors?: string[];
	responses: {
		reference: string;
		resource?: unknown;
		questionnaire?: string;
		status: string;
		answers: {
			text?: string;
			answer?: string;
			/** Whether the person stated it, it was read from context, or too little was said. */
			status?: "answered" | "inferred" | "missing";
			/** The person's own words the answer was read from. */
			evidence?: string;
			/** Which of their turns those words were said in. */
			sourceTurn?: string;
			/** 0-1, how sure the model is of the mapping. */
			confidence?: number;
		}[];
	}[];
};

/**
 * The resources a call produced, read back from its Task.
 *
 * Extraction runs after the socket closes, so nothing is ready the moment a
 * call ends: this polls until the answers appear, then stops. `enabled` is what
 * starts it — the panel turns it on once the conversation is over.
 */
const CALL_RESULTS_POLL_LIMIT = 20;

export function shouldPollCallResults(
	results: Pick<CallResults, "responses" | "extractionErrors"> | undefined,
	successfulPolls: number,
) {
	return (
		successfulPolls < CALL_RESULTS_POLL_LIMIT &&
		!results?.responses?.length &&
		!results?.extractionErrors?.length
	);
}

export function useCallResults(callId: string | undefined, enabled: boolean) {
	const client = useAidboxClient();
	return useQuery({
		enabled: enabled && Boolean(callId),
		queryKey: ["sdc-voice-run", callId],
		// a model reading a transcript takes a few seconds; give up after ~40s so a
		// failed extraction does not poll for the life of the tab. A recorded
		// refusal is an answer too — there is nothing further to wait for.
		refetchInterval: (query) =>
			shouldPollCallResults(query.state.data, query.state.dataUpdateCount)
				? 2000
				: false,
		retry: 20,
		retryDelay: 2000,
		queryFn: () =>
			boxJson<CallResults>(
				client,
				{ method: "GET", url: `/sdc/voice/run/${callId}` },
				"Failed to read the call results",
			),
	});
}

export function useVoiceModels(
	kind: "llm" | "stt" | "tts",
	enabled: boolean,
	tests: Array<{ provider: string; apiKey?: string; baseUrl?: string }> = [],
) {
	const client = useAidboxClient();
	return useQuery({
		enabled,
		// Test credentials bypass the box cache. Their values stay out of the
		// query key and React Query devtools; saving settings invalidates these.
		staleTime: Number.POSITIVE_INFINITY,
		queryKey: [
			"sdc-voice-models",
			kind,
			tests.map(({ provider, baseUrl }) => [provider, baseUrl]),
		],
		queryFn: async () => {
			const url = `/sdc/voice/models/${kind}`;
			const failureMessage = `Failed to fetch ${kind} models`;
			const catalogues = await Promise.all([
				boxJson<VoiceCatalogue>(client, { method: "GET", url }, failureMessage),
				...tests.map((test) =>
					boxJson<VoiceCatalogue>(
						client,
						{
							method: "POST",
							url,
							body: JSON.stringify({
								provider: test.provider,
								apiKey: test.apiKey,
								baseUrl: test.baseUrl,
							}),
						},
						failureMessage,
					),
				),
			]);

			return {
				kind,
				default: catalogues[0]?.default ?? "",
				models: mergeVoiceCatalogues(catalogues, tests),
				providers: mergeVoiceProviderStatuses(catalogues, tests),
			};
		},
	});
}

export function useVoiceQuestionnaires() {
	const client = useAidboxClient();
	return useQuery({
		queryFn: () => fetchQuestionnaires(client),
		queryKey: QUESTIONNAIRES_QUERY_KEY,
	});
}

/**
 * Candidates for one context slot. The agent declares the resource type, so
 * the picker only has to list what that type holds.
 */
export function useContextCandidates(resourceType?: string) {
	const client = useAidboxClient();
	return useQuery({
		enabled: Boolean(resourceType),
		queryFn: async () => {
			const bundle = await fetchBundle(client, resourceType ?? "", [
				["_count", String(CONTEXT_CANDIDATES)],
			]);
			return bundleResources<BoxResource & Record<string, unknown>>(
				bundle,
				resourceType ?? "",
			);
		},
		queryKey: ["sdc-voice-context", resourceType],
	});
}

export function useSaveVoiceAgent() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		// $save-agent rather than a plain PUT: the editor names models, and the
		// box turns those names into Devices on the way in
		mutationFn: (agent: VoiceAgent) =>
			boxJson<VoiceAgent>(
				client,
				{
					method: "POST",
					url: "/sdc/voice/$save-agent",
					body: JSON.stringify(agent),
				},
				"Failed to save agent",
			),
		onSuccess: async (savedAgent) => {
			queryClient.setQueryData(
				[...VOICE_AGENTS_QUERY_KEY, "detail", savedAgent.id],
				savedAgent,
			);

			await queryClient.invalidateQueries({ queryKey: VOICE_AGENTS_QUERY_KEY });
		},
	});
}

/** One thing a review says is wrong with a prompt. */
export type PromptFinding = {
	severity: "high" | "medium" | "low";
	title: string;
	detail: string;
};

export type PromptReview = {
	findings: PromptFinding[];
	/** The prompt as the model would write it. */
	improved: string;
	/** Which model did the reading, so the panel can say so. */
	model?: string;
};

/**
 * Reads the prompt currently on screen and says what is missing. Sends the text
 * rather than the agent id: the point is to review before saving. The agent id
 * only rides along so the model can see which questionnaires the prompt is for
 * and not report their questions as gaps.
 */
export function useReviewPrompt() {
	const client = useAidboxClient();
	return useMutation({
		mutationFn: async (input: {
			prompt: string;
			agent?: string;
			credentials?: { llm?: { apiKey?: string; baseUrl?: string } };
		}) =>
			boxJson<PromptReview>(
				client,
				{
					method: "POST",
					url: "/sdc/voice/$review-prompt",
					body: JSON.stringify(input),
				},
				"Failed to review the prompt",
			),
	});
}

export function useSaveVoicePrompt() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (prompt: VoicePrompt) =>
			saveResource(
				client,
				PROMPT_RESOURCE_TYPE,
				prompt,
				"Failed to save prompt",
			),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: VOICE_PROMPTS_QUERY_KEY,
			});
		},
	});
}

export function useDeleteVoiceAgent() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => deleteAgent(client, id),
		onSuccess: async (_, id) => {
			queryClient.removeQueries({
				queryKey: [...VOICE_AGENTS_QUERY_KEY, "detail", id],
			});

			await queryClient.invalidateQueries({ queryKey: VOICE_AGENTS_QUERY_KEY });
		},
	});
}

/**
 * The next version string in a lineage. Versions are plain integers here: the
 * call path sorts them and takes the last active one.
 */
export function nextVersion(revisions: VoicePrompt[]) {
	const highest = revisions.reduce((max, revision) => {
		const parsed = Number.parseInt(revision.version ?? "", 10);
		return Number.isFinite(parsed) && parsed > max ? parsed : max;
	}, 0);

	return String(highest + 1);
}
