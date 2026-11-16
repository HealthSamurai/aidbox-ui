import type {
	PlanDefinition,
	PlanDefinitionAction,
	Questionnaire,
	QuestionnaireItem,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import { generateId } from "../../../../../utils";
import { getFormLabel } from "../../api/forms";
import { canonical } from "../../api/plan-definitions";
import { PLAN_DEFINITION_TYPE_SYSTEM } from "../../shared/const";
import { fhirpathVariables } from "../../shared/fhirpath";
import type { ConditionEditorDraft } from "./plan-definition-conditions";
import {
	buildPlanDefinitionAction,
	getPrefills,
	planDefinitionRules,
} from "./plan-definition-rules";

type PrefillExtension = {
	id?: string;
	url: string;
	extension?: Array<{
		url: string;
		valueString?: string;
		valueExpression?: { language: string; expression: string };
	}>;
};
export type PlanDefinitionActionDraft = PlanDefinitionAction & {
	extension?: PrefillExtension[];
	conditionEditor?: ConditionEditorDraft;
};

export type PlanDefinitionDraft = Omit<PlanDefinition, "action"> & {
	action?: PlanDefinitionActionDraft[];
};

export type PlanDefinitionQuestion = {
	actionId: string;
	actionTitle: string;
	actionIndex?: number;
	item: QuestionnaireItem;
	ancestors?: QuestionnaireItem[];
};

export function planDefinitionQuestionActionLabel(
	question: PlanDefinitionQuestion,
): string {
	return question.actionIndex === undefined
		? question.actionTitle
		: `${question.actionIndex + 1}: ${question.actionTitle}`;
}

/** List answer sources, including questions beneath nested and repeating items. */
export function planDefinitionQuestions(
	actionId: string,
	actionTitle: string,
	items: QuestionnaireItem[] = [],
	ancestors: QuestionnaireItem[] = [],
): PlanDefinitionQuestion[] {
	return items.flatMap((item) => [
		...(["group", "display"].includes(item.type)
			? []
			: [{ actionId, actionTitle, item, ancestors }]),
		...planDefinitionQuestions(actionId, actionTitle, item.item, [
			...ancestors,
			item,
		]),
	]);
}

const RESERVED_ACTION_IDS = [
	"patient",
	"requestGroup",
	"responses",
	"resource",
	"context",
];

/** Generate a unique, FHIRPath-friendly action ID from its title. */
export function generateActionId(
	title: string,
	actions: PlanDefinitionActionDraft[],
): string {
	const words =
		title
			.normalize("NFKD")
			.replace(/\p{M}/gu, "")
			.match(/[A-Za-z0-9]+/g) ?? [];
	let base =
		words
			.map((word, index) =>
				index
					? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
					: word.toLowerCase(),
			)
			.join("") || "form";
	if (!/^[A-Za-z]/.test(base)) base = `form${base}`;
	if (RESERVED_ACTION_IDS.includes(base)) base += "Form";
	let id = base.slice(0, 64);
	let number = 2;
	while (actions.some((action) => action.id === id)) {
		const suffix = String(number++);
		id = base.slice(0, 64 - suffix.length) + suffix;
	}
	return id;
}

/** Create a form action with a unique ID and a versioned questionnaire reference. */
export function questionnaireAction(
	questionnaire: Questionnaire,
	actions: PlanDefinitionActionDraft[],
): PlanDefinitionActionDraft {
	const title = getFormLabel(questionnaire);
	return {
		id: generateActionId(title, actions),
		title,
		definitionCanonical: canonical(questionnaire),
	};
}

/** Generate a title-based PlanDefinition canonical, preserving custom builder prefixes. */
export function generatePlanDefinitionUrl(
	title: string,
	prefix?: string,
): string {
	const urlPrefix =
		prefix === undefined || prefix === "http://forms.aidbox.io/questionnaire/"
			? "http://forms.aidbox.io/plan-definition/"
			: prefix;
	return (
		urlPrefix +
		title
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, " ")
			.trim()
			.replace(/ /g, "-")
	);
}

export function newPlanDefinition(
	questionnaires: Questionnaire[] = [],
	urlPrefix?: string,
): PlanDefinition {
	const id = generateId();
	const title = "New Package";
	const actions: PlanDefinitionActionDraft[] = [];
	for (const questionnaire of questionnaires)
		actions.push(questionnaireAction(questionnaire, actions));
	return {
		resourceType: "PlanDefinition",
		id,
		url: generatePlanDefinitionUrl(title, urlPrefix),
		version: "1",
		status: "draft",
		title,
		type: {
			coding: [
				{ system: PLAN_DEFINITION_TYPE_SYSTEM, code: "plan-definition" },
			],
		},
		action: actions,
	};
}

/** Build the resource for saving and previewing without changing unfinished editor inputs. */
export function buildPlanDefinition(
	planDefinition: PlanDefinitionDraft,
): PlanDefinition {
	const resource = {
		...planDefinition,
		action: planDefinition.action?.map(buildPlanDefinitionAction),
	};
	return JSON.parse(
		JSON.stringify(resource, (_name, value: unknown) =>
			value === "" || (Array.isArray(value) && value.length === 0)
				? undefined
				: value,
		),
	) as PlanDefinition;
}

