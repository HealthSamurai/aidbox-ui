import type { QuestionnaireItem } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import { Label } from "@health-samurai/react-components";
import { useId } from "react";
import {
	FhirpathEditor,
	type FhirpathVariable,
} from "../../shared/fhirpath-editor";
import type { PlanDefinitionQuestion } from "./plan-definition-model";
import {
	parsePrefillSource,
	prefillExpression,
} from "./plan-definition-prefills";
import { PlanDefinitionQuestionSelect } from "./plan-definition-question-select";

/** Select a compatible answer source or keep editing an unrestricted expression. */
export function PlanDefinitionPrefillSource({
	label,
	target,
	questions,
	loading,
	advanced,
	variables,
	value,
	invalid,
	describedBy,
	onChange,
}: {
	label: string;
	target?: QuestionnaireItem;
	questions: PlanDefinitionQuestion[];
	loading: boolean;
	advanced: boolean;
	variables: FhirpathVariable[];
	value: string;
	invalid: boolean;
	describedBy?: string;
	onChange: (expression: string) => void;
}) {
	const sourceId = useId();
	const source = parsePrefillSource(value, target, questions);
	return (
		<div className="min-w-0">
			<Label htmlFor={advanced ? undefined : sourceId} className="sr-only">
				Source
			</Label>
			<div className="min-w-0">
				{advanced ? (
					<FhirpathEditor
						label={`${label} expression`}
						variables={variables}
						value={value}
						invalid={invalid}
						describedBy={describedBy}
						onChange={onChange}
					/>
				) : (
					<fieldset className="min-w-0" disabled={!target}>
						<PlanDefinitionQuestionSelect
							id={sourceId}
							aria-invalid={invalid || undefined}
							aria-describedby={describedBy}
							items={
								target
									? questions.filter(
											(question) =>
												prefillExpression(question, target) !== undefined,
										)
									: []
							}
							selectedItem={source}
							isLoading={loading}
							placeholder={
								target
									? "Choose a source question"
									: "Choose a target question first"
							}
							searchPlaceholder="Search forms and questions..."
							emptyText="No compatible questions."
							onQueryChange={() => {}}
							testId="plan-definition-prefill__source"
							onSelect={(source) => {
								if (target) onChange(prefillExpression(source, target) ?? "");
							}}
						/>
					</fieldset>
				)}
			</div>
		</div>
	);
}
