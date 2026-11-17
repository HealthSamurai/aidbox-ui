import { type AidboxClientR5, useAidboxClient } from "@aidbox-ui/AidboxClient";
import type {
	Bundle,
	Encounter,
	OperationOutcome,
	Patient,
	PlanDefinition,
	Questionnaire,
	QuestionnaireResponse,
	Resource,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { boxJson, boxRequest, withFallback } from "@aidbox-ui/utils/http";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QuestionnaireCatalog } from "../responses/response-labels";
import { COMPLETED_RESPONSE_STATUSES } from "../utils";
import { buildShareModePatch, type ShareMode } from "./sharing";

/** `client.searchType` through `client.request`, returning the raw bundle. */
function searchFhirType(
	client: AidboxClientR5,
	opts: { query: Array<[string, string]>; type: string },
) {
	return client.request<Bundle>({
		method: "GET",
		params: opts.query,
		url: `/fhir/${opts.type}`,
	});
}

/** `client.read` through `client.request`, returning the raw resource. */
function readFhirResource<T>(
	client: AidboxClientR5,
	opts: { id: string; type: string },
) {
	return client.request<T>({
		method: "GET",
		url: `/fhir/${opts.type}/${encodeURIComponent(opts.id)}`,
	});
}

export type Form = Questionnaire | PlanDefinition;

function bundleResources<T extends Resource>(
	bundle: Bundle,
	resourceType: T["resourceType"] | string,
) {
	return (
		bundle.entry?.flatMap((entry) => {
			const resource = entry.resource as T | undefined;
			return resource?.resourceType === resourceType ? [resource] : [];
		}) ?? []
	);
}

export type QuestionnaireResponseFilters = {
	planDefinition?: string;
	/**
	 * Bounds of the completion-date filter, already resolved from the browser's
	 * local days to UTC instants. Searched as `authored`.
	 */
	completedFrom?: string;
	completedTo?: string;
	q?: string;
	status?: string;
	subject?: string;
};

export type SdcWorkflowStep = {
	name?: string;
	outcome?: {
		"delivery-status"?: string;
		"email-status"?: string;
		error?: { message?: string };
		reason?: string;
		"response-id"?: string;
		"request-group-id"?: string;
		"scheduled-for"?: string;
	} | null;
	task?: {
		"completed-at"?: string | null;
		"scheduled-at"?: string | null;
		status?: string;
	};
};

// The `send-form-to-patient` workflow keeps the whole $send payload in its
// input — see `prepare-start-input` in
// `src/box/sdc/fhir/workflow/send_form_to_patient.clj`.
export type SdcWorkflow = {
	"operation-id"?: string;
	input?: {
		"created-at"?: string;
		"deadline-days"?: number;
		email?: string;
		"email-subject"?: string;
		"follow-up-delay-days"?: number;
		"follow-up-enabled"?: boolean;
		"follow-up-time"?: string;
		provider?: string;
		"response-id"?: string;
		"request-group-id"?: string;
		"send-at"?: string;
	};
	status?: string;
	steps?: SdcWorkflowStep[];
};

type QuestionnaireUsageResponse = {
	questionnaires?: Questionnaire[];
};

export type QuestionnaireDeleteCheck = {
	componentUsage: Questionnaire[];
	qrUsage: QuestionnaireResponse[];
	requiresConfirmation: boolean;
};

type QuestionnaireWithExtensions = Questionnaire & {
	extension?: Array<{
		url?: string;
		valueCode?: string;
		valueReference?: {
			id?: string;
			reference?: string;
			resourceType?: string;
		};
	}>;
};

export type ResponseFilterOption = {
	label: string;
	value: string;
};

export type AidboxReferenceResource = {
	id: string;
	resourceType: string;
};

/** A resource of this box passed to a `$populatelink` / `$send` request. */
export type ContextReference = AidboxReferenceResource;

export type AidboxLaunchContext = Record<string, ContextReference>;

export type AidboxSearchResource = Resource & {
	description?: string;
	id?: string;
	meta?: {
		lastUpdated?: string;
	};
	name?:
		| string
		| Array<{
				family?: string;
				given?: string[];
				text?: string;
		  }>;
	resourceType: string;
	subject?: {
		display?: string;
		reference?: string;
	};
	title?: string;
};

type SharedLinkParams = {
	configId?: string;
	encounter?: ContextReference;
	launchContext?: AidboxLaunchContext;
	subject?: ContextReference;
	themeId?: string;
	allowAmend?: boolean;
	allowRepopulate?: boolean;
	readOnly?: boolean;
	redirectOnSubmit?: string;
	redirectOnSave?: string;
	redirectOnTimeout?: string;
	sessionTimeout?: number;
	warningTimeout?: number;
};

