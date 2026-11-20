import { AppSelectContent } from "@aidbox-ui/components/app-select";
import { SCROLL_LIST_CLASS_NAME } from "@aidbox-ui/utils/scroll";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Select,
	SelectTrigger,
	SelectValue,
} from "@health-samurai/react-components";
import { Check, LoaderCircle } from "lucide-react";
import { useState } from "react";

/**
 * The library's Combobox renders one flat list. Voices come from more than one
 * provider and their names say nothing about which, so this is the same
 * control with the options kept under headings.
 */

export type GroupedOption = {
	value: string;
	label: string;
	disabled?: boolean;
	className?: string;
};
export type OptionGroup = { heading: string; options: GroupedOption[] };

export function GroupedCombobox({
	ariaLabel,
	className,
	disabled,
	id,
	emptyText = "No options found.",
	groups,
	loading,
	onOpen,
	onValueChange,
	placeholder,
	searchPlaceholder = "Search…",
	testId,
	value,
}: {
	ariaLabel?: string;
	className?: string;
	disabled?: boolean;
	id?: string;
	emptyText?: string;
	groups: OptionGroup[];
	loading?: boolean;
	onOpen?: () => void;
	onValueChange: (value: string, group?: string) => void;
	placeholder?: string;
	searchPlaceholder?: string;
	testId?: string;
	value: string;
}) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");

	const matching = groups
		.map((group) => ({
			...group,
			options: group.options.filter((option) =>
				// a label is whatever the caller passed; searching must not depend on
				// it having been a string
				String(option.label ?? "")
					.toLowerCase()
					.includes(search.toLowerCase()),
			),
		}))
		.filter((group) => group.options.length > 0);

	const selected = groups
		.flatMap((group) => group.options)
		.find((option) => option.value === value);

	return (
		<Select
			open={open}
			disabled={disabled}
			value={value}
			onOpenChange={(next: boolean) => {
				if (next) onOpen?.();
				else setSearch("");
				setOpen(next);
			}}
		>
			<SelectTrigger
				id={id}
				data-test-id={testId}
				aria-label={ariaLabel}
				aria-busy={loading || undefined}
				className={className}
			>
				<SelectValue placeholder={placeholder}>{selected?.label}</SelectValue>
				{loading && (
					<>
						<LoaderCircle
							aria-hidden="true"
							className="size-4 animate-spin text-text-tertiary motion-reduce:hidden"
						/>
						<output className="hidden text-text-tertiary typo-label motion-reduce:inline">
							Loading…
						</output>
					</>
				)}
			</SelectTrigger>
			<AppSelectContent
				className="p-0"
				data-test-id={testId ? `${testId}-options` : undefined}
			>
				<Command shouldFilter={false}>
					<CommandInput
						data-test-id={testId ? `${testId}-search-input` : undefined}
						placeholder={searchPlaceholder}
						value={search}
						onValueChange={setSearch}
					/>
					<CommandList className={SCROLL_LIST_CLASS_NAME}>
						<CommandEmpty>{emptyText}</CommandEmpty>
						{matching.map((group) => (
							<CommandGroup key={group.heading} heading={group.heading}>
								{group.options.map((option) => (
									<CommandItem
										key={option.value}
										data-test-id={testId ? `${testId}-option` : undefined}
										value={option.value}
										disabled={option.disabled}
										className={option.className}
										data-state={value === option.value ? "checked" : undefined}
										onSelect={(next: string) => {
											onValueChange(next, group.heading);
											setSearch("");
											setOpen(false);
										}}
									>
										{option.label}
										{!option.disabled && (
											<Check
												className={
													value === option.value
														? "ml-auto size-4 opacity-100"
														: "ml-auto size-4 opacity-0"
												}
											/>
										)}
									</CommandItem>
								))}
							</CommandGroup>
						))}
					</CommandList>
				</Command>
			</AppSelectContent>
		</Select>
	);
}
