import { type AidboxClientR5, useAidboxClient } from "@aidbox-ui/AidboxClient";
import type {
	Bundle,
	Questionnaire,
	QuestionnaireResponse,
	RequestGroup,
	Task,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { rejectWith, resourceOf } from "@aidbox-ui/utils/http";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bundleResources, searchFhirType } from "../api/forms";
import { searchResources } from "../api/plan-definitions";
import { COMPLETED_RESPONSE_STATUSES } from "../utils";
import type { QuestionnaireCatalog } from "./response-labels";

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

export type ResponseFilterOption = {
	label: string;
	value: string;
};

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

function buildQuestionnaireResponseQuery(
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
			const body = await resourceOf(
				client.request<SdcWorkflow[] | { workflows?: SdcWorkflow[] }>({
					method: "GET",
					url: "/sdc/$workflow",
					params: [[referenceKey, workflowScope]],
				}),
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
	await client
		.rawRequest({
			method: "POST",
			url:
				resourceType === "RequestGroup"
					? `/fhir/RequestGroup/${encodeURIComponent(responseId)}/$sdc-stop-notification`
					: `/QuestionnaireResponse/${encodeURIComponent(responseId)}/$stop-notification`,
		})
		.catch(rejectWith("Failed to cancel sending"));

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
			await client
				.rawRequest({
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
				})
				.catch(
					rejectWith(
						responseIds.length === 1
							? "Failed to delete the response"
							: "Failed to delete the responses",
					),
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

export type ResponseGroup = {
	requestGroup: RequestGroup;
	responses: QuestionnaireResponse[];
	actionIdsByResponseId: Record<string, string>;
};

/** Only the filtered response page becomes children; Tasks supply parentage, never extra siblings. */
function groupResponses(
	responses: QuestionnaireResponse[],
	tasks: Task[],
	requestGroups: RequestGroup[],
): { groups: ResponseGroup[]; standalone: QuestionnaireResponse[] } {
	const byResponse = new Map<
		string,
		{ requestGroup: RequestGroup; actionId?: string }
	>();
	for (const group of requestGroups) {
		const actionsByTask = new Map(
			group.action?.map((action) => [action.resource?.reference, action.id]),
		);
		for (const task of tasks) {
			if (
				!actionsByTask.has(`Task/${task.id}`) ||
				!task.basedOn?.some(
					(reference) => reference.reference === `RequestGroup/${group.id}`,
				)
			)
				continue;
			for (const output of task.output ?? []) {
				if (
					!output.type.coding?.some(
						(coding) =>
							coding.system === "http://hl7.org/fhir/uv/sdc/CodeSystem/temp" &&
							coding.code === "questionnaire-response",
					)
				)
					continue;
				const reference = output.valueReference?.reference;
				if (reference)
					byResponse.set(reference, {
						requestGroup: group,
						actionId: actionsByTask.get(`Task/${task.id}`),
					});
			}
		}
	}
	const groups = new Map<string, ResponseGroup>();
	const standalone: QuestionnaireResponse[] = [];
	for (const response of responses) {
		const parent = byResponse.get(`QuestionnaireResponse/${response.id}`);
		const group = parent?.requestGroup;
		if (!group?.id) {
			standalone.push(response);
			continue;
		}
		let responseGroup = groups.get(group.id);
		if (!responseGroup) {
			responseGroup = {
				requestGroup: group,
				responses: [],
				actionIdsByResponseId: {},
			};
			groups.set(group.id, responseGroup);
		}
		responseGroup.responses.push(response);
		if (response.id && parent?.actionId)
			responseGroup.actionIdsByResponseId[response.id] = parent.actionId;
	}
	return { groups: [...groups.values()], standalone };
}

export function useGroupedResponses(
	filters: QuestionnaireResponseFilters,
	page: number,
	pageSize: number,
) {
	const aidboxClient = useAidboxClient();
	return useQuery({
		queryKey: ["questionnaireResponses", "grouped", filters, page, pageSize],
		queryFn: async ({ signal }) => {
			const query = buildQuestionnaireResponseQuery(
				filters,
				1,
				Math.min(page * pageSize, 100),
			);
			// A newly created RequestGroup has no responses yet. Child-only filters exclude
			// it, while PlanDefinition and patient filters still apply to the RequestGroup.
			const [matches, unopened] = await Promise.all([
				searchResources<QuestionnaireResponse>(
					aidboxClient,
					"QuestionnaireResponse",
					query,
					signal,
					page * pageSize,
				),
				filters.q ||
				filters.status ||
				filters.completedFrom ||
				filters.completedTo
					? Promise.resolve({ resources: [] as RequestGroup[], total: 0 })
					: searchResources<RequestGroup>(
							aidboxClient,
							"RequestGroup",
							[...query, ["sdc-empty", "true"]],
							signal,
							page * pageSize,
						),
			]);
			const items = [...matches.resources, ...unopened.resources]
				.sort(
					(left, right) =>
						(right.meta?.lastUpdated ?? "").localeCompare(
							left.meta?.lastUpdated ?? "",
						) ||
						`${left.resourceType}/${left.id}`.localeCompare(
							`${right.resourceType}/${right.id}`,
						),
				)
				.slice((page - 1) * pageSize, page * pageSize);
			const responses = items.filter(
				(item) => item.resourceType === "QuestionnaireResponse",
			);
			const ids = responses.flatMap((response) =>
				response.id ? [response.id] : [],
			);
			const tasks = ids.length
				? (
						await searchResources<Task>(
							aidboxClient,
							"Task",
							[
								["sdc-response", ids.join(",")],
								[
									"code",
									"http://hl7.org/fhir/uv/sdc/CodeSystem/temp|complete-questionnaire",
								],
							],
							signal,
						)
					).resources
				: [];
			const groupIds = [
				...new Set(
					tasks.flatMap((task) =>
						(task.basedOn ?? []).flatMap((reference) =>
							reference.reference?.startsWith("RequestGroup/")
								? [reference.reference.slice(13)]
								: [],
						),
					),
				),
			];
			const groups = groupIds.length
				? (
						await searchResources<RequestGroup>(
							aidboxClient,
							"RequestGroup",
							[["_id", groupIds.join(",")]],
							signal,
						)
					).resources
				: [];
			const grouped = groupResponses(responses, tasks, groups);
			return {
				questionnaireResponses: responses,
				standalone: grouped.standalone,
				groups: [
					...grouped.groups,
					...items
						.filter((item) => item.resourceType === "RequestGroup")
						.map((requestGroup) => ({
							requestGroup,
							responses: [],
							actionIdsByResponseId: {},
						})),
				],
				total: matches.total + unopened.total,
				unopenedTotal: unopened.total,
			};
		},
		placeholderData: (previous) => previous,
	});
}
