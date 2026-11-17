const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * A date the way the SDC grids show it: "Just now", "5 mins ago", "Yesterday",
 * "3 days ago", then the date itself, with the year only when it is not this one.
 */
export function formatHumanizedDate(value?: string | null): string {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;

	const now = new Date();
	const diff = now.getTime() - date.getTime();
	if (diff < MINUTE) return "Just now";
	if (diff < HOUR) return `${Math.floor(diff / MINUTE)} mins ago`;
	if (diff < DAY) {
		const hours = Math.floor(diff / HOUR);
		return `${hours} hour${hours === 1 ? "" : "s"} ago`;
	}
	if (diff < 2 * DAY) return "Yesterday";
	if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} days ago`;

	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
	}).format(date);
}
