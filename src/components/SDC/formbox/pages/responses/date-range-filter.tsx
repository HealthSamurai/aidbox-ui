import {
	Calendar,
	cn,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@health-samurai/react-components";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { FILTER_ALL } from "./constants";
import {
	DATE_FILTER_PRESETS,
	formatDateFilterLabel,
	parseDateFilter,
	parseLocalDay,
	serializeCustomRange,
} from "./date-range";

const CUSTOM_OPTION = "custom";

/**
 * The shape `Calendar` uses in range mode. Spelled out here rather than imported
 * from `react-day-picker`, which the UI kit depends on but this package does not.
 */
type CalendarRange = { from: Date | undefined; to?: Date };

/** Matches `SelectTrigger` from the UI kit, so the filter row stays one piece. */
const TRIGGER_CLASS = cn(
	"flex h-8 w-full cursor-pointer items-center justify-between gap-2 whitespace-nowrap",
	"rounded-md border border-border-primary bg-bg-primary px-3 text-sm",
	"outline-none transition-colors duration-300",
	"hover:border-border-primary_hover focus-visible:border-border-link",
);

function toCalendarRange(value?: string): CalendarRange | undefined {
	const parsed = parseDateFilter(value);

	if (parsed.kind !== "custom") {
		return undefined;
	}

	return { from: parseLocalDay(parsed.from), to: parseLocalDay(parsed.to) };
}

/**
 * A date filter offering a few presets plus a range picked on a calendar. The
 * calendar sits next to the presets rather than replacing them, so switching
 * back to "Today" never costs a trip through a back button.
 */
export function DateRangeFilter({
	label,
	onChange,
	testId,
	value,
}: {
	label: string;
	onChange: (value: string) => void;
	testId?: string;
	value: string;
}) {
	const parsed = parseDateFilter(value);
	const [isOpen, setIsOpen] = useState(false);
	const [isPickingRange, setIsPickingRange] = useState(
		parsed.kind === "custom",
	);
	const [draft, setDraft] = useState<CalendarRange | undefined>(() =>
		toCalendarRange(value),
	);
	// Whether the range on screen is finished (both ends picked) or still waiting
	// for its second end. An applied range arrives finished, so the first click on
	// a reopened calendar starts a new one.
	const [isRangeClosed, setIsRangeClosed] = useState(parsed.kind === "custom");
	const activeOption = isPickingRange
		? CUSTOM_OPTION
		: parsed.kind === "preset"
			? parsed.preset
			: FILTER_ALL;

	const handleOpenChange = (nextOpen: boolean) => {
		setIsOpen(nextOpen);

		// Reopening starts from what is actually applied, not from a range the user
		// walked away from half-picked.
		if (nextOpen) {
			setIsPickingRange(parsed.kind === "custom");
			setDraft(toCalendarRange(value));
			setIsRangeClosed(parsed.kind === "custom");

			return;
		}

		// Walking away with only one end picked means that single day — which is
		// what the calendar was showing. Applying it on the way out rather than on
		// the click keeps the first click free of a request without losing it.
		if (draft?.from && !isRangeClosed) {
			onChange(serializeCustomRange(draft.from, draft.from));
		}
	};

	const selectOption = (option: string) => {
		if (option === CUSTOM_OPTION) {
			setIsPickingRange(true);

			return;
		}

		setIsPickingRange(false);
		setDraft(undefined);
		setIsRangeClosed(false);
		onChange(option);
		setIsOpen(false);
	};

	/**
	 * Picks a range in two clicks and no more: the first sets one end, the second
	 * closes the range and applies it, and a third starts over from scratch.
	 *
	 * Only the second click reaches `onChange`. Applying the half-picked range as
	 * well would search twice for one range and flash the wrong rows in the grid in
	 * between; the day the user clicked first is not lost, it is applied when the
	 * popover closes.
	 *
	 * The range react-day-picker computed is deliberately ignored in favour of the
	 * day that was clicked (its second argument). Left to itself the library keeps
	 * editing a finished range — a later click moves whichever end is nearer — so
	 * a third click silently reshaped the range instead of beginning a new one.
	 * There is also no moment at which it reports a range as "finished": the very
	 * first click already comes back as a one-day range, which is why the two
	 * phases are tracked here.
	 */
	const selectRange = (_range: CalendarRange | undefined, clickedDay: Date) => {
		const anchor = draft?.from;

		if (isRangeClosed || !anchor) {
			setDraft({ from: clickedDay, to: clickedDay });
			setIsRangeClosed(false);

			return;
		}

		const [from, to] =
			anchor <= clickedDay ? [anchor, clickedDay] : [clickedDay, anchor];

		setDraft({ from, to });
		setIsRangeClosed(true);
		onChange(serializeCustomRange(from, to));
	};

	const options = [
		{ label: "Any", value: FILTER_ALL },
		...DATE_FILTER_PRESETS,
		{ label: "Custom range…", value: CUSTOM_OPTION },
	];

	return (
		<Popover open={isOpen} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<button
					type="button"
					data-test-id={testId ? `${testId}-dropdown` : undefined}
					className={TRIGGER_CLASS}
					aria-label={`${label}: ${formatDateFilterLabel(value)}`}
				>
					{/* "Any" is not greyed out the way a placeholder would be: the other
              filters in the row show their own "Any" as an ordinary value. */}
					<span className="truncate text-text-primary">
						{formatDateFilterLabel(value)}
					</span>
					<ChevronDown className="size-4 shrink-0 text-text-tertiary" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				data-test-id={testId ? `${testId}-options` : undefined}
				className="flex w-auto p-0"
			>
				<div className="flex min-w-44 flex-col gap-0.5 p-1">
					{options.map((option) => (
						<button
							key={option.value}
							type="button"
							data-test-id={testId ? `${testId}-option` : undefined}
							onClick={() => selectOption(option.value)}
							className={cn(
								"cursor-pointer rounded-sm px-2 py-1.5 text-left text-sm",
								"hover:bg-bg-secondary",
								option.value === activeOption
									? "bg-bg-secondary text-text-primary"
									: "text-text-secondary",
							)}
						>
							{option.label}
						</button>
					))}
				</div>
				{isPickingRange ? (
					<div className="border-border-secondary border-l">
						{/* Opens on the month the applied range starts in, so reopening a
                range picked in the past does not land on today and need paging
                back. Read once per open — the popover unmounts when closed. */}
						<Calendar
							data-test-id={testId ? `${testId}-calendar` : undefined}
							mode="range"
							defaultMonth={draft?.from}
							selected={draft}
							onSelect={selectRange}
						/>
					</div>
				) : null}
			</PopoverContent>
		</Popover>
	);
}
