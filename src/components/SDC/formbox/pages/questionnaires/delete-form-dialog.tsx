import type {
	Questionnaire,
	QuestionnaireResponse,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
} from "@health-samurai/react-components";
import type { Form } from "../../api/forms";
import { getFormBuilderUrl, getResponseRendererUrl } from "../../utils";

type DeleteFormDialogProps = {
	componentUsage: Questionnaire[];
	isDeleting: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	qrUsage: QuestionnaireResponse[];
	form: Form | null;
};

export function DeleteFormDialog({
	componentUsage,
	isDeleting,
	onConfirm,
	onOpenChange,
	open,
	qrUsage,
	form,
}: DeleteFormDialogProps) {
	const status = form?.status;
	const isPlanDefinition = form?.resourceType === "PlanDefinition";
	const resourceLabel = isPlanDefinition ? "Package" : "Questionnaire";

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent
				showCloseButton={false}
				data-test-id="delete-form-dialog"
			>
				<AlertDialogHeader>
					<AlertDialogTitle data-test-id="delete-form-dialog__title">
						Delete {resourceLabel}
					</AlertDialogTitle>
				</AlertDialogHeader>
				<AlertDialogDescription className="space-y-4">
					<p>
						Are you sure you want to delete this {resourceLabel.toLowerCase()}?
					</p>
					{status === "active" || status === "retired" ? (
						<p>{`${resourceLabel} is in '${status}' status and may be used in production.`}</p>
					) : null}
					{componentUsage.length > 0 ? (
						<div className="space-y-2">
							<p>
								{`Questionnaire is used as component in other forms (${componentUsage.length}):`}
							</p>
							<ul
								className="max-h-40 space-y-1 overflow-auto italic"
								data-test-id="delete-form-dialog__component-usage-list"
							>
								{componentUsage.map((usedQuestionnaire, index) => (
									<li
										key={
											usedQuestionnaire.id ??
											`${usedQuestionnaire.url ?? "questionnaire"}-${index}`
										}
									>
										<span>{`${index + 1}. `}</span>
										{usedQuestionnaire.id ? (
											<a
												href={getFormBuilderUrl(usedQuestionnaire.id)}
												target="_blank"
												rel="noreferrer"
												className="text-text-link underline hover:underline"
											>
												{usedQuestionnaire.title ??
													usedQuestionnaire.name ??
													usedQuestionnaire.id}
											</a>
										) : (
											<span>
												{usedQuestionnaire.title ??
													usedQuestionnaire.name ??
													usedQuestionnaire.url ??
													"Questionnaire"}
											</span>
										)}
									</li>
								))}
							</ul>
						</div>
					) : null}
					{qrUsage.length > 0 ? (
						<div className="space-y-2">
							<p>{`Questionnaire has QuestionnaireResponses (${qrUsage.length}):`}</p>
							<ul
								className="max-h-40 space-y-1 overflow-auto italic"
								data-test-id="delete-form-dialog__response-usage-list"
							>
								{qrUsage.map((response, index) => (
									<li
										key={
											response.id ??
											`${response.questionnaire ?? "response"}-${index}`
										}
									>
										<span>{`${index + 1}. `}</span>
										{response.id ? (
											<a
												href={getResponseRendererUrl(response.id)}
												target="_blank"
												rel="noreferrer"
												className="text-text-link underline hover:underline"
											>
												{response.id}
											</a>
										) : (
											<span>QuestionnaireResponse</span>
										)}
									</li>
								))}
							</ul>
						</div>
					) : null}
				</AlertDialogDescription>
				<AlertDialogFooter>
					<AlertDialogCancel
						data-test-id="delete-form-dialog__cancel-button"
						disabled={isDeleting}
					>
						Cancel
					</AlertDialogCancel>
					<Button
						danger
						data-test-id="delete-form-dialog__confirm-button"
						disabled={isDeleting}
						onClick={onConfirm}
					>
						{isDeleting
							? "Deleting..."
							: isPlanDefinition
								? "Delete"
								: "Force delete"}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
