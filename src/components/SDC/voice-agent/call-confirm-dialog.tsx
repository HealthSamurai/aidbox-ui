import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@health-samurai/react-components";

/**
 * Placing a call reaches a person who did not agree to be a test subject, so it
 * is the one action here that asks first. Text and browser runs stay immediate.
 */
export function CallConfirmDialog({
	phone,
	subject,
	questionnaireCount,
	onConfirm,
	onOpenChange,
	open,
}: {
	phone: string;
	subject?: string;
	questionnaireCount: number;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent data-test-id="call-confirm-dialog">
				<AlertDialogHeader>
					<AlertDialogTitle data-test-id="call-confirm-dialog__title">
						Place a real call
					</AlertDialogTitle>
				</AlertDialogHeader>
				<AlertDialogDescription>
					Dial <span className="font-medium">{phone}</span>
					{subject ? (
						<>
							{" "}
							for <span className="font-medium">{subject}</span>
						</>
					) : null}
					? The agent speaks to whoever answers and works through{" "}
					{questionnaireCount === 1
						? "one questionnaire"
						: `${questionnaireCount} questionnaires`}
					.
				</AlertDialogDescription>
				<AlertDialogFooter>
					<AlertDialogCancel data-test-id="call-confirm-dialog__cancel-button">
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						data-test-id="call-confirm-dialog__confirm-button"
						onClick={onConfirm}
					>
						Call
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
