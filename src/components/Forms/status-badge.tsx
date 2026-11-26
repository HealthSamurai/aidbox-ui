import { Badge } from "@health-samurai/react-components";
import type * as React from "react";

/** The tints of the async operations status badge, so statuses look alike. */
const TONE_CLASSES = {
	green: "border-transparent bg-utility-green/15 text-utility-green",
	blue: "border-transparent bg-utility-blue/15 text-utility-blue",
	yellow: "border-transparent bg-utility-yellow/15 text-utility-yellow",
	red: "border-transparent bg-utility-red/15 text-utility-red",
	gray: "border-transparent bg-bg-secondary text-text-secondary",
};

export type StatusTone = keyof typeof TONE_CLASSES;

export function StatusBadge({
	tone,
	testId,
	children,
}: React.PropsWithChildren<{ tone: StatusTone; testId?: string }>) {
	return (
		<Badge
			variant="outline"
			className={TONE_CLASSES[tone]}
			data-test-id={testId}
		>
			{children}
		</Badge>
	);
}
