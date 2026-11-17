import { Tag } from "@health-samurai/react-components";

export function ResponseDeliveryStatusTag({
	status,
}: {
	status?: string | null;
}) {
	if (!status) {
		return null;
	}

	switch (status.toLowerCase()) {
		case "sent":
			return (
				<Tag
					data-test-id="response-delivery-status-tag"
					color="green"
					vibrance="subtle"
					size="small"
				>
					Sent
				</Tag>
			);
		case "queued":
			return (
				<Tag
					data-test-id="response-delivery-status-tag"
					color="yellow"
					vibrance="subtle"
					size="small"
				>
					Queued
				</Tag>
			);
		case "cancelled":
		case "canceled":
			return (
				<Tag
					data-test-id="response-delivery-status-tag"
					color="red"
					vibrance="subtle"
					size="small"
				>
					Canceled
				</Tag>
			);
		case "failed":
			return (
				<Tag
					data-test-id="response-delivery-status-tag"
					color="red"
					vibrance="subtle"
					size="small"
				>
					Failed
				</Tag>
			);
		default:
			return (
				<Tag
					data-test-id="response-delivery-status-tag"
					color="gray"
					vibrance="subtle"
					size="small"
				>
					{status}
				</Tag>
			);
	}
}
