import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	toast,
} from "@health-samurai/react-components";
import { Copy, ExternalLink } from "lucide-react";

type GeneratedFormLinkDialogProps = {
	link: string | null;
	onOpenChange: (open: boolean) => void;
};

export function GeneratedFormLinkDialog({
	link,
	onOpenChange,
}: GeneratedFormLinkDialogProps) {
	const open = Boolean(link);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-[36rem]"
				data-test-id="generated-link-dialog"
			>
				<DialogHeader className="border-b border-border-primary bg-bg-primary px-6 py-6 pr-14">
					<DialogTitle data-test-id="generated-link-dialog__title">
						Link generated
					</DialogTitle>
					<DialogDescription>
						Copy the link or open it in a new tab.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 px-6 py-6">
					<Input
						readOnly
						data-test-id="generated-link-dialog__link-input"
						value={link ?? ""}
						className="bg-bg-primary"
					/>
				</div>
				<DialogFooter className="border-t border-border-primary bg-bg-primary px-6 py-4">
					<Button
						type="button"
						variant="secondary"
						data-test-id="generated-link-dialog__open-link-button"
						disabled={!link}
						onClick={() => {
							if (!link) {
								return;
							}

							window.open(link, "_blank", "noopener,noreferrer");
						}}
					>
						<ExternalLink size={16} />
						Open link
					</Button>
					<Button
						type="button"
						data-test-id="generated-link-dialog__copy-link-button"
						disabled={!link}
						onClick={async () => {
							if (!link) {
								return;
							}

							await navigator.clipboard.writeText(link);
							toast.success("Link copied");
							onOpenChange(false);
						}}
					>
						<Copy size={16} />
						Copy link
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
