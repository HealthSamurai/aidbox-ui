import { Badge } from "@health-samurai/react-components";
import type { AsyncOperationStatus, DisplayStatus } from "./types";
import { STATUS_LABEL } from "./types";

const STATUS_CLASSES: Record<AsyncOperationStatus | "queued", string> = {
	completed:
		"border-transparent bg-utility-green/15 text-utility-green dark:text-utility-green",
	failed: "border-transparent bg-utility-red/15 text-utility-red",
	cancelled: "border-transparent bg-utility-yellow/15 text-utility-yellow",
	"in-progress": "border-transparent bg-utility-blue/15 text-utility-blue",
	queued: "border-transparent bg-bg-secondary text-text-secondary",
};

export function StatusBadge({
	status,
}: {
	status: DisplayStatus | "not-found";
}) {
	if (status === "not-found") {
		return <Badge variant="outline">Not found</Badge>;
	}
	return (
		<Badge variant="outline" className={STATUS_CLASSES[status]}>
			{status === "queued" ? "Queued" : STATUS_LABEL[status]}
		</Badge>
	);
}
