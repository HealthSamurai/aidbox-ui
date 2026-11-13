import type { PlanDefinitionActionCondition } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import { IconButton } from "@health-samurai/react-components";
import { Trash2 } from "lucide-react";
import {
	FhirpathEditor,
	type FhirpathVariable,
} from "../../shared/fhirpath-editor";
import { useOperationOutcomeError } from "../../shared/operation-outcome-context";

export function ConditionExpressionEditor({
	condition,
	index,
	rulePath,
	issuePattern,
	error: localError,
	variables,
	onChange,
	onRemove,
}: {
	condition: PlanDefinitionActionCondition;
	index: number;
	rulePath: string;
	issuePattern?: RegExp;
	error?: string;
	variables: FhirpathVariable[];
	onChange: (expression: string) => void;
	onRemove?: () => void;
}) {
	const error = useOperationOutcomeError(issuePattern) ?? localError;
	const errorId = `condition-${index}-error`;
	return (
		<div
			className="flex w-fit max-w-full items-start gap-2"
			data-rule-path={rulePath}
		>
			<div className="min-w-0 flex-1 space-y-1.5">
				{index > 0 && <p className="text-xs text-text-secondary">and</p>}
				<FhirpathEditor
					label={`Condition ${index + 1}`}
					variables={variables}
					value={condition.expression?.expression ?? ""}
					invalid={Boolean(error)}
					describedBy={error ? errorId : undefined}
					onChange={onChange}
				/>
				{error && (
					<p
						id={errorId}
						role="alert"
						className="whitespace-pre-line text-xs text-text-error-primary"
					>
						{error}
					</p>
				)}
			</div>
			{onRemove && (
				<IconButton
					variant="ghost"
					aria-label={`Remove condition ${index + 1}`}
					onClick={onRemove}
					icon={<Trash2 className="size-4" />}
				/>
			)}
		</div>
	);
}
