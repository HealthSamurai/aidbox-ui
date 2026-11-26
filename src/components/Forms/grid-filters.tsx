import { useDebounce } from "@aidbox-ui/hooks/index";
import * as HSComp from "@health-samurai/react-components";
import { Search, X } from "lucide-react";
import * as React from "react";

/**
 * The filter bar pieces of the SDC grids (Forms, Responses): a select that
 * shows its name until a value is picked, with "Any" to clear it, and a
 * debounced search box.
 */

const ANY = "__any__";

// Radix renders the selected value in a flex child, which defaults to
// min-width:auto and would push the trigger wider than its column.
const FILTER_TRIGGER_CLASS_NAME =
	"min-w-0 overflow-hidden bg-bg-primary *:data-[slot=select-value]:block *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate";

export function FilterSelect({
	label,
	value,
	options,
	onChange,
	testId,
	className,
}: {
	label: string;
	value: string | undefined;
	options: Array<{ value: string; label: string }>;
	onChange: (value: string | undefined) => void;
	testId: string;
	className?: string;
}) {
	// "forms-filters__status-dropdown" lists "forms-filters__status-option"s.
	const optionTestId = `${testId.replace(/-dropdown$/, "")}-option`;
	return (
		<HSComp.Select
			value={value ?? ""}
			onValueChange={(next) => onChange(next === ANY ? undefined : next)}
		>
			<HSComp.SelectTrigger
				className={HSComp.cn(FILTER_TRIGGER_CLASS_NAME, className)}
				aria-label={label}
				data-test-id={testId}
			>
				<HSComp.SelectValue placeholder={label} />
			</HSComp.SelectTrigger>
			<HSComp.SelectContent>
				<HSComp.SelectItem value={ANY} data-test-id={optionTestId}>
					Any
				</HSComp.SelectItem>
				{options.map((option) => (
					<HSComp.SelectItem
						key={option.value}
						value={option.value}
						data-test-id={optionTestId}
					>
						{option.label}
					</HSComp.SelectItem>
				))}
			</HSComp.SelectContent>
		</HSComp.Select>
	);
}

/** Search typed into the box reaches the URL, and the query, after a pause. */
export function SearchInput({
	value,
	onChange,
	placeholder,
	testId,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	testId: string;
}) {
	const [text, setText] = React.useState(value);
	const [synced, setSynced] = React.useState(value);
	// The URL can change under the input (back button, a cleared filter).
	if (value !== synced) {
		setSynced(value);
		setText(value);
	}
	const commit = useDebounce<string>((next) => onChange(next.trim()), 300);
	const update = (next: string) => {
		setText(next);
		commit(next);
	};
	return (
		<HSComp.Input
			type="text"
			placeholder={placeholder}
			value={text}
			onChange={(event) => update(event.target.value)}
			className="bg-bg-primary"
			data-test-id={testId}
			leftSlot={<Search />}
			rightSlot={
				text ? (
					<HSComp.IconButton
						icon={<X />}
						aria-label="Clear search"
						variant="link"
						onClick={() => update("")}
					/>
				) : null
			}
		/>
	);
}
