import { StatusBadge, type StatusTone } from "../status-badge";

const DELIVERY_STATUSES: Record<string, [string, StatusTone]> = {
	sent: ["Sent", "green"],
	queued: ["Queued", "yellow"],
	cancelled: ["Canceled", "red"],
	canceled: ["Canceled", "red"],
	failed: ["Failed", "red"],
};

export function ResponseDeliveryStatusTag({
	status,
}: {
	status?: string | null;
}) {
	if (!status) return null;
	const [label, tone] = DELIVERY_STATUSES[status.toLowerCase()] ?? [
		status,
		"gray",
	];
	return (
		<StatusBadge tone={tone} testId="response-delivery-status-tag">
			{label}
		</StatusBadge>
	);
}
