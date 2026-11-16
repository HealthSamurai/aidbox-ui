import type {
	PlanDefinition,
	Questionnaire,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import { useState } from "react";
import { generateId } from "../../../../../utils";
import type { PlanDefinitionGraphEdge } from "./plan-definition-graph-model";
import {
	generateActionId,
	type PlanDefinitionActionDraft,
	type PlanDefinitionDraft,
	questionnaireAction,
} from "./plan-definition-model";

type PlanDefinitionSelection =
	| number
	| "plan-definition"
	| PlanDefinitionGraphEdge
	| null;

/** Give editable rules stable identities, including unfinished rules omitted on save. */
export function editablePlanDefinition(
	source: PlanDefinition,
): PlanDefinitionDraft {
	return {
		...source,
		action: source.action?.map((action: PlanDefinitionActionDraft) => ({
			...action,
			condition: action.condition?.map((condition) => ({
				...condition,
				id: condition.id ?? generateId(),
			})),
			extension: action.extension?.map((extension) => ({
				...extension,
				id: extension.id ?? generateId(),
			})),
		})),
	};
}

function selectedActionIndex(selection: PlanDefinitionSelection) {
	if (typeof selection === "number") return selection;
	return selection === "plan-definition"
		? null
		: (selection?.targetIndex ?? null);
}

function initialDraft(planDefinition: PlanDefinitionDraft) {
	return {
		planDefinition,
		actionKeys: (planDefinition.action ?? []).map(() => generateId()),
		selection: null as PlanDefinitionSelection,
	};
}

/** Change actions, their UI identities, and selection together. FHIR IDs remain editable. */
export function usePlanDefinitionDraft(
	createPlanDefinition: () => PlanDefinitionDraft,
) {
	const [draft, setDraft] = useState(() =>
		initialDraft(createPlanDefinition()),
	);
	const selectedIndex = selectedActionIndex(draft.selection);

	return {
		...draft,
		selectedIndex,
		selectedEdge: typeof draft.selection === "object" ? draft.selection : null,
		setSelection: (selection: PlanDefinitionSelection) =>
			setDraft((current) => ({ ...current, selection })),
		updatePlanDefinition: (
			properties: Partial<Omit<PlanDefinitionDraft, "action">>,
		) =>
			setDraft((current) => ({
				...current,
				planDefinition: { ...current.planDefinition, ...properties },
			})),
		replacePlanDefinition: (planDefinition: PlanDefinitionDraft) =>
			setDraft(initialDraft(planDefinition)),
		updateAction: (action: PlanDefinitionActionDraft) =>
			setDraft((current) => ({
				...current,
				planDefinition: {
					...current.planDefinition,
					action: current.planDefinition.action?.map((value, index) =>
						index === selectedActionIndex(current.selection) ? action : value,
					),
				},
			})),
		addForms: (questionnaires: Questionnaire[]) => {
			if (!questionnaires.length) return;
			const keys = questionnaires.map(() => generateId());
			setDraft((current) => {
				const actions = [...(current.planDefinition.action ?? [])];
				const selection = actions.length;
				for (const questionnaire of questionnaires)
					actions.push(questionnaireAction(questionnaire, actions));
				return {
					planDefinition: { ...current.planDefinition, action: actions },
					actionKeys: [...current.actionKeys, ...keys],
					selection,
				};
			});
		},
		duplicateAction: (index: number) => {
			const key = generateId();
			setDraft((current) => {
				const actions = [...(current.planDefinition.action ?? [])];
				const action = actions[index];
				if (!action) return current;
				actions.splice(index + 1, 0, {
					...action,
					id: generateActionId(action.title ?? "Form", actions),
				});
				const actionKeys = [...current.actionKeys];
				actionKeys.splice(index + 1, 0, key);
				return {
					planDefinition: { ...current.planDefinition, action: actions },
					actionKeys,
					selection: index + 1,
				};
			});
		},
		deleteAction: (index: number) =>
			setDraft((current) => {
				if (!current.planDefinition.action?.[index]) return current;
				const selected = selectedActionIndex(current.selection);
				return {
					planDefinition: {
						...current.planDefinition,
						action: current.planDefinition.action.filter(
							(_, position) => position !== index,
						),
					},
					actionKeys: current.actionKeys.filter(
						(_, position) => position !== index,
					),
					selection:
						selected === null
							? current.selection
							: selected === index
								? null
								: selected > index
									? selected - 1
									: selected,
				};
			}),
		reorderActions: (from: number, to: number) =>
			setDraft((current) => {
				const actions = [...(current.planDefinition.action ?? [])];
				if (
					from === to ||
					from < 0 ||
					to < 0 ||
					from >= actions.length ||
					to >= actions.length
				)
					return current;
				const selected = selectedActionIndex(current.selection);
				const actionKeys = [...current.actionKeys];
				actions.splice(to, 0, ...actions.splice(from, 1));
				actionKeys.splice(to, 0, ...actionKeys.splice(from, 1));
				return {
					planDefinition: { ...current.planDefinition, action: actions },
					actionKeys,
					selection:
						selected === null
							? current.selection
							: actionKeys.indexOf(current.actionKeys[selected] ?? ""),
				};
			}),
	};
}
