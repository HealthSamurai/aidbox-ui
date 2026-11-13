import type { Questionnaire } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import { planDefinitionExpressionSources } from "./plan-definition-expressions";
import {
	type PlanDefinitionActionDraft,
	planDefinitionQuestions,
} from "./plan-definition-model";
import { planDefinitionRules } from "./plan-definition-rules";

export type PlanDefinitionGraphEdge = {
	id: string;
	kind: "condition" | "prefill";
	sourceIndex: number;
	sourceLinkId?: string;
	targetIndex: number;
	targetLinkId?: string;
	expression: string;
	path: string;
	issuePattern: RegExp;
};

export type PlanDefinitionRuleItem = {
	linkId?: string;
	label: string;
	type?: string;
};

/** Show only items referenced by a graph edge. */
export function planDefinitionRuleItems(
	action: PlanDefinitionActionDraft,
	questionnaire: Questionnaire | undefined,
	index: number,
	connections: PlanDefinitionGraphEdge[],
): PlanDefinitionRuleItem[] {
	const sourceItems = planDefinitionQuestions(
		action.id ?? "",
		action.title ?? "",
		questionnaire?.item,
	);
	const connectedSources = new Set<string>();
	const connectedTargets = new Set<string>();
	for (const edge of connections) {
		if (edge.sourceIndex === index && edge.sourceLinkId !== undefined)
			connectedSources.add(edge.sourceLinkId);
		if (edge.targetIndex === index && edge.targetLinkId !== undefined)
			connectedTargets.add(edge.targetLinkId);
	}
	const connectedItems = new Set([...connectedSources, ...connectedTargets]);
	const visible: PlanDefinitionRuleItem[] = sourceItems
		.filter(({ item }) => connectedItems.has(item.linkId))
		.map(({ item }) => ({
			linkId: item.linkId,
			label: item.text || item.linkId,
			type: item.type,
		}));
	// Keep existing references visible when a questionnaire changes or cannot load.
	for (const linkId of connectedItems)
		if (!visible.some((item) => item.linkId === linkId))
			visible.push({
				linkId,
				label: linkId,
			});
	return visible;
}

/** Derive connections from the same rules used by Save, Code, Preview, and validation. */
export function planDefinitionGraphEdges(
	actions: PlanDefinitionActionDraft[],
): PlanDefinitionGraphEdge[] {
	const sourceIndices = new Map<string, number | null>();
	actions.forEach((action, index) => {
		if (action.id)
			sourceIndices.set(action.id, sourceIndices.has(action.id) ? null : index);
	});
	return planDefinitionRules(actions).flatMap(
		({ actionId: _actionId, ...rule }) => {
			const edges = new Map<string, PlanDefinitionGraphEdge>();
			for (const source of planDefinitionExpressionSources(rule.expression)) {
				const sourceIndex = sourceIndices.get(source.actionId);
				if (sourceIndex === undefined || sourceIndex === null) continue;
				const id = JSON.stringify([rule.path, sourceIndex, source.linkId]);
				edges.set(id, {
					...rule,
					id,
					sourceIndex,
					sourceLinkId: source.linkId,
				});
			}
			return [...edges.values()];
		},
	);
}
