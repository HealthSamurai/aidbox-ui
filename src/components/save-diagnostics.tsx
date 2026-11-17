import { toOperationOutcome } from "@aidbox-ui/components/Forms/api/resource-error";
import type { OperationOutcomeIssue } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import * as HSComp from "@health-samurai/react-components";

/** The OperationOutcome of a failed save, kept on screen under the form. */
export function SaveDiagnostics({
	error,
	onIssueClick,
}: {
	error: unknown;
	onIssueClick?: (issue: OperationOutcomeIssue) => void;
}) {
	if (!error) return null;
	return (
		<div
			role="alert"
			aria-label="Save errors"
			className="max-h-48 shrink-0 overflow-auto rounded-md border border-border-error"
			data-test-id="editor__save-errors"
		>
			<HSComp.OperationOutcomeView
				resource={toOperationOutcome(error) as HSComp.OperationOutcome}
				// The kit hands back the issues it was given, which are R4 issues.
				onIssueClick={
					onIssueClick &&
					((issue) => onIssueClick(issue as OperationOutcomeIssue))
				}
			/>
		</div>
	);
}