type SendFormParams = SharedLinkParams & {
	clinicianEmail?: string;
	deadlineDays: number;
	email: string;
	emailMessage?: string;
	emailProvider: string;
	emailSubject?: string;
	followUpDays: number;
	followUpEnabled: boolean;
	followUpMessage?: string;
	followUpTime: string;
	form: AidboxReferenceResource;
	sendAt?: string;
};

type GenerateFormLinkParams = SharedLinkParams & {
	form: AidboxReferenceResource;
};

const OPENEHR_TEMPLATE_SOURCE_URL =
	"http://aidbox.io/sdc/openehr-template-source";

function buildQuestionnaireResponseUsageQuery(
	questionnaire: Pick<Questionnaire, "url" | "version">,
) {
	if (!questionnaire.url) {
		return undefined;
	}

	const references = [
		questionnaire.version
			? `${questionnaire.url}|${questionnaire.version}`
			: questionnaire.url,
		questionnaire.version
			? `${questionnaire.url}|${questionnaire.version}-assembled`
			: undefined,
	].filter((value): value is string => Boolean(value));

	const params = new URLSearchParams();
	params.set("questionnaire", references.join(","));

	return params;
}

/** `Patient/pt-1`, as opposed to a subject that is only a display name. */
const FHIR_REFERENCE_PATTERN = /^[A-Za-z]+\/[A-Za-z0-9\-.]{1,64}$/;

/**
 * A response's subject is either a reference to a patient or a bare display
 * name, and the two are searched by different parameters — `subject` matches the
 * reference exactly, `subject:text` the display. `_filter` can express neither:
 * it takes search parameter *names*, so `subject.reference eq …` is rejected
 * outright with "Invalid _filter syntax", and `subject eq …` is accepted but
 * matches nothing.
 *
 * `subject:text` is not an exact match, and nothing available today is: the box
 * splits the value on spaces and requires every word as a case-insensitive
 * substring of the reference's fields (`text-expr` in
 * `src/proto/search/impl/expr/knife/reference_knife.clj`), so picking
 * "John Smith" also lists "John Smithson". The values here come from subjects
 * that already exist, which keeps it rare rather than impossible. `:exact` is
 * not supported for references, so closing the gap needs a search parameter from
 * the box.
 */
function subjectSearchParam(subject: string) {
	return FHIR_REFERENCE_PATTERN.test(subject) || /^https?:\/\//.test(subject)
		? "subject"
		: "subject:text";
}

export function buildQuestionnaireResponseQuery(
	filters: QuestionnaireResponseFilters,
	page: number,
	pageSize: number,
) {
	const query: Array<[string, string]> = [
		["_count", String(pageSize)],
		["_page", String(page)],
		["_sort", "-_lastUpdated"],
	];

	if (filters.planDefinition)
		query.push(["sdc-plan-definition", filters.planDefinition]);

	if (filters.q) {
		query.push(["_ilike", filters.q]);
	}

	if (filters.status) {
		query.push(["status", filters.status]);
	}

	// `authored` is the last time a response was written, not the time it was
	// completed: an in-progress response has it rewritten on every partial save.
	// So a date filter carries the statuses that give it its meaning, or "Today"
	// would also list forms someone is still halfway through filling in.
	//
	// Repeated search parameters are combined with AND, so this narrows an already
	// chosen status rather than replacing it — and a contradictory pair (Status
	// "in-progress" with a completion date) correctly comes back empty.
	if (filters.completedFrom || filters.completedTo) {
		query.push(["status", COMPLETED_RESPONSE_STATUSES.join(",")]);
	}

	if (filters.completedFrom) {
		query.push(["authored", `ge${filters.completedFrom}`]);
	}

	if (filters.completedTo) {
		query.push(["authored", `le${filters.completedTo}`]);
	}

	if (filters.subject) {
		query.push([subjectSearchParam(filters.subject), filters.subject]);
	}

	return query;
}

function getWorkflowResponseId(
	workflow: SdcWorkflow,
	key: "response-id" | "request-group-id",
) {
	return workflow.steps?.[0]?.outcome?.[key] ?? workflow.input?.[key];
}

function latestWorkflowsByResponseId(
	workflows: SdcWorkflow[],
	key: "response-id" | "request-group-id",
) {
	return workflows.reduce<Record<string, SdcWorkflow>>((acc, workflow) => {
		const responseId = getWorkflowResponseId(workflow, key);

		if (responseId && !acc[responseId]) {
			acc[responseId] = workflow;
		}

		return acc;
	}, {});
}

