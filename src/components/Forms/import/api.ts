import { type AidboxClientR5, useAidboxClient } from "@aidbox-ui/AidboxClient";
import { resourceOf } from "@aidbox-ui/components/Forms/api/resource-error";
import type {
	Bundle,
	OperationOutcome,
	Questionnaire,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	bundleResources,
	type QuestionnaireWithExtensions,
} from "../api/forms";

const OPENEHR_TEMPLATE_SOURCE_URL =
	"http://aidbox.io/sdc/openehr-template-source";

function sanitizeImportedQuestionnaire(questionnaire: Questionnaire) {
	const { id: _id, meta: _meta, ...rest } = questionnaire;

	return rest as Questionnaire;
}

export async function validateQuestionnaire(
	client: AidboxClientR5,
	questionnaire: Questionnaire,
	// Not forwarded yet: AidboxClient takes no AbortSignal (see `rejectWith`).
	_signal?: AbortSignal,
): Promise<OperationOutcome> {
	return resourceOf(
		client.request<OperationOutcome>({
			method: "POST",
			url: "/sdc/Questionnaire/$validate",
			body: JSON.stringify(questionnaire),
		}),
		"Failed to validate questionnaire",
	);
}

export async function findQuestionnaireByUrl(
	client: AidboxClientR5,
	url: string,
	version: string | undefined,
	// Not forwarded yet: AidboxClient takes no AbortSignal (see `rejectWith`).
	_signal?: AbortSignal,
): Promise<Questionnaire[]> {
	const params: Array<[string, string]> = [["url", url]];

	if (version) {
		params.push(["version", version]);
	}

	const bundle = await resourceOf(
		client.request<Bundle>({
			method: "GET",
			url: "/sdc/Questionnaire",
			params,
		}),
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
	const parameters = await resourceOf(
		client.request<{
			parameter?: Array<{ name?: string; resource?: unknown }>;
		}>({
			method: "POST",
			url: "/$sdc-openehr-convert",
			body: JSON.stringify({
				parameter: [{ name: "content", valueString: content }],
				resourceType: "Parameters",
			}),
		}),
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
	return resourceOf(
		client.request<T>({
			method: "POST",
			url: path,
			body: JSON.stringify(body),
		}),
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
