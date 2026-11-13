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

export function DeleteResponsesDialog({
	count,
	isDeleting,
	onConfirm,
	onOpenChange,
	open,
	sendingCount,
}: {
	count: number;
	isDeleting: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	/** How many of them are still being sent to a patient. */
	sendingCount: number;
}) {
	const single = count === 1;

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent
				showCloseButton={false}
				data-test-id="delete-responses-dialog"
			>
				<AlertDialogHeader>
					<AlertDialogTitle data-test-id="delete-responses-dialog__title">
						{single ? "Delete Response" : `Delete ${count} Responses`}
					</AlertDialogTitle>
				</AlertDialogHeader>
				<AlertDialogDescription className="space-y-4">
					<p>
						{single
							? "Are you sure you want to delete this response? The answers it holds will be lost."
							: `Are you sure you want to delete ${count} responses? The answers they hold will be lost.`}
					</p>
					{sendingCount > 0 ? (
						<p>
							{sendingCount === count && single
								? "This form is still being sent. Stop sending first, or the patient may still receive a link to a form that no longer exists."
								: `${sendingCount} of them ${sendingCount === 1 ? "is" : "are"} still being sent. Stop sending first, or the patients may still receive links to forms that no longer exist.`}
						</p>
					) : null}
				</AlertDialogDescription>
				<AlertDialogFooter>
					<AlertDialogCancel
						data-test-id="delete-responses-dialog__cancel-button"
						disabled={isDeleting}
					>
						Cancel
					</AlertDialogCancel>
					<Button
						danger
						disabled={isDeleting}
						onClick={onConfirm}
						data-test-id="delete-responses-dialog__confirm-button"
					>
						{isDeleting ? "Deleting..." : "Delete"}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