function sanitizeImportedQuestionnaire(questionnaire: Questionnaire) {
	const { id: _id, meta: _meta, ...rest } = questionnaire;

	return rest as Questionnaire;
}

async function searchAidboxResources<T extends Resource>(
	client: AidboxClientR5,
	type: string,
	query: URLSearchParams,
	// Not forwarded yet: AidboxClient takes no AbortSignal (see `boxRequest`).
	_signal?: AbortSignal,
) {
	const bundle = await boxJson<Bundle>(
		client,
		{ method: "GET", url: `/fhir/${type}`, params: [...query] },
		`Failed to fetch ${type}`,
	);

	return bundleResources<T>(bundle, type);
}

export async function searchAidboxReferenceResources(
	client: AidboxClientR5,
	type: string,
	query: string,
	signal?: AbortSignal,
) {
	const params = new URLSearchParams({
		_count: "20",
		_sort: "-_lastUpdated",
	});

	if (query.trim()) {
		params.set("_ilike", query.trim());
	}

	return searchAidboxResources<AidboxSearchResource>(
		client,
		type,
		params,
		signal,
	);
}

function searchAidboxParams(
	elements: string,
	query: string,
	extra: Record<string, string> = {},
) {
	const params = new URLSearchParams({
		_count: "20",
		_elements: elements,
		...extra,
	});

	if (query.trim()) {
		params.set("_ilike", query.trim());
	}

	return params;
}

function localTimeToUtc(timeValue: string) {
	if (!timeValue.trim()) {
		return timeValue;
	}

	const today = new Date();
	const datePart = today.toISOString().slice(0, 10);
	const normalizedTime = timeValue.length > 5 ? timeValue : `${timeValue}:00`;
	const localDate = new Date(`${datePart}T${normalizedTime}`);

	if (Number.isNaN(localDate.getTime())) {
		return timeValue;
	}

	return localDate.toISOString().slice(11, 16);
}

function mergedLaunchContext(
	launchContext?: AidboxLaunchContext,
	encounter?: ContextReference,
) {
	return {
		...(launchContext ?? {}),
		...(encounter ? { encounter } : {}),
	} satisfies AidboxLaunchContext;
}

function launchContextParameters(launchContext?: AidboxLaunchContext) {
	return Object.entries(launchContext ?? {}).flatMap(([name, resource]) =>
		resource
			? [
					{
						name: "context",
						part: [
							{
								name: "name",
								valueString: name,
							},
							{
								name: "content",
								valueReference: resource,
							},
						],
					},
				]
			: [],
	);
}

function sharedLinkParameters(params: SharedLinkParams) {
	return [
		...(params.subject
			? [
					{
						name: "subject",
						valueReference: params.subject,
					},
				]
			: []),
		...launchContextParameters(
			mergedLaunchContext(params.launchContext, params.encounter),
		),
		...(params.themeId
			? [
					{
						name: "theme",
						valueString: params.themeId,
					},
				]
			: []),
		...(params.configId
			? [
					{
						name: "config",
						valueString: params.configId,
					},
				]
			: []),
		...(typeof params.allowAmend === "boolean"
			? [
					{
						name: "allow-amend",
						valueBoolean: params.allowAmend,
					},
				]
			: []),
		...(typeof params.allowRepopulate === "boolean"
			? [
					{
						name: "allow-repopulate",
						valueBoolean: params.allowRepopulate,
					},
				]
			: []),
		...(typeof params.readOnly === "boolean"
			? [
					{
						name: "read-only",
						valueBoolean: params.readOnly,
					},
				]
			: []),
		...(params.redirectOnSubmit?.trim()
			? [
					{
						name: "redirect-on-submit",
						valueString: params.redirectOnSubmit.trim(),
					},
				]
			: []),
		...(params.redirectOnSave?.trim()
			? [
					{
						name: "redirect-on-save",
						valueString: params.redirectOnSave.trim(),
					},
				]
			: []),
		...(params.redirectOnTimeout?.trim()
			? [
					{
						name: "redirect-on-timeout",
						valueString: params.redirectOnTimeout.trim(),
					},
				]
			: []),
		...(typeof params.sessionTimeout === "number"
			? [
					{
						name: "session-timeout",
						valueInteger: params.sessionTimeout * 60 * 1000,
					},
				]
			: []),
		...(typeof params.warningTimeout === "number"
			? [
					{
						name: "warning-timeout",
						valueInteger: params.warningTimeout * 60 * 1000,
					},
				]
			: []),
	];
}

