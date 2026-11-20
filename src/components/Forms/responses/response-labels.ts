import type {
	PlanDefinition,
	Questionnaire,
	QuestionnaireResponse,
	RequestGroup,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { getFormLabel } from "../api/forms-list";
import { questionnaireTemplates } from "../api/templates";
import {
	getQuestionnaireResponseSubjectLabel,
	normalizeCanonicalReference,
} from "../utils";
import type { ResponseGroup } from "./api";

/** The purpose a form's liquid template is linked under to print a response. */
export const PRINT_PURPOSE = "print";

/** Characters Windows forbids in a file name. */
const UNSAFE_FILE_NAME_CHARS = /[\\/:*?"<>|]/g;
const FILE_NAME_MAX_LENGTH = 120;

/** The questionnaires behind the listed responses, keyed by canonical url. */
export type QuestionnaireCatalog = Record<
	string,
	Pick<Questionnaire, "id" | "name" | "title" | "url" | "version"> & {
		/** Where the form's liquid templates are linked. */
		extension?: Parameters<typeof questionnaireTemplates>[0]["extension"];
	}
>;

export type ResponsePdfTarget = {
	formLabel: string;
	responseId: string;
	subject?: string;
	templateId: string;
};

export type RequestGroupPdfTarget = {
	formLabel: string;
	requestGroup: RequestGroup;
	subject?: string;
};

export type PdfExportTarget = ResponsePdfTarget | RequestGroupPdfTarget;

export function buildResponsePdfFileName(target: PdfExportTarget): string {
	const { formLabel, subject } = target;
	const resourceId =
		"requestGroup" in target
			? (target.requestGroup.id ?? "RequestGroup")
			: target.responseId;
	// The id keeps a bulk export from producing two identical names when the same
	// form was filled for the same subject twice.
	const idSuffix = resourceId.slice(0, 8);
	const parts = [formLabel, subject, idSuffix]
		.map((part) => part?.replace(UNSAFE_FILE_NAME_CHARS, " ").trim())
		.filter((part): part is string => Boolean(part));

	return `${parts.join(" - ").replace(/\s+/g, " ").slice(0, FILE_NAME_MAX_LENGTH)}.pdf`;
}

/** The liquid template the form is linked to for printing, if any. */
function getPrintTemplateId(
	questionnaire: QuestionnaireCatalog[string] | undefined,
) {
	if (!questionnaire) return undefined;
	return questionnaireTemplates(
		questionnaire as Questionnaire & typeof questionnaire,
	).find((template) => template.purpose === PRINT_PURPOSE)?.templateId;
}

function getResponseQuestionnaire(
	response: QuestionnaireResponse,
	questionnaireCatalog: QuestionnaireCatalog,
) {
	const reference = normalizeCanonicalReference(response.questionnaire);

	return reference ? questionnaireCatalog[reference] : undefined;
}

/** What the response is called in the list, and in an exported file name. */
function getResponseFormLabel(
	response: QuestionnaireResponse,
	questionnaireCatalog: QuestionnaireCatalog,
) {
	const questionnaire = getResponseQuestionnaire(
		response,
		questionnaireCatalog,
	);

	return (
		questionnaire?.title ??
		questionnaire?.name ??
		normalizeCanonicalReference(response.questionnaire) ??
		response.id ??
		"Questionnaire response"
	);
}

/**
 * A response the PDF export can work with, or `undefined` when there is
 * nothing to print it with: it was never persisted, or its form has no print
 * template.
 */
export function getResponsePdfTarget(
	response: QuestionnaireResponse,
	questionnaireCatalog: QuestionnaireCatalog,
): ResponsePdfTarget | undefined {
	const templateId = getPrintTemplateId(
		getResponseQuestionnaire(response, questionnaireCatalog),
	);
	if (!response.id || !templateId) {
		return undefined;
	}

	const subject = getQuestionnaireResponseSubjectLabel(response);

	return {
		formLabel: getResponseFormLabel(response, questionnaireCatalog),
		responseId: response.id,
		subject: subject || undefined,
		templateId,
	};
}

/** Any selected RequestGroup member exports its whole RequestGroup once. */
export function getResponsePdfTargets(
	responses: QuestionnaireResponse[],
	questionnaireCatalog: QuestionnaireCatalog,
	groups: ResponseGroup[],
	planDefinitions: PlanDefinition[],
) {
	const groupByResponse = new Map(
		groups.flatMap((group) =>
			group.responses.map((response) => [response.id, group] as const),
		),
	);
	const includedGroups = new Set<string>();
	const targets: PdfExportTarget[] = [];
	let skippedCount = 0;

	for (const response of responses) {
		const group = groupByResponse.get(response.id)?.requestGroup;
		if (group?.id) {
			if (includedGroups.has(group.id)) continue;
			includedGroups.add(group.id);
			const reference = group.instantiatesCanonical?.[0] ?? "";
			const planDefinition = planDefinitions.find(
				(planDefinition) =>
					(planDefinition.url || `PlanDefinition/${planDefinition.id}`) ===
					reference.split("|")[0],
			);
			targets.push({
				formLabel: planDefinition
					? getFormLabel(planDefinition)
					: reference || "Package",
				requestGroup: group,
				subject: group.subject?.display || group.subject?.reference,
			});
		} else {
			const target = getResponsePdfTarget(response, questionnaireCatalog);
			if (target) targets.push(target);
			else skippedCount++;
		}
	}

	return { targets, skippedCount };
}
