import { ACTION_QUESTIONNAIRE_ANSWER_MAPPING_URL } from "@aidbox-ui/components/Forms/api/plan-definitions";
import { conditionExpression } from "./plan-definition-conditions";
import type { PlanDefinitionActionDraft } from "./plan-definition-model";

export type PrefillRule = {
	id?: string;
	targetLinkId: string;
	expression: string;
};

export type IndexedPrefillRule = PrefillRule & {
	extensionIndex: number;
	targetLinkIdIndex: number;
	expressionIndex: number;
};

/** Read the prefill rules of the selected action. */
export function getPrefills(
	action?: PlanDefinitionActionDraft,
): IndexedPrefillRule[] {
	return (action?.extension ?? []).flatMap((extension, extensionIndex) => {
		if (extension.url !== ACTION_QUESTIONNAIRE_ANSWER_MAPPING_URL) return [];
		const targetLinkIdIndex =
			extension.extension?.findIndex((item) => item.url === "targetLinkId") ??
			-1;
		const expressionIndex =
			extension.extension?.findIndex((item) => item.url === "expression") ?? -1;
		return [
			{
				id: extension.id,
				extensionIndex,
				targetLinkIdIndex,
				expressionIndex,
				targetLinkId:
					extension.extension?.[targetLinkIdIndex]?.valueString ?? "",
				expression:
					extension.extension?.[expressionIndex]?.valueExpression?.expression ??
					"",
			},
		];
	});
}

export function setPrefills(
	action: PlanDefinitionActionDraft,
	rules: PrefillRule[],
): PlanDefinitionActionDraft {
	return {
		...action,
		extension: [
			...(action.extension ?? []).filter(
				(extension) =>
					extension.url !== ACTION_QUESTIONNAIRE_ANSWER_MAPPING_URL,
			),
			...rules.map((rule) => ({
				id: rule.id,
				url: ACTION_QUESTIONNAIRE_ANSWER_MAPPING_URL,
				extension: [
					{ url: "targetLinkId", valueString: rule.targetLinkId },
					{
						url: "expression",
						valueExpression: {
							language: "text/fhirpath",
							expression: rule.expression,
						},
					},
				],
			})),
		],
	};
}

/** Compile editor rules without serializing an entire resource. */
export function buildPlanDefinitionAction(
	action: PlanDefinitionActionDraft,
): Omit<PlanDefinitionActionDraft, "conditionEditor"> {
	const { condition, extension, conditionEditor, ...properties } = action;
	const expression =
		conditionEditor?.mode === "rules" && conditionEditor.rules
			? conditionExpression(conditionEditor.rules)
			: undefined;
	const conditions =
		conditionEditor?.mode === "rules" && conditionEditor.rules
			? expression
				? [
						{
							id: conditionEditor.rules?.id,
							kind: "applicability" as const,
							expression: { language: "text/fhirpath", expression },
						},
					]
				: []
			: condition?.filter((rule) => rule.expression?.expression?.trim());
	const extensions = extension?.filter(
		(rule) =>
			rule.url !== ACTION_QUESTIONNAIRE_ANSWER_MAPPING_URL ||
			(rule.extension
				?.find((part) => part.url === "targetLinkId")
				?.valueString?.trim() &&
				rule.extension
					?.find((part) => part.url === "expression")
					?.valueExpression?.expression?.trim()),
	);
	return {
		...properties,
		...(conditions?.length && { condition: conditions }),
		...(extensions?.length && { extension: extensions }),
	};
}

type PlanDefinitionRule = {
	kind: "condition" | "prefill";
	actionId: string;
	targetIndex: number;
	targetLinkId?: string;
	path: string;
	issuePattern: RegExp;
	expression: string;
};

/** One rule address shared by dependency errors, graph edges, and editor highlighting. */
export function planDefinitionRules(
	actions: PlanDefinitionActionDraft[],
): PlanDefinitionRule[] {
	return actions.flatMap((draft, targetIndex) => {
		const action = buildPlanDefinitionAction(draft);
		return [
			...(action.condition ?? []).flatMap((condition, index) =>
				condition.kind === "applicability" &&
				condition.expression?.language === "text/fhirpath"
					? [
							{
								kind: "condition" as const,
								actionId: action.id ?? "",
								targetIndex,
								path: `action.${targetIndex}.condition.${condition.id ?? index}`,
								issuePattern: new RegExp(
									`^PlanDefinition\\.action\\[${targetIndex}\\]\\.condition\\[${index}\\](?:\\.|\\[|$)`,
								),
								expression: condition.expression.expression ?? "",
							},
						]
					: [],
			),
			...getPrefills(action).map((rule, index) => ({
				kind: "prefill" as const,
				actionId: action.id ?? "",
				targetIndex,
				targetLinkId: rule.targetLinkId,
				path: `action.${targetIndex}.prefill.${rule.id ?? index}.expression`,
				issuePattern: new RegExp(
					`^PlanDefinition\\.action\\[${targetIndex}\\]\\.extension\\[${rule.extensionIndex}\\](?:\\.|\\[|$)`,
				),
				expression: rule.expression,
			})),
		];
	});
}