function sendFormBody(params: SendFormParams) {
	return {
		parameter: [
			{
				name: "provider",
				valueString: params.emailProvider,
			},
			...(params.form.resourceType === "PlanDefinition"
				? []
				: [{ name: "questionnaire", valueReference: params.form }]),
			{
				name: "email",
				valueString: params.email,
			},
			{
				name: "deadline-days",
				valueInteger: params.deadlineDays,
			},
			...(params.followUpEnabled
				? [
						{
							name: "follow-up-enabled",
							valueBoolean: true,
						},
						{
							name: "follow-up-delay-days",
							valueInteger: params.followUpDays,
						},
						{
							name: "follow-up-time",
							valueString: localTimeToUtc(params.followUpTime),
						},
					]
				: []),
			...(params.followUpEnabled && params.followUpMessage?.trim()
				? [
						{
							name: "follow-up-message",
							valueString: params.followUpMessage.trim(),
						},
					]
				: []),
			...(params.emailSubject?.trim()
				? [
						{
							name: "email-subject",
							valueString: params.emailSubject.trim(),
						},
					]
				: []),
			...(params.emailMessage?.trim()
				? [
						{
							name: "email-message",
							valueString: params.emailMessage.trim(),
						},
					]
				: []),
			...(params.sendAt
				? [
						{
							name: "send-at",
							valueString: params.sendAt,
						},
					]
				: []),
			...(params.clinicianEmail?.trim()
				? [
						{
							name: "clinician-email",
							valueString: params.clinicianEmail.trim(),
						},
					]
				: []),
			...sharedLinkParameters(params),
		],
		resourceType: "Parameters",
	};
}

function generateFormLinkBody(params: GenerateFormLinkParams) {
	const isPlanDefinition = params.form.resourceType === "PlanDefinition";
	return {
		parameter: [
			...(!isPlanDefinition
				? [{ name: "questionnaireRef", valueReference: params.form }]
				: []),
			...(params.subject
				? [
						{
							name: "local",
							valueBoolean: true,
						},
					]
				: []),
			...(isPlanDefinition && params.encounter
				? [{ name: "encounter", valueReference: params.encounter }]
				: []),
			...sharedLinkParameters(
				isPlanDefinition
					? { ...params, allowRepopulate: undefined, readOnly: undefined }
					: params,
			),
		],
		resourceType: "Parameters",
	};
}

export function useQuestionnaire(questionnaireId: string) {
	const client = useAidboxClient();

	return useQuery({
		queryKey: ["questionnaire", questionnaireId],
		enabled: Boolean(questionnaireId),
		queryFn: async () => {
			const result = await readFhirResource<Questionnaire>(client, {
				type: "Questionnaire",
				id: questionnaireId,
			});

			if (result.isOk()) {
				return result.value.resource;
			}

			throw new Error("Failed to fetch questionnaire");
		},
		refetchOnWindowFocus: false,
	});
}

/** Questionnaires keyed by canonical URL and by `Questionnaire/<id>`, to label responses. */
export function useQuestionnairesByReference() {
	const client = useAidboxClient();

	return useQuery({
		queryKey: ["questionnaires", "catalog"],
		queryFn: async () => {
			const result = await searchFhirType(client, {
				type: "Questionnaire",
				query: [
					["_count", "1000"],
					["_elements", "id,title,name,url,version,extension"],
				],
			});

			if (!result.isOk()) {
				throw new Error("Failed to fetch questionnaire catalog");
			}

			const questionnaires = bundleResources<Questionnaire>(
				result.value.resource as Bundle,
				"Questionnaire",
			);
			const catalog: QuestionnaireCatalog = {};

			for (const questionnaire of questionnaires) {
				if (questionnaire.url) {
					catalog[questionnaire.url] = questionnaire;
				}

				if (questionnaire.id) {
					catalog[`Questionnaire/${questionnaire.id}`] = questionnaire;
				}
			}

			return catalog;
		},
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
	});
}

