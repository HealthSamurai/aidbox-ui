import {
	ResourceSearchSelect,
	type ResourceSearchSelectProps,
} from "../questionnaires/resource-search-select";
import {
	type PlanDefinitionQuestion,
	planDefinitionQuestionActionLabel,
} from "./plan-definition-model";

/** Show answerable questions in their questionnaire hierarchy. */
export function PlanDefinitionQuestionSelect({
	groupByAction = true,
	...props
}: Omit<
	ResourceSearchSelectProps<PlanDefinitionQuestion>,
	"getKey" | "getLabel" | "getTitle" | "getGroup" | "getAncestors" | "inline"
> & { groupByAction?: boolean }) {
	return (
		<ResourceSearchSelect
			{...props}
			inline
			getKey={(question) =>
				JSON.stringify([question.actionId, question.item.linkId])
			}
			getLabel={(question) => question.item.text || question.item.linkId}
			getTitle={planDefinitionQuestionActionLabel}
			getGroup={
				groupByAction
					? (question) => ({
							key: question.actionId,
							label: planDefinitionQuestionActionLabel(question),
						})
					: undefined
			}
			getAncestors={(question) =>
				(question.ancestors ?? []).map((item) => ({
					key: JSON.stringify([question.actionId, item.linkId]),
					label: item.text || item.linkId,
				}))
			}
		/>
	);
}
