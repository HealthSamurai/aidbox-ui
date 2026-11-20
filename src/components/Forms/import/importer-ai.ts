import type { Questionnaire } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";

const ITEM_CONTROL_EXTENSION =
	"http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl";

export const SYSTEM_PROMPT = `You are an expert in converting medical forms into the FHIR SDC Questionnaire format. Your task is to help users convert scanned medical paper forms (in JPEG format) into a structured FHIR SDC-compliant questionnaire. You will:

1. Process the extracted text from OCR systems.
2. Identify and categorize all elements of the form such as:
    - Questions
    - Answer options
    - Question types (e.g., multiple choice, free text, checkbox)
    - Question groups and sections
    - Instructions or descriptive text
3. Convert these elements into a FHIR SDC Questionnaire format as JSON ensuring no element is ignored or skipped.

When converting, ensure to:
- Assign a unique linkId for each question.
- Set \`type\` for each question (e.g., boolean, choice, text, etc.).
- Include \`answerOption\` if choices are available with text specified in \`valueString\` key.
- Use \`group\` type for sections or groups of questions.
- Provide cardinality information for multiple-choice or required questions.
- Assign a title to the questionnaire
- Do not skip over chunks of text in the page, wrap them in a \`display\` type instead.

If the input lacks clarity, infer the form's structure based on typical clinical and administrative patterns.
Your output should always be a valid FHIR SDC Questionnaire resource, with draft status, in JSON format.`;

type QuestionnaireItem = NonNullable<Questionnaire["item"]>[number] & {
	answerOption?: GeneratedAnswerOption[];
	extension?: unknown[];
};

type GeneratedAnswerOption = {
	display?: string;
	text?: string;
	valueCoding?: { display?: string };
	valueString?: string;
	[key: string]: unknown;
};

function mapQuestionnaireItems(
	items: QuestionnaireItem[] | undefined,
	mapItem: (item: QuestionnaireItem) => QuestionnaireItem,
): QuestionnaireItem[] | undefined {
	return items?.map((item) => {
		const mapped = mapItem(item);
		return {
			...mapped,
			item: mapQuestionnaireItems(
				mapped.item as QuestionnaireItem[] | undefined,
				mapItem,
			),
		};
	});
}

function transformAnswerOption(option: GeneratedAnswerOption) {
	if (option.valueCoding) {
		return { valueCoding: option.valueCoding };
	}

	const display =
		option.valueString ??
		option.display ??
		option.text ??
		Object.values(option).find((value) => typeof value === "string");

	return display ? { valueCoding: { display } } : null;
}

function transformItem(item: QuestionnaireItem): QuestionnaireItem {
	const transformed: QuestionnaireItem = { ...item };

	if (
		transformed.type === "text" &&
		transformed.text?.toLowerCase().includes("signature")
	) {
		transformed.type = "attachment";
		transformed.extension = [
			{
				url: ITEM_CONTROL_EXTENSION,
				valueCodeableConcept: {
					coding: [
						{
							system: "http://aidbox.io/questionnaire-itemControl",
							code: "signature",
						},
					],
				},
			},
		];
	}

	if (transformed.answerOption) {
		transformed.answerOption = transformed.answerOption.flatMap((option) => {
			const nextOption = transformAnswerOption(option as GeneratedAnswerOption);
			return nextOption ? [nextOption] : [];
		}) as QuestionnaireItem["answerOption"];
	}

	return transformed;
}

export function transformGeneratedQuestionnaire(
	questionnaire: Questionnaire,
): Questionnaire {
	return {
		...questionnaire,
		item: mapQuestionnaireItems(
			questionnaire.item as QuestionnaireItem[] | undefined,
			transformItem,
		) as Questionnaire["item"],
	};
}