export function useQuestionnaireResponseFilterOptions() {
	const client = useAidboxClient();

	return useQuery({
		queryKey: ["questionnaireResponses", "filter-options"],
		queryFn: async () => {
			const result = await searchFhirType(client, {
				type: "QuestionnaireResponse",
				query: [
					["_count", "1000"],
					["_elements", "status,subject"],
				],
			});

			if (!result.isOk()) {
				throw new Error(
					"Failed to fetch questionnaire response filter options",
				);
			}

			const questionnaireResponses = bundleResources<QuestionnaireResponse>(
				result.value.resource as Bundle,
				"QuestionnaireResponse",
			);
			const subjectOptionsMap = new Map<string, string>();

			for (const response of questionnaireResponses) {
				const subjectValue =
					response.subject?.reference ?? response.subject?.display;
				const subjectLabel =
					response.subject?.display ?? response.subject?.reference;

				if (subjectValue && subjectLabel) {
					subjectOptionsMap.set(subjectValue, subjectLabel);
				}
			}

			return {
				statusOptions: Array.from(
					new Set(
						questionnaireResponses
							.map((response) => response.status)
							.filter(
								(
									value,
								): value is NonNullable<QuestionnaireResponse["status"]> =>
									value !== undefined,
							),
					),
				).sort((left, right) => left.localeCompare(right)),
				subjectOptions: Array.from(subjectOptionsMap.entries())
					.map(([value, label]) => ({ label, value }))
					.sort((left, right) => left.label.localeCompare(right.label)),
			} satisfies {
				statusOptions: Array<NonNullable<QuestionnaireResponse["status"]>>;
				subjectOptions: ResponseFilterOption[];
			};
		},
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
	});
}

export function formatPatientLabel(patient: Pick<Patient, "id" | "name">) {
	const firstName = patient.name?.[0];
	const composedName = [firstName?.given?.join(" "), firstName?.family]
		.filter(Boolean)
		.join(" ")
		.trim();

	return firstName?.text ?? (composedName || patient.id || "Patient");
}

export function getPatientEmail(patient?: Pick<Patient, "telecom"> | null) {
	return (
		patient?.telecom?.find((contact) => contact.system === "email")?.value ?? ""
	);
}

export function formatEncounterLabel(
	encounter: Pick<Encounter, "id" | "subject">,
) {
	return (
		encounter.id ??
		encounter.subject?.display ??
		encounter.subject?.reference ??
		"Encounter"
	);
}

export function formatAidboxReferenceLabel(resource: AidboxSearchResource) {
	if (resource.resourceType === "Patient") {
		return formatPatientLabel(resource as Pick<Patient, "id" | "name">);
	}

	if (resource.resourceType === "Encounter") {
		return formatEncounterLabel(resource as Pick<Encounter, "id" | "subject">);
	}

	if (typeof resource.name === "string" && resource.name.trim()) {
		return resource.name.trim();
	}

	if (Array.isArray(resource.name)) {
		const firstName = resource.name[0];
		const composedName = [firstName?.given?.join(" "), firstName?.family]
			.filter(Boolean)
			.join(" ")
			.trim();

		if (firstName?.text?.trim()) {
			return firstName.text.trim();
		}

		if (composedName) {
			return composedName;
		}
	}

	if (resource.title?.trim()) {
		return resource.title.trim();
	}

	if (resource.subject?.display?.trim()) {
		return resource.subject.display.trim();
	}

	if (resource.subject?.reference?.trim()) {
		return resource.subject.reference.trim();
	}

	return resource.id ?? resource.resourceType;
}

export function usePatients(query: string, enabled = true) {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["send-form", "patients", query],
		queryFn: ({ signal }) =>
			searchAidboxResources<Patient>(
				client,
				"Patient",
				searchAidboxParams("id,name,telecom,birthDate", query, {
					_sort: "-_lastUpdated",
				}),
				signal,
			),
		enabled,
		placeholderData: (previousData) => previousData,
		refetchOnWindowFocus: false,
		staleTime: 60 * 1000,
	});
}

export function useEncounters(query: string, enabled = true) {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["send-form", "encounters", query],
		queryFn: ({ signal }) =>
			searchAidboxResources<Encounter>(
				client,
				"Encounter",
				searchAidboxParams("id,subject,meta", query, {
					_sort: "-_lastUpdated",
				}),
				signal,
			),
		enabled,
		placeholderData: (previousData) => previousData,
		refetchOnWindowFocus: false,
		staleTime: 60 * 1000,
	});
}

export function useSendForm() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (params: SendFormParams) => {
			const response = await boxRequest(
				client,
				{
					method: "POST",
					url:
						params.form.resourceType === "PlanDefinition"
							? `/fhir/PlanDefinition/${encodeURIComponent(params.form.id)}/$sdc-send`
							: "/fhir/Questionnaire/$send",
					body: JSON.stringify(sendFormBody(params)),
				},
				"Failed to start form-sending process",
			);

			const rawBody = await response.text();

			if (!rawBody) {
				return null;
			}

			try {
				return JSON.parse(rawBody);
			} catch {
				return rawBody;
			}
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["questionnaireResponses"],
			});
			void queryClient.invalidateQueries({
				queryKey: ["questionnaireResponseWorkflows"],
			});
		},
	});
}

