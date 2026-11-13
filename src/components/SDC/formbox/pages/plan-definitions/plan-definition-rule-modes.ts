import type {
	PlanDefinitionActionCondition,
	QuestionnaireItem,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import { useMemo, useState } from "react";
import { parseConditions } from "./plan-definition-conditions";
import type {
	PlanDefinitionActionDraft,
	PlanDefinitionQuestion,
} from "./plan-definition-model";
import { parsePrefillSource } from "./plan-definition-prefills";
import { getPrefills } from "./plan-definition-rules";

export type PlanDefinitionAdvancedMode = {
	checked: boolean;
	disabled: boolean;
	onChange: (checked: boolean) => void;
	description?: string;
};

/** Keep the header toggle and every rule editor in the same editing mode. */
export function usePlanDefinitionRuleModes({
	action,
	actionKey,
	questions,
	actions,
	prefillQuestions,
	targets,
	loading,
	compiledConditions,
	onChange,
}: {
	action?: PlanDefinitionActionDraft;
	actionKey?: string;
	questions: PlanDefinitionQuestion[];
	actions: PlanDefinitionActionDraft[];
	prefillQuestions: PlanDefinitionQuestion[];
	targets: QuestionnaireItem[];
	loading: boolean;
	compiledConditions?: PlanDefinitionActionCondition[];
	onChange: (action: PlanDefinitionActionDraft) => void;
}) {
	const [prefillModes, setPrefillModes] = useState<Record<string, boolean>>({});
	const parsed = useMemo(
		() =>
			parseConditions(
				action?.condition,
				questions,
				actions.flatMap((action) => (action.id ? [action.id] : [])),
			),
		[action?.condition, questions, actions],
	);
	const conditionRules = action?.conditionEditor?.rules ?? parsed;
	const conditionMode =
		action?.conditionEditor?.mode ?? (parsed ? "rules" : "expression");
	const customPrefills = getPrefills(action).some(
		(rule) =>
			Boolean(rule.expression.trim()) &&
			!parsePrefillSource(
				rule.expression,
				targets.find((item) => item.linkId === rule.targetLinkId),
				prefillQuestions,
			),
	);
	const prefillAdvanced = Boolean(
		(actionKey && prefillModes[actionKey]) || customPrefills,
	);
	const setPrefillAdvanced = (checked: boolean) => {
		if (actionKey)
			setPrefillModes((current) =>
				current[actionKey] === checked
					? current
					: { ...current, [actionKey]: checked },
			);
	};
	const controls: Record<string, PlanDefinitionAdvancedMode | undefined> = {};
	if (action) {
		controls.condition = {
			checked: conditionMode === "expression",
			disabled: conditionMode === "expression" && (!conditionRules || loading),
			onChange: (checked) => {
				if (checked)
					onChange({
						...action,
						condition:
							action.conditionEditor?.mode === "rules" &&
							action.conditionEditor.rules
								? compiledConditions
								: action.condition,
						conditionEditor: {
							mode: "expression",
							rules: action.conditionEditor?.rules,
						},
					});
				else if (conditionRules)
					onChange({
						...action,
						conditionEditor: {
							mode: "rules",
							rules: action.conditionEditor?.rules,
						},
					});
			},
		};
		controls.prefill = {
			checked: prefillAdvanced,
			disabled: customPrefills || loading,
			onChange: setPrefillAdvanced,
			description: customPrefills
				? "Some expressions use features outside the source selector."
				: undefined,
		};
	}
	return {
		conditionMode,
		conditionRules,
		prefillAdvanced,
		setPrefillAdvanced,
		controls,
		reset: () => setPrefillModes({}),
	};
}
