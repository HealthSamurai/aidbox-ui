import type { QuestionnaireResponse } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { StatusBadge, type StatusTone } from "../status-badge";

const COMPLETION_STATUSES: Record<
	NonNullable<QuestionnaireResponse["status"]>,
	[string, StatusTone]
> = {
	completed: ["Completed", "green"],
	amended: ["Amended", "blue"],
	"entered-in-error": ["Entered in error", "yellow"],
	"in-progress": ["In progress", "gray"],
	stopped: ["Stopped", "red"],
};

export function ResponseCompletionStatusTag({
	status,
}: {
	status?: QuestionnaireResponse["status"];
}) {
	if (!status) return null;
	const [label, tone] = COMPLETION_STATUSES[status];
	return (
		<StatusBadge tone={tone} testId="response-completion-status-tag">
			{label}
		</StatusBadge>
	);
}