export function useGenerateFormLink() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (params: GenerateFormLinkParams) => {
			const body = await boxJson<{
				parameter?: Array<{ name?: string; valueUri?: string }>;
			}>(
				client,
				{
					method: "POST",
					url:
						params.form.resourceType === "PlanDefinition"
							? `/fhir/PlanDefinition/${encodeURIComponent(params.form.id)}/$sdc-start-link`
							: `/fhir/Questionnaire/${encodeURIComponent(params.form.id)}/$populatelink`,
					body: JSON.stringify(generateFormLinkBody(params)),
				},
				"Failed to generate form link",
			);
			const link = body.parameter?.find(
				(parameter) => parameter.name === "link",
			)?.valueUri;

			if (!link) {
				throw new Error("Generated link response is missing link");
			}

			return link;
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["questionnaireResponses"],
			});
		},
	});
}

export function useDuplicateQuestionnaire() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (questionnaireId: string) => {
			const result = await client.request({
				method: "POST",
				url: `/fhir/Questionnaire/${questionnaireId}/$duplicate`,
			});

			if (result.isOk()) {
				return result.value.resource;
			}

			throw new Error("Failed to duplicate questionnaire");
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["questionnaires"] });
		},
	});
}

/**
 * Shares a form with the child organizations (`shared`), with every organization
 * (`system-shared`), or takes the sharing back (`null`).
 *
 * Patches the Questionnaire or PlanDefinition in the current scope: the box
 * derives who may change the sharing from the request path.
 */
export function useShareForm() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			mode,
			form,
		}: {
			mode: ShareMode | null;
			form: Form;
		}) => {
			if (!form.id) {
				throw new Error("Form id is required");
			}

			await boxRequest(
				client,
				{
					method: "PATCH",
					url: `/sdc/${form.resourceType}/${encodeURIComponent(form.id)}`,
					body: JSON.stringify(buildShareModePatch(form, mode)),
				},
				"Failed to change form sharing",
			);

			return form;
		},
		onSuccess: (form) => {
			void queryClient.invalidateQueries({ queryKey: ["questionnaires"] });
			if (form.resourceType === "PlanDefinition") {
				void queryClient.invalidateQueries({ queryKey: ["planDefinitions"] });
				void queryClient.invalidateQueries({
					queryKey: ["planDefinition", form.id],
				});
			}
		},
	});
}

export function useQuestionnaireDeleteCheck() {
	const client = useAidboxClient();
	return useMutation({
		mutationFn: async (
			questionnaire: Questionnaire,
		): Promise<QuestionnaireDeleteCheck> => {
			if (!questionnaire.id) {
				throw new Error("Questionnaire id is required");
			}

			// Usage only decides whether to ask for confirmation; a refused
			// lookup counts as none.
			const componentUsage =
				(
					await withFallback(
						boxJson<QuestionnaireUsageResponse>(
							client,
							{
								method: "GET",
								url: `/Questionnaire/${encodeURIComponent(questionnaire.id)}/$usage`,
							},
							"Failed to check questionnaire usage",
						),
						{},
					)
				).questionnaires ?? [];

			const questionnaireResponseUsageQuery =
				buildQuestionnaireResponseUsageQuery(questionnaire);
			let qrUsage: QuestionnaireResponse[] = [];

			if (questionnaireResponseUsageQuery) {
				const questionnaireResponseUsageBundle = await withFallback<
					Bundle | undefined
				>(
					boxJson<Bundle>(
						client,
						{
							method: "GET",
							url: "/sdc/QuestionnaireResponse",
							params: [...questionnaireResponseUsageQuery],
						},
						"Failed to check questionnaire responses",
					),
					undefined,
				);
				if (questionnaireResponseUsageBundle) {
					qrUsage = bundleResources<QuestionnaireResponse>(
						questionnaireResponseUsageBundle,
						"QuestionnaireResponse",
					);
				}
			}

			const requiresConfirmation =
				questionnaire.status === "active" ||
				questionnaire.status === "retired" ||
				componentUsage.length > 0 ||
				qrUsage.length > 0;

			return {
				componentUsage,
				qrUsage,
				requiresConfirmation,
			};
		},
	});
}

