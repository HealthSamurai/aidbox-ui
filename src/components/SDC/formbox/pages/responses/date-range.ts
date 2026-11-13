import { FILTER_ALL } from "./constants";

/**
 * The instants a date filter resolves to, ready to be sent as
 * `authored=ge<from>` / `authored=le<to>`. Both are UTC (`…Z`), which is the
 * same instant as the local boundary they came from and needs no escaping in a
 * query string.
 */
export type DateRangeBounds = {
	from: string;
	to: string;
};

export type DateFilterPreset = "today" | "yesterday" | "last7";

export const DATE_FILTER_PRESETS: Array<{
	label: string;
	value: DateFilterPreset;
}> = [
	{ label: "Today", value: "today" },
	{ label: "Yesterday", value: "yesterday" },
	{ label: "Last 7 days", value: "last7" },
];

export type ParsedDateFilter =
	| { kind: "all" }
	| { kind: "preset"; preset: DateFilterPreset }
	| { kind: "custom"; from: string; to: string };

/** Separates the two ends of a custom range in the URL: `2026-08-01..2026-08-11`. */
const CUSTOM_RANGE_SEPARATOR = "..";
const LOCAL_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isDateFilterPreset(value: string): value is DateFilterPreset {
	return DATE_FILTER_PRESETS.some((preset) => preset.value === value);
}

function pad(value: number) {
	return String(value).padStart(2, "0");
}

/** `2026-08-11` for the day the date falls on **where the user is**, not in UTC. */
export function toLocalDay(date: Date) {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Midnight of `2026-08-11` in the browser's timezone. */
export function parseLocalDay(day: string) {
	const [year, month, date] = day.split("-");

	return new Date(Number(year), Number(month) - 1, Number(date));
}

/**
 * The first and last instant of the calendar day a date falls on. `setHours`
 * resolves midnight in the browser's own zone — including on a daylight-saving
 * switch, where the two ends of a range sit at different offsets — and
 * `toISOString` then names that same instant in UTC.
 */
function localDayBounds(date: Date): DateRangeBounds {
	const from = new Date(date);
	from.setHours(0, 0, 0, 0);

	const to = new Date(date);
	to.setHours(23, 59, 59, 999);

	return { from: from.toISOString(), to: to.toISOString() };
}

function addDays(date: Date, days: number) {
	const shifted = new Date(date);
	shifted.setDate(shifted.getDate() + days);

	return shifted;
}

export function parseDateFilter(value?: string): ParsedDateFilter {
	if (!value || value === FILTER_ALL) {
		return { kind: "all" };
	}

	if (isDateFilterPreset(value)) {
		return { kind: "preset", preset: value };
	}

	const [first, last, ...rest] = value.split(CUSTOM_RANGE_SEPARATOR);

	if (
		rest.length > 0 ||
		!first ||
		!last ||
		!LOCAL_DAY_PATTERN.test(first) ||
		!LOCAL_DAY_PATTERN.test(last)
	) {
		// A hand-edited URL, or a value left over from an older build: fall back to
		// showing everything rather than to an empty grid nobody can explain.
		return { kind: "all" };
	}

	// Days are zero-padded, so comparing them as strings orders them correctly.
	return first <= last
		? { kind: "custom", from: first, to: last }
		: { kind: "custom", from: last, to: first };
}

export function serializeCustomRange(from: Date, to: Date) {
	const [first, last] = from <= to ? [from, to] : [to, from];

	return `${toLocalDay(first)}${CUSTOM_RANGE_SEPARATOR}${toLocalDay(last)}`;
}

function resolvePreset(preset: DateFilterPreset, now: Date): DateRangeBounds {
	switch (preset) {
		case "today":
			return localDayBounds(now);
		case "yesterday":
			return localDayBounds(addDays(now, -1));
		case "last7":
			// Today and the six days before it — seven calendar days in total.
			return {
				from: localDayBounds(addDays(now, -6)).from,
				to: localDayBounds(now).to,
			};
	}
}

/** The instants to search by, or `undefined` when the filter is "Any". */
export function resolveDateFilter(
	value?: string,
	now = new Date(),
): DateRangeBounds | undefined {
	const parsed = parseDateFilter(value);

	switch (parsed.kind) {
		case "all":
			return undefined;
		case "preset":
			return resolvePreset(parsed.preset, now);
		case "custom":
			return {
				from: localDayBounds(parseLocalDay(parsed.from)).from,
				to: localDayBounds(parseLocalDay(parsed.to)).to,
			};
	}
}

function formatDay(day: string) {
	return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
		parseLocalDay(day),
	);
}

/** What the filter's trigger reads, for both the control and its aria-label. */
export function formatDateFilterLabel(value?: string) {
	const parsed = parseDateFilter(value);

	switch (parsed.kind) {
		case "all":
			return "Any";
		case "preset":
			return (
				DATE_FILTER_PRESETS.find((preset) => preset.value === parsed.preset)
					?.label ?? "Any"
			);
		case "custom":
			return parsed.from === parsed.to
				? formatDay(parsed.from)
				: `${formatDay(parsed.from)} – ${formatDay(parsed.to)}`;
	}
}
