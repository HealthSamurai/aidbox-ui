import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@health-samurai/react-components";
import type { Form } from "../api/forms";
import { ShareForm } from "./share-form";

type ShareFormDialogProps = {
	onGenerateLink: (link: string) => void;
	onOpenChange: (open: boolean) => void;
	form: Form | null;
};

export function ShareFormDialog({
	onGenerateLink,
	onOpenChange,
	form,
}: ShareFormDialogProps) {
	const open = form !== null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[40rem]"
				data-test-id="share-form-dialog"
			>
				<DialogHeader className="border-b border-border-primary bg-bg-primary px-6 py-6 pr-14">
					<DialogTitle data-test-id="share-form-dialog__title">
						{form?.resourceType === "PlanDefinition"
							? "Share package"
							: "Share form"}
					</DialogTitle>
					<DialogDescription>
						Generate a link for manual sharing.
					</DialogDescription>
				</DialogHeader>
				<ShareForm
					active={open}
					key={`${form?.resourceType}/${form?.id}`}
					onCancel={() => onOpenChange(false)}
					onGenerateLink={(link) => {
						onOpenChange(false);
						onGenerateLink(link);
					}}
					form={form}
					testIdPrefix="share-form-dialog"
				/>
			</DialogContent>
		</Dialog>
	);
}
