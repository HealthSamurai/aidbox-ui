import type { FhirpathVariable } from "@aidbox-ui/components/Forms/editor/fhirpath-editor";
import { useOperationOutcomeError } from "@aidbox-ui/components/Forms/editor/operation-outcome-context";
import type { QuestionnaireItem } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { cn, IconButton } from "@health-samurai/react-components";
import { Trash2 } from "lucide-react";
import {
	PlanDefinitionFieldError,
	planDefinitionFieldAttributes,
} from "./plan-definition-fields";
import type { PlanDefinitionQuestion } from "./plan-definition-model";
import { PlanDefinitionPrefillSource } from "./plan-definition-prefill-source";
import {
	parsePrefillSource,
	prefillExpression,
} from "./plan-definition-prefills";
import { PlanDefinitionQuestionSelect } from "./plan-definition-question-select";
import type { IndexedPrefillRule, PrefillRule } from "./plan-definition-rules";

type PrefillRuleEditorProps = {
	rule: PrefillRule;
	index: number;
	actionPath: string;
	actionIndex: number;
	compiledRule?: IndexedPrefillRule;
	targets: QuestionnaireItem[];
	targetQuestions: PlanDefinitionQuestion[];
	prefillQuestions: PlanDefinitionQuestion[];
	loadingForms: boolean;
	advanced: boolean;
	variables: FhirpathVariable[];
	errors: Record<string, string>;
	onAdvancedChange: (value: boolean) => void;
	onChange: (patch: Partial<PrefillRule>) => void;
	onRemove: () => void;
};

export function PrefillRuleEditor({
	rule,
	index,
	actionPath,
	actionIndex,
	compiledRule,
	targets,
	targetQuestions,
	prefillQuestions,
	loadingForms,
	advanced,
	variables,
	errors,
	onAdvancedChange,
	onChange,
	onRemove,
}: PrefillRuleEditorProps) {
	const id = rule.id ?? String(index);
	const path = `${actionPath}.prefill.${rule.id ?? index}`;
	const targetError =
		useOperationOutcomeError(
			compiledRule && compiledRule.targetLinkIdIndex >= 0
				? new RegExp(
						`^PlanDefinition\\.action\\[${actionIndex}\\]\\.extension\\[${compiledRule.extensionIndex}\\]\\.extension\\[${compiledRule.targetLinkIdIndex}\\](?:\\.|\\[|$)`,
					)
				: undefined,
		) ?? errors[`${path}.targetLinkId`];
	const expressionError =
		useOperationOutcomeError(
			compiledRule && compiledRule.expressionIndex >= 0
				? new RegExp(
						`^PlanDefinition\\.action\\[${actionIndex}\\]\\.extension\\[${compiledRule.extensionIndex}\\]\\.extension\\[${compiledRule.expressionIndex}\\](?:\\.|\\[|$)`,
					)
				: undefined,
		) ?? errors[`${path}.expression`];
	const target = targets.find((item) => item.linkId === rule.targetLinkId);
	return (
		<fieldset
			aria-label={`Prefill ${index + 1}`}
			className="plan-definition-rule-highlight-row flex min-w-0 items-start gap-2"
			data-test-id="plan-definition-editor__prefill-row"
			data-prefill-id={id}
			data-rule-path={`${path}.expression`}
		>
			<IconButton
				variant="ghost"
				aria-label={`Remove prefill ${index + 1}`}
				title="Remove prefill"
				className="size-8 shrink-0"
				onClick={onRemove}
				icon={<Trash2 className="size-4" />}
			/>
			<div className="flex min-h-8 min-w-0 flex-1 flex-wrap items-start gap-x-2 gap-y-1 text-sm text-text-primary">
				<span className="flex h-8 shrink-0 items-center whitespace-nowrap">
					Prefill
				</span>
				<div className="min-w-0 space-y-1.5">
					<PlanDefinitionQuestionSelect
						id={`prefill-${index}-target`}
						aria-label={`Prefill ${index + 1} target`}
						groupByAction={false}
						items={targetQuestions}
						selectedItem={targetQuestions.find(
							(question) => question.item.linkId === rule.targetLinkId,
						)}
						isLoading={loadingForms}
						placeholder="Choose a question to prefill"
						searchPlaceholder="Search target questions..."
						testId="plan-definition-prefill__target"
						{...planDefinitionFieldAttributes(
							targetError,
							`prefill-${index}-target-error`,
						)}
						onSelect={(question) => {
							const source = parsePrefillSource(
								rule.expression,
								target,
								prefillQuestions,
							);
							const nextTarget = question.item;
							onChange({
								targetLinkId: nextTarget.linkId,
								expression: source
									? (prefillExpression(source, nextTarget) ?? "")
									: rule.expression,
							});
						}}
					/>
					<PlanDefinitionFieldError
						id={`prefill-${index}-target-error`}
						message={targetError}
					/>
				</div>
				<span className="flex h-8 shrink-0 items-center whitespace-nowrap">
					with
				</span>
				<div
					className={cn("min-w-0 space-y-1.5", advanced && "min-w-48 flex-1")}
				>
					<PlanDefinitionPrefillSource
						label={`Prefill ${index + 1}`}
						target={target}
						questions={prefillQuestions}
						loading={loadingForms}
						advanced={advanced}
						variables={variables}
						invalid={Boolean(expressionError)}
						describedBy={
							expressionError ? `prefill-${index}-expression-error` : undefined
						}
						value={rule.expression}
						onChange={(expression) => {
							onAdvancedChange(advanced);
							onChange({ expression });
						}}
					/>
					<PlanDefinitionFieldError
						id={`prefill-${index}-expression-error`}
						message={expressionError}
					/>
				</div>
			</div>
		</fieldset>
	);
}
