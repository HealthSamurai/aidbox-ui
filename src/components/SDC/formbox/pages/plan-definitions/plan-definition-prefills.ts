import type { QuestionnaireItem } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import { compactFhirpath, fhirpathString } from "../../shared/fhirpath";
import { conditionAnswerType } from "./plan-definition-conditions";
import { planDefinitionAnswerExpression } from "./plan-definition-expressions";
import type { PlanDefinitionQuestion } from "./plan-definition-model";

// Preserve the lexical FHIR values, including seconds and time zones.
const timePattern = "([01][0-9]|2[0-3]):[0-5][0-9]:([0-5][0-9]|60)(\\.[0-9]+)?";
const dateTimePattern = `[0-9]{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01])(T${timePattern}(Z|[+-]((0[0-9]|1[0-3]):[0-5][0-9]|14:00)))?)?)?`;

const textConversions = {
	string: "",
	boolean: "toString()",
	integer: "toString()",
	decimal: "toString()",
	date: "toString()",
	dateTime: "toString()",
	time: "toString()",
	coding: "iif(display.exists(), display, code)",
	"open-choice":
		"iif($this is FHIR.Coding, iif(display.exists(), display, code), toString())",
	reference: "iif(display.exists(), display, reference)",
	quantity:
		"value.toString() & iif(unit.exists(), ' ' & unit, iif(code.exists(), ' ' & code, ''))",
};
const conversions: Record<string, Record<string, string>> = {
	string: textConversions,
	"open-choice": { ...textConversions, coding: "" },
	boolean: {
		string: "toBoolean()",
		integer: "toBoolean()",
		decimal: "toBoolean()",
	},
	integer: {
		string: "toInteger()",
		boolean: "toInteger()",
		decimal: "iif($this = truncate(), toInteger(), {})",
	},
	decimal: {
		string: "toDecimal()",
		boolean: "toDecimal()",
		integer: "toDecimal()",
	},
	date: {
		string: "toDate()",
		dateTime: "toString().substring(0, 10).toDate()",
	},
	dateTime: {
		string: `iif(matches(${fhirpathString(`^${dateTimePattern}$`)}), iif(substring(0, 10).toDate().exists(), $this, {}), {})`,
		date: "toString()",
	},
	time: {
		string: `iif(matches(${fhirpathString(`^${timePattern}$`)}), $this, {})`,
	},
};

/** Copy a source answer, converting each value to the target's supported type. */
export function prefillExpression(
	source: PlanDefinitionQuestion,
	target: QuestionnaireItem,
): string | undefined {
	const sourceType =
		source.item.type === "attachment" || source.item.type === "open-choice"
			? source.item.type
			: conditionAnswerType(source.item);
	const targetType =
		target.type === "attachment" || target.type === "open-choice"
			? target.type
			: conditionAnswerType(target);
	if (
		["group", "display"].includes(target.type) ||
		(target.type === "choice" && targetType !== "coding")
	)
		return undefined;

	const conversion =
		sourceType === targetType ? "" : conversions[targetType]?.[sourceType];
	if (conversion === undefined) return undefined;

	const path = planDefinitionAnswerExpression(
		source.actionId,
		source.item.linkId,
	);
	return `${path}${conversion ? `.select(${conversion})` : ""}${target.repeats ? "" : ".first()"}`;
}

/** Recognize generated prefills without interpreting or replacing custom expressions. */
export function parsePrefillSource(
	expression: string,
	target: QuestionnaireItem | undefined,
	questions: PlanDefinitionQuestion[],
): PlanDefinitionQuestion | undefined {
	if (!target || !expression.trim()) return undefined;
	const compact = compactFhirpath(expression);
	if (!compact) return undefined;
	return questions.find((source) => {
		const generated = prefillExpression(source, target);
		return generated !== undefined && compactFhirpath(generated) === compact;
	});
}
