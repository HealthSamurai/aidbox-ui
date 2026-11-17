import { type AidboxClientR5, useAidboxClient } from "@aidbox-ui/AidboxClient";
import type {
	Bundle,
	PlanDefinition,
	Questionnaire,
	QuestionnaireResponse,
	Resource,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { boxJson, boxRequest, withFallback } from "@aidbox-ui/utils/http";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** `client.searchType` through `client.request`, returning the raw bundle. */
export function searchFhirType(
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

export function bundleResources<T extends Resource>(
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

type QuestionnaireUsageResponse = {
	questionnaires?: Questionnaire[];
};

export type QuestionnaireDeleteCheck = {
	componentUsage: Questionnaire[];
	qrUsage: QuestionnaireResponse[];
	requiresConfirmation: boolean;
};

export type QuestionnaireWithExtensions = Questionnaire & {
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
