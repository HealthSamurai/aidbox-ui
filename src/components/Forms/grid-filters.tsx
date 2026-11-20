import { useDebounce } from "@aidbox-ui/hooks/index";
import * as HSComp from "@health-samurai/react-components";
import { Plus, Search, X } from "lucide-react";
import * as React from "react";

/**
 * The filter bar pieces of the SDC grids (Forms, Responses), after Formbox:
 * a labelled field, a select with "Any", optional filters behind "Add
 * filters", and a debounced search box.
 */

const ANY = "__any__";

// Radix renders the selected value in a flex child, which defaults to
// min-width:auto and would push the trigger wider than its column.
const FILTER_TRIGGER_CLASS_NAME =
	"h-8 min-w-0 overflow-hidden bg-bg-primary *:data-[slot=select-value]:block *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:truncate";

export function FilterField({
	children,
	className,
	label,
	onRemove,
	testId,
}: React.PropsWithChildren<{
	className?: string;
	label: string;
	onRemove?: () => void;
	testId?: string;
}>) {
	return (
		<div
			className={HSComp.cn("grid min-w-0 gap-1", className)}
			data-test-id={testId}
		>
			<span className="typo-label flex items-center gap-1 px-0.5 text-text-secondary">
				<span className="truncate">{label}</span>
				{onRemove ? (
					<HSComp.IconButton
						variant="link"
						aria-label={`Remove ${label} filter`}
						data-test-id={testId ? `${testId}__remove-button` : undefined}
						className="text-text-tertiary [&>svg]:size-3"
						onClick={onRemove}
						icon={<X />}
					/>
				) : null}
			</span>
			{children}
		</div>
	);
}

export function FilterSelect({
	label,
	value,
	options,
	onChange,
	testId,
}: {
	label: string;
	value: string | undefined;
	options: Array<{ value: string; label: string }>;
	onChange: (value: string | undefined) => void;
	testId: string;
}) {
	// "forms-filters__status-dropdown" lists "forms-filters__status-option"s.
	const optionTestId = `${testId.replace(/-dropdown$/, "")}-option`;
	return (
		<HSComp.Select
			value={value ?? ANY}
			onValueChange={(next) => onChange(next === ANY ? undefined : next)}
		>
			<HSComp.SelectTrigger
				className={FILTER_TRIGGER_CLASS_NAME}
				aria-label={label}
				data-test-id={testId}
			>
				<HSComp.SelectValue placeholder="Any" />
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

export type OptionalFilter = {
	key: string;
	label: string;
	isSet: boolean;
	reset: () => void;
	control: React.ReactNode;
	/** Extra classes for the field, e.g. a wider minimum. */
	className?: string;
};

/**
 * Filters start hidden behind "Add filters". One that arrives set (from the
 * URL) is shown without being picked; picked ones keep their pick order.
 */
export function OptionalFilters({
	filters,
	testIdPrefix,
}: {
	filters: OptionalFilter[];
	/** Prefix of the test ids, e.g. "forms-filters". */
	testIdPrefix: string;
}) {
	const [pickedKeys, setPickedKeys] = React.useState<string[]>([]);
	const arrived = filters.filter(
		(filter) => !pickedKeys.includes(filter.key) && filter.isSet,
	);
	const picked = pickedKeys.flatMap((key) =>
		filters.filter((filter) => filter.key === key),
	);
	const visible = [...arrived, ...picked];
	const hidden = filters.filter((filter) => !visible.includes(filter));
	const pick = (key: string) =>
		setPickedKeys((previous) =>
			previous.includes(key) ? previous : [...previous, key],
		);
	const drop = (filter: OptionalFilter) => {
		setPickedKeys((previous) => previous.filter((key) => key !== filter.key));
		filter.reset();
	};
	const dropAll = () => {
		for (const filter of visible) filter.reset();
		setPickedKeys([]);
	};
	return (
		<>
			{visible.map((filter) => (
				<FilterField
					key={filter.key}
					label={filter.label}
					className={HSComp.cn("w-[12rem]", filter.className)}
					onRemove={() => drop(filter)}
					testId={`${testIdPrefix}__${filter.key}-field`}
				>
					{filter.control}
				</FilterField>
			))}
			{hidden.length > 0 ? (
				<HSComp.DropdownMenu>
					<HSComp.DropdownMenuTrigger asChild>
						<HSComp.Button
							variant="ghost"
							size="small"
							data-test-id={`${testIdPrefix}__add-filters-button`}
							className="h-8 gap-1 border-0 bg-bg-tertiary px-3 text-text-quternary hover:bg-bg-tertiary hover:text-text-secondary"
						>
							<Plus className="size-4" />
							Add filters
						</HSComp.Button>
					</HSComp.DropdownMenuTrigger>
					<HSComp.DropdownMenuContent
						align="start"
						data-test-id={`${testIdPrefix}__add-filters-menu`}
					>
						<HSComp.DropdownMenuLabel>Add filter by:</HSComp.DropdownMenuLabel>
						{hidden.map((filter) => (
							<HSComp.DropdownMenuItem
								key={filter.key}
								className="justify-start"
								data-test-id={`${testIdPrefix}__add-filter-${filter.key}-button`}
								onClick={() => pick(filter.key)}
							>
								{filter.label}
							</HSComp.DropdownMenuItem>
						))}
					</HSComp.DropdownMenuContent>
				</HSComp.DropdownMenu>
			) : null}
			{visible.length > 0 ? (
				<HSComp.Button
					variant="ghost"
					size="small"
					className="h-8 border-0 bg-transparent px-3 text-text-quternary hover:bg-bg-tertiary hover:text-text-quternary"
					data-test-id={`${testIdPrefix}__reset-all-button`}
					onClick={dropAll}
				>
					Reset all
				</HSComp.Button>
			) : null}
		</>
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
			className="h-8 bg-bg-primary"
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
