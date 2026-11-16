import { type AidboxClientR5, useAidboxClient } from "@aidbox-ui/AidboxClient";
import type {
	Bundle,
	OperationOutcome,
	PlanDefinition,
	Questionnaire,
	QuestionnaireResponse,
	RequestGroup,
	Resource,
	Task,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import type { RequestParams } from "@health-samurai/aidbox-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { generateId } from "../../../../utils";
import { boxJson, boxRequest } from "../../shared/http";
import { PLAN_DEFINITION_TYPE_SYSTEM } from "../shared/const";
import {
	buildQuestionnaireQuery,
	buildQuestionnaireResponseQuery,
	type Form,
	type FormFilters,
	getFormLabel,
	getFormPinId,
	type QuestionnaireResponseFilters,
} from "./forms";
import { ResourceRequestError } from "./resource-error";

export const ACTION_QUESTIONNAIRE_ANSWER_MAPPING_URL =
	"http://health-samurai.io/fhir/sdc/StructureDefinition/action-questionnaire-answer-mapping";

export type ResponseGroup = {
	requestGroup: RequestGroup;
	responses: QuestionnaireResponse[];
	actionIdsByResponseId: Record<string, string>;
};

export type SdcRequestInit = {
	method?: RequestParams["method"];
	headers?: Record<string, string>;
	body?: string;
	/** Not forwarded yet: AidboxClient takes no AbortSignal (see `boxRequest`). */
	signal?: AbortSignal;
};

/** A JSON request to the box; `path` may carry its own query string. */
export async function sdcRequest<T>(
	client: AidboxClientR5,
	path: string,
	{ method = "GET", headers, body }: SdcRequestInit = {},
): Promise<T> {
	return boxJson<T>(
		client,
		{ method, url: path, headers, body },
		"Could not load form data",
	);
}

/** Follow every search page, including servers that cap the requested page size. */
export async function searchResources<T extends Resource>(
	client: AidboxClientR5,
	type: string,
	parameters: Array<[string, string]>,
	signal?: AbortSignal,
	limit = Number.POSITIVE_INFINITY,
): Promise<{ resources: T[]; total: number }> {
	const resources: T[] = [];
	let page = 1;
	let total = 0;
	do {
		const query = new URLSearchParams(parameters);
		query.set("_page", String(page));
		if (!query.has("_count")) query.set("_count", "100");
		const bundle = await sdcRequest<Bundle>(client, `/sdc/${type}?${query}`, {
			signal,
		});
		const matches = (bundle.entry ?? []).flatMap((entry) =>
			entry.resource?.resourceType === type ? [entry.resource as T] : [],
		);
		resources.push(...matches);
		total = bundle.total ?? resources.length;
		if (
			!matches.length ||
			(!bundle.link?.some((link) => link.relation === "next") &&
				resources.length >= total)
		)
			break;
		page++;
	} while (resources.length < limit);
	return { resources, total };
}

export function canonical(
	resource: Pick<Form, "id" | "url" | "version" | "resourceType">,
) {
	const url = resource.url || `${resource.resourceType}/${resource.id}`;
	return resource.version && resource.url ? `${url}|${resource.version}` : url;
}

export function usePlanDefinitions() {
	const aidboxClient = useAidboxClient();
	return useQuery({
		queryKey: ["planDefinitions"],
		queryFn: async ({ signal }) => {
			const result = await searchResources<PlanDefinition>(
				aidboxClient,
				"PlanDefinition",
				[["type", `${PLAN_DEFINITION_TYPE_SYSTEM}|plan-definition`]],
				signal,
			);
			return result.resources;
		},
		staleTime: 60_000,
	});
}

/** Questionnaire metadata shared by PlanDefinition design, sharing, and expanded rows. */
export function useQuestionnaireMetadata(enabled = true) {
	const aidboxClient = useAidboxClient();
	return useQuery({
		queryKey: ["questionnaires", "metadata"],
		enabled,
		queryFn: ({ signal }) =>
			searchResources<Questionnaire>(
				aidboxClient,
				"Questionnaire",
				[
					[
						"_elements",
						"id,url,version,title,name,status,publisher,meta,extension",
					],
				],
				signal,
			),
		staleTime: 60_000,
	});
}

/** Merge sorted prefixes before slicing, so PlanDefinitions do not distort paging. */
export function mergeForms(
	questionnaires: Questionnaire[],
	planDefinitions: PlanDefinition[],
	filters: FormFilters,
	page: number,
	pageSize: number,
) {
	const direction = filters.updatedSort === "asc" ? 1 : -1;
	return [...questionnaires, ...planDefinitions]
		.sort(
			(left, right) =>
				direction *
					(left.meta?.lastUpdated ?? "").localeCompare(
						right.meta?.lastUpdated ?? "",
					) ||
				`${left.resourceType}/${left.id}`.localeCompare(
					`${right.resourceType}/${right.id}`,
				),
		)
		.slice((page - 1) * pageSize, page * pageSize);
}

export function useForms(
	filters: FormFilters,
	page: number,
	pageSize: number,
	excludedIds: string[],
) {
	const aidboxClient = useAidboxClient();
	const planDefinitions = usePlanDefinitions();
	const planDefinitionScope = (planDefinitions.data ?? [])
		.map((planDefinition) => planDefinition.id)
		.sort()
		.join(",");
	const query = useQuery({
		queryKey: [
			"questionnaires",
			"forms",
			filters,
			page,
			pageSize,
			excludedIds,
			planDefinitionScope,
		],
		enabled: planDefinitions.isSuccess,
		queryFn: async ({ signal }) => {
			const planDefinitionCandidates =
				!filters.kind || filters.kind === "plan-definition"
					? (planDefinitions.data ?? []).filter(
							(planDefinition) =>
								!excludedIds.includes(getFormPinId(planDefinition)),
						)
					: [];
			// Let the server apply the same text, author and status search semantics to both resource types.
			const [questionnaires, matchingDefinitions] = await Promise.all([
				filters.kind === "plan-definition"
					? Promise.resolve({ resources: [] as Questionnaire[], total: 0 })
					: searchResources<Questionnaire>(
							aidboxClient,
							"Questionnaire",
							buildQuestionnaireQuery(
								filters,
								1,
								Math.min(page * pageSize, 100),
								excludedIds.filter((id) => !id.startsWith("PlanDefinition/")),
							),
							signal,
							page * pageSize,
						),
				planDefinitionCandidates.length
					? searchResources<PlanDefinition>(
							aidboxClient,
							"PlanDefinition",
							[
								["type", `${PLAN_DEFINITION_TYPE_SYSTEM}|plan-definition`],
								...buildQuestionnaireQuery(
									{ ...filters, kind: undefined },
									1,
									100,
								),
							],
							signal,
						)
					: Promise.resolve({ resources: [] as PlanDefinition[], total: 0 }),
			]);
			const planDefinitionIds = new Set(
				planDefinitionCandidates.map((planDefinition) => planDefinition.id),
			);
			const matchingPlanDefinitions = matchingDefinitions.resources.filter(
				(planDefinition) => planDefinitionIds.has(planDefinition.id),
			);
			return {
				forms: mergeForms(
					questionnaires.resources,
					matchingPlanDefinitions,
					filters,
					page,
					pageSize,
				),
				total: questionnaires.total + matchingPlanDefinitions.length,
			};
		},
		placeholderData: (previous) => previous,
	});
	return {
		...query,
		planDefinitionScope,
		isLoading: planDefinitions.isLoading || query.isLoading,
		isError: planDefinitions.isError || query.isError,
	};
}

export function usePlanDefinition(planDefinitionId?: string) {
	const aidboxClient = useAidboxClient();
	return useQuery({
		queryKey: ["planDefinition", planDefinitionId],
		enabled: Boolean(planDefinitionId),
		queryFn: ({ signal }) =>
			sdcRequest<PlanDefinition>(
				aidboxClient,
				`/sdc/PlanDefinition/${encodeURIComponent(planDefinitionId ?? "")}`,
				{ signal },
			),
	});
}

export function useSavePlanDefinition() {
	const aidboxClient = useAidboxClient();
	const client = useQueryClient();
	return useMutation({
		mutationFn: async (planDefinition: PlanDefinition) => {
			const body = JSON.stringify(planDefinition);
			const outcome = await sdcRequest<OperationOutcome>(
				aidboxClient,
				"/fhir/PlanDefinition/$sdc-validate",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body,
				},
			);
			if (
				outcome.resourceType !== "OperationOutcome" ||
				!Array.isArray(outcome.issue)
			)
				throw new Error("Could not validate package");
			if (
				outcome.issue.some(
					(issue) => issue.severity === "error" || issue.severity === "fatal",
				)
			)
				throw new ResourceRequestError(outcome, 200);
			return sdcRequest<PlanDefinition>(
				aidboxClient,
				`/sdc/PlanDefinition/${encodeURIComponent(planDefinition.id ?? "")}`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body,
				},
			);
		},
		onSuccess: (planDefinition) => {
			client.setQueryData(
				["planDefinition", planDefinition.id],
				planDefinition,
			);
			void client.invalidateQueries({ queryKey: ["planDefinitions"] });
			void client.invalidateQueries({ queryKey: ["questionnaires"] });
		},
	});
}

