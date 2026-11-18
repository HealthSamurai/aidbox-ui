import { type AidboxClientR5, useAidboxClient } from "@aidbox-ui/AidboxClient";
import type {
	Bundle,
	OperationOutcome,
	PlanDefinition,
	Questionnaire,
	Resource,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { generateId } from "@aidbox-ui/utils";
import { rejectWith, resourceOf } from "@aidbox-ui/utils/http";
import type { RequestParams } from "@health-samurai/aidbox-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PLAN_DEFINITION_TYPE_SYSTEM } from "./const";
import type { Form } from "./forms";
import { getFormLabel } from "./forms-list";
import { ResourceRequestError } from "./resource-error";

export const ACTION_QUESTIONNAIRE_ANSWER_MAPPING_URL =
	"http://health-samurai.io/fhir/sdc/StructureDefinition/action-questionnaire-answer-mapping";

export type SdcRequestInit = {
	method?: RequestParams["method"];
	headers?: Record<string, string>;
	body?: string;
	/** Not forwarded yet: AidboxClient takes no AbortSignal (see `rejectWith`). */
	signal?: AbortSignal;
};

/** A JSON request to the box; `path` may carry its own query string. */
export async function sdcRequest<T>(
	client: AidboxClientR5,
	path: string,
	{ method = "GET", headers, body }: SdcRequestInit = {},
): Promise<T> {
	return resourceOf(
		client.request<T>({ method, url: path, headers, body }),
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
			await aidboxClient
				.rawRequest({
					method: "DELETE",
					url: `/sdc/PlanDefinition/${encodeURIComponent(planDefinition.id)}`,
				})
				.catch(rejectWith("Failed to delete package"));
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