export function useDeleteQuestionnaire() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (questionnaire: Questionnaire) => {
			if (!questionnaire.id) {
				throw new Error("Questionnaire id is required");
			}

			await boxRequest(
				client,
				{
					method: "DELETE",
					url: `/sdc/Questionnaire/${encodeURIComponent(questionnaire.id)}`,
				},
				"Failed to delete questionnaire",
			);

			if (questionnaire.url && questionnaire.version) {
				// The assembled copy may well not exist; nobody waits on it.
				void withFallback(
					boxRequest(
						client,
						{
							method: "DELETE",
							url: "/sdc/Questionnaire",
							params: [
								["url", questionnaire.url],
								["version", `${questionnaire.version}-assembled`],
							],
						},
						"Failed to delete the assembled questionnaire",
					),
					undefined,
				);
			}

			return questionnaire;
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["questionnaires"] });
		},
	});
}

export function useResponseWorkflows(
	responseIds: string[],
	resourceType:
		| "QuestionnaireResponse"
		| "RequestGroup" = "QuestionnaireResponse",
) {
	const workflowScope = responseIds.join(",");
	const referenceKey =
		resourceType === "RequestGroup" ? "request-group-id" : "response-id";

	const client = useAidboxClient();

	return useQuery({
		queryKey: ["questionnaireResponseWorkflows", resourceType, workflowScope],
		queryFn: async () => {
			const body = await boxJson<SdcWorkflow[] | { workflows?: SdcWorkflow[] }>(
				client,
				{
					method: "GET",
					url: "/sdc/$workflow",
					params: [[referenceKey, workflowScope]],
				},
				"Failed to fetch response workflows",
			);
			const workflows = Array.isArray(body) ? body : (body.workflows ?? []);

			return latestWorkflowsByResponseId(workflows, referenceKey);
		},
		enabled: responseIds.length > 0,
		placeholderData: (previousData) => previousData,
	});
}

async function stopResponseNotification(
	client: AidboxClientR5,
	responseId: string,
	resourceType: "QuestionnaireResponse" | "RequestGroup",
) {
	await boxRequest(
		client,
		{
			method: "POST",
			url:
				resourceType === "RequestGroup"
					? `/fhir/RequestGroup/${encodeURIComponent(responseId)}/$sdc-stop-notification`
					: `/QuestionnaireResponse/${encodeURIComponent(responseId)}/$stop-notification`,
		},
		"Failed to cancel sending",
	);

	return responseId;
}

/**
 * How many cancellations are in flight at once. A whole page can be selected, and
 * firing fifty POSTs at the box in one go is neither kind to it nor faster in
 * practice.
 */
const CANCEL_SENDING_CONCURRENCY = 4;

export type CancelSendingResult = {
	canceled: string[];
	/** First error seen, used for the message when a single row was cancelled. */
	error?: Error;
	failed: string[];
};

/**
 * Cancels sending for one or many responses and refreshes the grid **once** when
 * the whole batch is done, instead of per response.
 */
export function useCancelResponseSending(
	resourceType:
		| "QuestionnaireResponse"
		| "RequestGroup" = "QuestionnaireResponse",
) {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (responseIds: string[]): Promise<CancelSendingResult> => {
			const queue = [...responseIds];
			const canceled: string[] = [];
			const failed: string[] = [];
			let firstError: Error | undefined;

			const worker = async () => {
				for (;;) {
					const responseId = queue.shift();

					if (!responseId) {
						return;
					}

					try {
						await stopResponseNotification(client, responseId, resourceType);
						canceled.push(responseId);
					} catch (error) {
						failed.push(responseId);
						firstError ??=
							error instanceof Error
								? error
								: new Error("Failed to cancel sending");
					}
				}
			};

			await Promise.all(
				Array.from(
					{ length: Math.min(CANCEL_SENDING_CONCURRENCY, queue.length) },
					worker,
				),
			);

			return { canceled, error: firstError, failed };
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: ["questionnaireResponseWorkflows"],
			});
			void queryClient.invalidateQueries({
				queryKey: ["questionnaireResponses"],
			});
		},
	});
}

/**
 * Deletes one or many responses in a single FHIR transaction, so a batch either
 * lands whole or not at all — a partly deleted selection would leave the user
 * guessing which rows went. Deleting an id that is already gone is not an error
 * (the box answers 204 for that entry).
 */
export function useDeleteQuestionnaireResponses() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (responseIds: string[]) => {
			await boxRequest(
				client,
				{
					method: "POST",
					url: "/fhir",
					body: JSON.stringify({
						resourceType: "Bundle",
						type: "transaction",
						entry: responseIds.map((responseId) => ({
							request: {
								method: "DELETE",
								url: `QuestionnaireResponse/${encodeURIComponent(responseId)}`,
							},
						})),
					}),
				},
				responseIds.length === 1
					? "Failed to delete the response"
					: "Failed to delete the responses",
			);

			return responseIds;
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: ["questionnaireResponses"],
			});
			void queryClient.invalidateQueries({
				queryKey: ["questionnaireResponseWorkflows"],
			});
		},
	});
}

