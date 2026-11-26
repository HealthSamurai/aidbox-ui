import type { FhirpathVariable } from "@aidbox-ui/components/Forms/editor/fhirpath-editor";
import type { QuestionnaireItem } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { generateId } from "@aidbox-ui/utils";
import { Button } from "@health-samurai/react-components";
import { Plus } from "lucide-react";
import type {
	PlanDefinitionActionDraft,
	PlanDefinitionQuestion,
} from "./plan-definition-model";
import { PrefillRuleEditor } from "./plan-definition-prefill-rule-editor";
import { getPrefills, setPrefills } from "./plan-definition-rules";

type PrefillEditorProps = {
	action: PlanDefinitionActionDraft;
	actionPath: string;
	actionIndex: number;
	compiledAction?: PlanDefinitionActionDraft;
	targets: QuestionnaireItem[];
	targetQuestions: PlanDefinitionQuestion[];
	prefillQuestions: PlanDefinitionQuestion[];
	loadingForms: boolean;
	ready: boolean;
	advanced: boolean;
	variables: FhirpathVariable[];
	errors: Record<string, string>;
	onAdvancedChange: (value: boolean) => void;
	onChange: (action: PlanDefinitionActionDraft) => void;
};

export function PlanDefinitionPrefillEditor({
	action,
	actionPath,
	actionIndex,
	compiledAction,
	targets,
	targetQuestions,
	prefillQuestions,
	loadingForms,
	ready,
	advanced,
	variables,
	errors,
	onAdvancedChange,
	onChange,
}: PrefillEditorProps) {
	const prefills = getPrefills(action);
	const compiledPrefills = new Map(
		getPrefills(compiledAction).map((rule) => [rule.id, rule]),
	);
	return (
		<section className="space-y-2" aria-label="Prefill from other forms">
			{prefills.map((rule, index) => (
				<PrefillRuleEditor
					key={rule.id ?? index}
					rule={rule}
					index={index}
					actionPath={actionPath}
					actionIndex={actionIndex}
					compiledRule={compiledPrefills.get(rule.id)}
					targets={targets}
					targetQuestions={targetQuestions}
					prefillQuestions={prefillQuestions}
					loadingForms={loadingForms}
					advanced={advanced}
					variables={variables}
					errors={errors}
					onAdvancedChange={onAdvancedChange}
					onChange={(patch) =>
						onChange(
							setPrefills(
								action,
								prefills.map((value, position) =>
									position === index ? { ...value, ...patch } : value,
								),
							),
						)
					}
					onRemove={() =>
						onChange(
							setPrefills(
								action,
								prefills.filter((_, position) => position !== index),
							),
						)
					}
				/>
			))}
			<div className="flex items-center">
				<Button
					variant="secondary"
					className="w-fit"
					disabled={!ready}
					data-test-id="plan-definition-editor__add-prefill-button"
					onClick={() => {
						const id = generateId();
						onChange(
							setPrefills(action, [
								...prefills,
								{
									id,
									targetLinkId: "",
									expression: "",
								},
							]),
						);
					}}
				>
					<Plus className="size-4" />
					Add prefill
				</Button>
			</div>
		</section>
	);
}
