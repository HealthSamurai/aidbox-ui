import { useAidboxClient } from "@aidbox-ui/AidboxClient";
import type { Questionnaire } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import { useQueries } from "@tanstack/react-query";
import { sdcRequest } from "../../api/plan-definitions";
import type { FhirpathVariable } from "../../shared/fhirpath-editor";
import {
	findQuestionnaire,
	type PlanDefinitionActionDraft,
	planDefinitionQuestions,
} from "./plan-definition-model";

/** Load each questionnaire once, then resolve items in action order (including duplicates). */
export function usePlanDefinitionQuestionnaires(
	actions: PlanDefinitionActionDraft[],
	questionnaires: Questionnaire[],
) {
	const metadata = actions.map((action) =>
		findQuestionnaire(action, questionnaires),
	);
	const ids = [
		...new Set(metadata.flatMap((form) => (form?.id ? [form.id] : []))),
	];
	const aidboxClient = useAidboxClient();
	const queries = useQueries({
		queries: ids.map((id) => ({
			queryKey: ["questionnaire", id],
			queryFn: ({ signal }: { signal: AbortSignal }) =>
				sdcRequest<Questionnaire>(
					aidboxClient,
					`/sdc/Questionnaire/${encodeURIComponent(id)}`,
					{ signal },
				),
			staleTime: 60_000,
		})),
	});
	const byId = new Map(ids.map((id, index) => [id, queries[index]]));
	const forms = metadata.map((form) =>
		form?.id ? byId.get(form.id) : undefined,
	);
	const loaded = forms.map((form) => form?.data);
	const questions = actions.flatMap((action, actionIndex) =>
		action.id
			? planDefinitionQuestions(
					action.id,
					action.title || action.id,
					loaded[actionIndex]?.item,
				).map((question) => ({ ...question, actionIndex }))
			: [],
	);

	return {
		forms,
		questionnaires: loaded,
		questions,
		loading: queries.some((form) => form.isPending),
		loadError: queries.some((form) => form.isError),
		retry: () => {
			for (const form of queries) if (form.isError) void form.refetch();
		},
	};
}

export function planDefinitionVariables(
	actions: PlanDefinitionActionDraft[],
): FhirpathVariable[] {
	return [
		...new Map<string, FhirpathVariable>([
			...actions.flatMap((action) =>
				action.id
					? [
							[
								action.id,
								{
									name: action.id,
									description: action.title || action.id,
									resourceType: "QuestionnaireResponse",
								},
							] as const,
						]
					: [],
			),
			[
				"patient",
				{ name: "patient", description: "Patient", resourceType: "Patient" },
			],
			[
				"requestGroup",
				{
					name: "requestGroup",
					description: "Current RequestGroup",
					resourceType: "RequestGroup",
				},
			],
			[
				"responses",
				{
					name: "responses",
					description: "Bundle of all form responses",
					resourceType: "Bundle",
				},
			],
		]).values(),
	];
}