/** Answer targets inside repeating groups cannot be assigned an unambiguous prefill. */
export function answerItems(
	items: QuestionnaireItem[] = [],
): QuestionnaireItem[] {
	return items.flatMap((item) =>
		item.type === "group"
			? item.repeats
				? []
				: answerItems(item.item)
			: item.type === "display"
				? []
				: [item, ...(!item.repeats ? answerItems(item.item) : [])],
	);
}

/** Locate validation messages by field, using rule IDs preserved by the resource builder. */
export function planDefinitionErrors(
	planDefinition: PlanDefinition,
): Record<string, string> {
	const errors: Record<string, string> = {};
	if (!planDefinition.title?.trim()) errors.title = "Required.";
	if (!planDefinition.url?.trim()) errors.url = "Required.";
	if (!planDefinition.action?.length)
		errors.action = "The package has no forms.";
	const ids = new Map<string, number>();
	for (const action of planDefinition.action ?? [])
		if (action.id) ids.set(action.id, (ids.get(action.id) ?? 0) + 1);
	for (const [index, action] of (planDefinition.action ?? []).entries()) {
		const path = `action.${index}`;
		if (!action.id) errors[`${path}.id`] = "Required.";
		else if (action.id.length > 64)
			errors[`${path}.id`] = "Longer than 64 characters.";
		else if (!/^[A-Za-z0-9.-]{1,64}$/.test(action.id))
			errors[`${path}.id`] =
				"Contains characters other than letters, numbers, dots or hyphens.";
		else if (RESERVED_ACTION_IDS.includes(action.id))
			errors[`${path}.id`] = "Already used by the system.";
		else if ((ids.get(action.id) ?? 0) > 1)
			errors[`${path}.id`] = "Already used by another form.";
		if (!action.definitionCanonical)
			errors[`${path}.definitionCanonical`] = "Required.";
		if (
			action.action?.length ||
			action.dynamicValue?.length ||
			action.relatedAction?.length ||
			action.definitionUri ||
			(action.selectionBehavior && action.selectionBehavior !== "all")
		)
			errors[path] = "Some settings aren’t supported by this editor.";
		action.condition?.forEach((condition, conditionIndex) => {
			const conditionPath = `${path}.condition.${condition.id ?? conditionIndex}`;
			if (
				condition.kind !== "applicability" ||
				condition.expression?.language !== "text/fhirpath"
			)
				errors[conditionPath] = "This type of rule isn’t supported.";
			else if (!condition.expression?.expression?.trim())
				errors[conditionPath] = "Required.";
		});
		getPrefills(action).forEach((rule, ruleIndex) => {
			const rulePath = `${path}.prefill.${rule.id ?? ruleIndex}`;
			if (!rule.targetLinkId?.trim())
				errors[`${rulePath}.targetLinkId`] = "Required.";
			if (!rule.expression.trim())
				errors[`${rulePath}.expression`] = "Required.";
		});
	}
	return {
		...errors,
		...planDefinitionDependencyErrors(planDefinition.action ?? []),
	};
}

/** Check condition cycles and prefills that need answers from dependent forms. */
export function planDefinitionDependencyErrors(
	actions: PlanDefinitionAction[],
): Record<string, string> {
	const errors: Record<string, string> = {};
	const formNames = new Map(
		actions.flatMap((action, index) =>
			action.id
				? [[action.id, action.title?.trim() || `Form ${index + 1}`] as const]
				: [],
		),
	);
	// Missing or duplicate IDs must be fixed before references are unambiguous.
	if (formNames.size !== actions.length) return errors;
	const rules = planDefinitionRules(actions).map((rule) => ({
		...rule,
		references: [...fhirpathVariables(rule.expression)].filter((name) =>
			formNames.has(name),
		),
	}));
	const dependencies = new Map(
		[...formNames.keys()].map((actionId) => [actionId, new Set<string>()]),
	);
	for (const rule of rules.filter((rule) => rule.kind === "condition"))
		for (const reference of rule.references)
			dependencies.get(rule.actionId)?.add(reference);
	for (const rule of rules) {
		const pending = rule.references.map((reference) => [
			rule.actionId,
			reference,
		]);
		const visited = new Set<string>();
		let conflict: string[] | undefined;
		for (const path of pending) {
			const actionId = path.at(-1);
			if (!actionId || visited.has(actionId)) continue;
			visited.add(actionId);
			if (actionId === rule.actionId) {
				conflict = path;
				break;
			}
			for (const reference of dependencies.get(actionId) ?? [])
				pending.push([...path, reference]);
		}
		if (!conflict) continue;
		if (rule.kind === "prefill")
			errors[rule.path] =
				conflict.length === 2
					? "This form’s own answers aren’t ready when it is first shown."
					: `“${formNames.get(conflict[1] ?? "")}” needs answers from this form before it can be shown.`;
		else {
			const names = conflict
				.slice(0, -1)
				.map((id) => `“${formNames.get(id)}”`)
				.join(", ");
			errors[rule.path] =
				conflict.length === 2
					? "This form needs its own answers before it can be shown."
					: `These forms need each other’s answers before they can be shown: ${names}.`;
		}
	}
	return errors;
}

export function findQuestionnaire(
	action: PlanDefinitionAction,
	questionnaires: Questionnaire[],
) {
	const [url, version] = (action.definitionCanonical ?? "").split("|");
	return questionnaires.find(
		(questionnaire) =>
			(questionnaire.url === url ||
				`Questionnaire/${questionnaire.id}` === url) &&
			(!version || questionnaire.version === version),
	);
}
