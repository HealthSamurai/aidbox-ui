import { useAidboxClient } from "@aidbox-ui/AidboxClient";
import * as ApiUtils from "@aidbox-ui/api/utils";
import { defaultToastPlacement } from "@aidbox-ui/components/config";
import { resourceOf } from "@aidbox-ui/components/Forms/api/resource-error";
import { updateResource } from "@aidbox-ui/components/ResourceEditor/api";
import { pageId } from "@aidbox-ui/components/ResourceEditor/types";
import type {
	Bundle,
	Questionnaire,
	QuestionnaireResponse,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { QuestionnairePreview } from "./index";

function Notice({ children }: { children: string }) {
	return (
		<div className="p-4" data-test-id="questionnaire-response-preview__error">
			<HSComp.Alert variant="warning">
				<AlertCircle className="size-4" />
				<HSComp.AlertDescription>{children}</HSComp.AlertDescription>
			</HSComp.Alert>
		</div>
	);
}

/** The Questionnaire a response answers, found by its canonical `url|version`. */
function useAnsweredQuestionnaire(reference: string | undefined) {
	const client = useAidboxClient();
	const [url, version] = (reference ?? "").split("|");
	return useQuery({
		queryKey: ["questionnaire-by-canonical", url, version],
		enabled: Boolean(url),
		queryFn: async () => {
			const params: Array<[string, string]> = [["url", url ?? ""]];
			if (version) params.push(["version", version]);
			const bundle = await resourceOf(
				client.request<Bundle>({
					method: "GET",
					url: "/fhir/Questionnaire",
					params,
				}),
				"Could not load the questionnaire",
			);
			const resource = bundle.entry?.find(
				(entry) => entry.resource?.resourceType === "Questionnaire",
			)?.resource;
			return (resource as Questionnaire | undefined) ?? null;
		},
	});
}

/**
 * Saves what the form's Submit hands over, the way the editor's Save does:
 * a toast, then the resource and its history are reloaded.
 */
function useSubmitResponse(id: string | undefined) {
	const client = useAidboxClient();
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: (response: QuestionnaireResponse) =>
			updateResource(
				client,
				"QuestionnaireResponse",
				id ?? "",
				response as unknown as Resource,
			),
		onError: ApiUtils.onMutationError,
		onSuccess: () => {
			HSComp.toast.success("Saved", defaultToastPlacement);
			void queryClient.invalidateQueries({
				queryKey: [pageId, "QuestionnaireResponse", id],
			});
		},
	});
	return id ? mutation.mutate : undefined;
}

/**
 * The response as the form shows it, from the editor's current, possibly
 * unsaved, state. The form's Submit saves the answers to the response.
 */
export function QuestionnaireResponsePreview({
	questionnaireResponse,
}: {
	questionnaireResponse: QuestionnaireResponse;
}) {
	const reference = questionnaireResponse.questionnaire;
	const query = useAnsweredQuestionnaire(reference);
	const submit = useSubmitResponse(questionnaireResponse.id);

	if (!reference)
		return <Notice>The response does not name its questionnaire.</Notice>;
	if (query.isPending)
		return (
			<output className="flex h-full items-center justify-center gap-2 text-sm text-text-secondary">
				<LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
				Loading questionnaire…
			</output>
		);
	if (query.isError) return <Notice>{query.error.message}</Notice>;
	if (!query.data)
		return <Notice>{`Questionnaire ${reference} not found.`}</Notice>;

	return (
		<QuestionnairePreview
			questionnaire={query.data}
			questionnaireResponse={questionnaireResponse}
			rendererSwitch
			showResponse={false}
			onSubmit={
				submit &&
				((response) =>
					submit({
						...questionnaireResponse,
						...(response as QuestionnaireResponse),
						resourceType: "QuestionnaireResponse",
						id: questionnaireResponse.id,
					}))
			}
		/>
	);
}