export async function validateQuestionnaire(
	client: AidboxClientR5,
	questionnaire: Questionnaire,
	// Not forwarded yet: AidboxClient takes no AbortSignal (see `boxRequest`).
	_signal?: AbortSignal,
): Promise<OperationOutcome> {
	return boxJson<OperationOutcome>(
		client,
		{
			method: "POST",
			url: "/sdc/Questionnaire/$validate",
			body: JSON.stringify(questionnaire),
		},
		"Failed to validate questionnaire",
	);
}

export async function findQuestionnaireByUrl(
	client: AidboxClientR5,
	url: string,
	version: string | undefined,
	// Not forwarded yet: AidboxClient takes no AbortSignal (see `boxRequest`).
	_signal?: AbortSignal,
): Promise<Questionnaire[]> {
	const params: Array<[string, string]> = [["url", url]];

	if (version) {
		params.push(["version", version]);
	}

	const bundle = await boxJson<Bundle>(
		client,
		{ method: "GET", url: "/sdc/Questionnaire", params },
		"Failed to search questionnaires",
	);

	return bundleResources<Questionnaire>(bundle, "Questionnaire");
}

type OpenEhrConversionResult = {
	questionnaire: Questionnaire;
	source: unknown;
};

export async function convertOpenEhrTemplate(
	client: AidboxClientR5,
	content: string,
): Promise<OpenEhrConversionResult> {
	const parameters = await boxJson<{
		parameter?: Array<{ name?: string; resource?: unknown }>;
	}>(
		client,
		{
			method: "POST",
			url: "/$sdc-openehr-convert",
			body: JSON.stringify({
				parameter: [{ name: "content", valueString: content }],
				resourceType: "Parameters",
			}),
		},
		"Failed to convert OpenEHR template",
	);
	const questionnaire = parameters.parameter?.find(
		(parameter) => parameter.name === "questionnaire",
	)?.resource as Questionnaire | undefined;
	const source = parameters.parameter?.find(
		(parameter) => parameter.name === "source-template",
	)?.resource;

	if (!questionnaire) {
		throw new Error("OpenEHR conversion returned no questionnaire");
	}

	return { questionnaire, source };
}

function withOpenEhrTemplateReference(
	questionnaire: Questionnaire,
	templateId: string,
): Questionnaire {
	const existing =
		(questionnaire as QuestionnaireWithExtensions).extension ?? [];
	const reference = {
		url: OPENEHR_TEMPLATE_SOURCE_URL,
		valueReference: { id: templateId, resourceType: "OpenEHRTemplate" },
	};
	const hasExisting = existing.some(
		(extension) => extension.url === OPENEHR_TEMPLATE_SOURCE_URL,
	);
	const extension = hasExisting
		? existing.map((entry) =>
				entry.url === OPENEHR_TEMPLATE_SOURCE_URL ? reference : entry,
			)
		: [...existing, reference];

	return { ...questionnaire, extension } as Questionnaire;
}

async function postSdcResource<T>(
	client: AidboxClientR5,
	path: string,
	body: unknown,
	failureMessage: string,
): Promise<T> {
	return boxJson<T>(
		client,
		{ method: "POST", url: path, body: JSON.stringify(body) },
		failureMessage,
	);
}

type ImportQuestionnaireParams = {
	questionnaire: Questionnaire;
	openEhrSource?: unknown;
};

export function useImportQuestionnaire() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			openEhrSource,
			questionnaire,
		}: ImportQuestionnaireParams) => {
			const sanitized = sanitizeImportedQuestionnaire(questionnaire);

			if (openEhrSource) {
				const savedTemplate = await postSdcResource<{ id?: string }>(
					client,
					"/sdc/OpenEHRTemplate",
					openEhrSource,
					"Failed to import OpenEHR template",
				);

				if (!savedTemplate.id) {
					throw new Error("Imported OpenEHR template is missing id");
				}

				const withTemplateRef = withOpenEhrTemplateReference(
					sanitized,
					savedTemplate.id,
				);

				return postSdcResource<Questionnaire>(
					client,
					"/sdc/Questionnaire",
					withTemplateRef,
					"Failed to import questionnaire",
				);
			}

			return postSdcResource<Questionnaire>(
				client,
				"/sdc/Questionnaire",
				sanitized,
				"Failed to import questionnaire",
			);
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["questionnaires"] });
		},
	});
}
