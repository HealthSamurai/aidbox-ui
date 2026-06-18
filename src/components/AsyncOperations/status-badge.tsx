import { Badge } from "@health-samurai/react-components";
import type { AsyncOperationStatus } from "./types";
import { STATUS_LABEL } from "./types";

const STATUS_CLASSES: Record<AsyncOperationStatus, string> = {
	completed:
		"border-transparent bg-utility-green/15 text-utility-green dark:text-utility-green",
	failed: "border-transparent bg-utility-red/15 text-utility-red",
	cancelled: "border-transparent bg-utility-yellow/15 text-utility-yellow",
	"in-progress": "border-transparent bg-utility-blue/15 text-utility-blue",
};

const STATUS_BADGE_WIDTH = "w-24";

export function StatusBadge({
	status,
}: {
	status: AsyncOperationStatus | "not-found";
}) {
	if (status === "not-found") {
		return (
			<Badge variant="outline" className={STATUS_BADGE_WIDTH}>
				Not found
			</Badge>
		);
	}
	return (
		<Badge
			variant="outline"
			className={`${STATUS_BADGE_WIDTH} ${STATUS_CLASSES[status]}`}
		>
			{STATUS_LABEL[status]}
		</Badge>
	);
}