/** Copy a PlanDefinition as a draft, retaining its actions and questionnaire references. */
export function useDuplicatePlanDefinition() {
	const aidboxClient = useAidboxClient();
	const client = useQueryClient();
	return useMutation({
		mutationFn: async (planDefinitionId: string) => {
			const [planDefinition, planDefinitions] = await Promise.all([
				sdcRequest<PlanDefinition>(
					aidboxClient,
					`/sdc/PlanDefinition/${encodeURIComponent(planDefinitionId)}`,
				),
				searchResources<PlanDefinition>(aidboxClient, "PlanDefinition", [
					["_elements", "title"],
				]),
			]);
			const id = generateId();
			const title = getFormLabel(planDefinition);
			const titles = new Set(
				planDefinitions.resources.map((item) => item.title),
			);
			let number = 1;
			while (titles.has(`${title} (${number})`)) number++;
			const originalUrl = planDefinition.url?.replace(
				/__(?:[A-Za-z0-9]{21}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/,
				"",
			);
			return sdcRequest<PlanDefinition>(aidboxClient, "/sdc/PlanDefinition", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...planDefinition,
					id,
					meta: undefined,
					url: originalUrl
						? `${originalUrl}__${id}`
						: `http://forms.aidbox.io/plan-definition/${id}`,
					title: `${title} (${number})`,
					status: "draft",
				}),
			});
		},
		onSuccess: () => {
			void client.invalidateQueries({ queryKey: ["planDefinitions"] });
			void client.invalidateQueries({ queryKey: ["questionnaires"] });
		},
	});
}

/** Delete the PlanDefinition without deleting its reusable questionnaires. */
export function useDeletePlanDefinition() {
	const aidboxClient = useAidboxClient();
	const client = useQueryClient();
	return useMutation({
		mutationFn: async (planDefinition: PlanDefinition) => {
			if (!planDefinition.id) throw new Error("Package id is required");
			await boxRequest(
				aidboxClient,
				{
					method: "DELETE",
					url: `/sdc/PlanDefinition/${encodeURIComponent(planDefinition.id)}`,
				},
				"Failed to delete package",
			);
			return planDefinition;
		},
		onSuccess: (planDefinition) => {
			client.removeQueries({
				queryKey: ["planDefinition", planDefinition.id],
				exact: true,
			});
			void client.invalidateQueries({ queryKey: ["planDefinitions"] });
			void client.invalidateQueries({ queryKey: ["questionnaires"] });
		},
	});
}

/** Only the filtered response page becomes children; Tasks supply parentage, never extra siblings. */
export function groupResponses(
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
