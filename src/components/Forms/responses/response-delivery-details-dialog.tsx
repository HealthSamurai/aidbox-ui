import { copyToClipboard } from "@aidbox-ui/utils/clipboard";
import {
	Button,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	cn,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	toast,
} from "@health-samurai/react-components";
import { ChevronDown, Copy } from "lucide-react";
import { useState } from "react";
import type { SdcWorkflow } from "./api";
import type { DeliveryDetail } from "./delivery";
import {
	buildDeliveryDetails,
	formatDeliveryDetails,
	hasDeliveryDetails,
} from "./delivery";

function DetailRows({ rows }: { rows: DeliveryDetail[] }) {
	return (
		<dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
			{rows.map((row) => (
				<div
					key={row.label}
					className="col-span-2 grid grid-cols-subgrid items-baseline"
				>
					<dt
						className="text-text-secondary"
						data-test-id="delivery-details-dialog__row-label"
					>
						{row.label}
					</dt>
					<dd
						data-test-id="delivery-details-dialog__row-value"
						data-label={row.label}
						className={cn(
							"min-w-0 text-right text-text-primary",
							row.truncate ? "truncate" : "break-words",
						)}
						// A cut-off value is still readable on hover.
						title={row.truncate ? row.value : undefined}
					>
						{row.value}
					</dd>
				</div>
			))}
		</dl>
	);
}

export function ResponseDeliveryDetailsDialog({
	completedAt,
	formLabel,
	isSendingCanceled,
	onOpenChange,
	open,
	subject,
	workflow,
}: {
	completedAt?: string;
	formLabel?: string;
	isSendingCanceled?: boolean;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	subject?: string;
	workflow?: SdcWorkflow;
}) {
	const [isTechnicalOpen, setIsTechnicalOpen] = useState(false);
	const details = buildDeliveryDetails({
		completedAt,
		formLabel,
		isSendingCanceled,
		subject,
		workflow,
	});
	const hasDetails = hasDeliveryDetails(details);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				aria-describedby={undefined}
				data-test-id="delivery-details-dialog"
				className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-[37.5rem]"
			>
				<DialogHeader className="flex-row items-center justify-between gap-4 border-b border-border-primary px-6 py-4 pr-14">
					<DialogTitle data-test-id="delivery-details-dialog__title">
						Delivery Details
					</DialogTitle>
					<Button
						type="button"
						variant="ghost"
						size="small"
						data-test-id="delivery-details-dialog__copy-button"
						disabled={!hasDetails}
						onClick={async () => {
							if (!(await copyToClipboard(formatDeliveryDetails(details)))) {
								toast.error("Could not copy the delivery details");
								return;
							}
							toast.success("Delivery details copied");
						}}
					>
						<Copy size={16} />
						Copy
					</Button>
				</DialogHeader>
				{hasDetails ? (
					<div className="divide-y divide-border-secondary">
						<section className="flex flex-col gap-3 px-6 py-4">
							{details.statusSummary ? (
								<p
									className="text-sm text-text-primary"
									data-test-id="delivery-details-dialog__status-summary-text"
								>
									{details.statusSummary}
								</p>
							) : null}
							{details.statusRows.length > 0 ? (
								<DetailRows rows={details.statusRows} />
							) : null}
						</section>
						{details.formRows.length > 0 ? (
							<section className="px-6 py-4">
								<DetailRows rows={details.formRows} />
							</section>
						) : null}
						{details.deliveryRows.length > 0 ||
						details.technicalRows.length > 0 ? (
							<section className="flex flex-col gap-3 px-6 py-4">
								{details.deliveryRows.length > 0 ? (
									<DetailRows rows={details.deliveryRows} />
								) : null}
								{details.technicalRows.length > 0 ? (
									<Collapsible
										open={isTechnicalOpen}
										onOpenChange={setIsTechnicalOpen}
										className="flex flex-col gap-2"
									>
										<CollapsibleTrigger asChild>
											<button
												type="button"
												data-test-id="delivery-details-dialog__technical-details-toggle-button"
												className="flex cursor-pointer items-center gap-1 self-start text-sm text-text-secondary outline-none hover:text-text-primary"
											>
												Technical details
												<ChevronDown
													size={16}
													className={cn(
														"shrink-0 transition-transform",
														isTechnicalOpen && "rotate-180",
													)}
												/>
											</button>
										</CollapsibleTrigger>
										<CollapsibleContent>
											<DetailRows rows={details.technicalRows} />
										</CollapsibleContent>
									</Collapsible>
								) : null}
							</section>
						) : null}
					</div>
				) : (
					<p
						className="px-6 py-4 text-sm text-text-secondary"
						data-test-id="delivery-details-dialog__empty-text"
					>
						{
							"This response was not sent by email, so there is nothing to show here."
						}
					</p>
				)}
			</DialogContent>
		</Dialog>
	);
}
