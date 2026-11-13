import type { QuestionnaireResponse } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import { Tag } from "@health-samurai/react-components";

export function ResponseCompletionStatusTag({
	status,
}: {
	status?: QuestionnaireResponse["status"];
}) {
	switch (status) {
		case "completed":
			return (
				<Tag
					data-test-id="response-completion-status-tag"
					color="green"
					vibrance="subtle"
					size="small"
				>
					Completed
				</Tag>
			);
		case "amended":
			return (
				<Tag
					data-test-id="response-completion-status-tag"
					color="blue"
					vibrance="subtle"
					size="small"
				>
					Amended
				</Tag>
			);
		case "entered-in-error":
			return (
				<Tag
					data-test-id="response-completion-status-tag"
					color="yellow"
					vibrance="subtle"
					size="small"
				>
					Entered in error
				</Tag>
			);
		case "in-progress":
			return (
				<Tag
					data-test-id="response-completion-status-tag"
					color="gray"
					vibrance="subtle"
					size="small"
				>
					In progress
				</Tag>
			);
		case "stopped":
			return (
				<Tag
					data-test-id="response-completion-status-tag"
					color="red"
					vibrance="subtle"
					size="small"
				>
					Stopped
				</Tag>
			);
		default:
			return null;
	}
}
