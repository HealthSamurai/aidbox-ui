import { SCROLL_LIST_CLASS_NAME } from "@aidbox-ui/utils/scroll";
import {
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	cn,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@health-samurai/react-components";
import { Check, ChevronDown, ChevronsUpDown } from "lucide-react";
import {
	type ComponentProps,
	Fragment,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	type ResourceSearchAncestor,
	type ResourceSearchNode,
	resourceSearchTree,
} from "./resource-search-tree";

export type ResourceSearchSelectProps<T> = Pick<
	ComponentProps<typeof Button>,
	"id" | "aria-label" | "aria-invalid" | "aria-describedby" | "disabled"
> & {
	emptyText?: string;
	getKey: (item: T) => string;
	getLabel: (item: T) => string;
	getTitle?: (item: T) => string;
	getGroup?: (item: T) => { key: string; label: string };
	getAncestors?: (item: T) => ResourceSearchAncestor[];
	/** Use a compact, content-sized trigger within a sentence. */
	inline?: boolean;
	isLoading?: boolean;
	items: T[];
	onQueryChange?: (query: string) => void;
	onSelect: (item: T) => void;
	placeholder: string;
	searchPlaceholder: string;
	selectedItem?: T | null;
	testId?: string;
};

export function ResourceSearchSelect<T>({
	id,
	"aria-label": label,
	"aria-invalid": invalid,
	"aria-describedby": descriptionId,
	disabled,
	emptyText = "No results found.",
	getKey,
	getLabel,
	getTitle,
	getGroup,
	getAncestors,
	inline = false,
	isLoading,
	items,
	onQueryChange,
	onSelect,
	placeholder,
	searchPlaceholder,
	selectedItem,
	testId,
}: ResourceSearchSelectProps<T>) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	useEffect(
		() => () => {
			clearTimeout(timeoutRef.current);
		},
		[],
	);

	const selectedKey = selectedItem ? getKey(selectedItem) : null;
	const groups = new Map<string, { label?: string; items: T[] }>();
	for (const item of items) {
		const group = getGroup?.(item);
		const key = group?.key ?? "";
		const entry = groups.get(key) ?? { label: group?.label, items: [] };
		entry.items.push(item);
		groups.set(key, entry);
	}

	// `modal` matters: the picker opens inside a dialog, and the dialog's scroll
	// lock otherwise swallows the wheel over this list, leaving it keyboard-only.
	return (
		<Popover modal open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					aria-label={label}
					aria-invalid={invalid}
					aria-describedby={descriptionId}
					disabled={disabled}
					type="button"
					variant="secondary"
					title={
						selectedItem ? (getTitle ?? getLabel)(selectedItem) : undefined
					}
					data-test-id={testId ? `${testId}__trigger` : undefined}
					className={cn(
						"h-9 w-full justify-between px-3 typo-body",
						inline && "w-fit max-w-[min(24rem,100%)] gap-1.5 px-2",
					)}
				>
					<span className="min-w-0 text-left">
						<span
							className={cn(
								"block truncate",
								inline && selectedItem && "text-text-primary",
							)}
						>
							{selectedItem ? getLabel(selectedItem) : placeholder}
						</span>
					</span>
					{inline ? (
						<ChevronDown className="size-4 text-text-tertiary" />
					) : (
						<ChevronsUpDown className="size-4 text-text-tertiary" />
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className={cn(
					"w-[var(--radix-popover-trigger-width)] p-0",
					inline &&
						"w-[max(32rem,var(--radix-popover-trigger-width))] max-w-[var(--radix-popover-content-available-width)]",
				)}
				data-test-id={testId ? `${testId}__popover` : undefined}
				align="start"
			>
				<Command>
					<CommandInput
						data-test-id={testId ? `${testId}__search-input` : undefined}
						placeholder={searchPlaceholder}
						value={query}
						onValueChange={(value) => {
							setQuery(value);
							clearTimeout(timeoutRef.current);
							if (onQueryChange) {
								timeoutRef.current = setTimeout(
									() => onQueryChange(value),
									250,
								);
							}
						}}
					/>
					<CommandList className={SCROLL_LIST_CLASS_NAME}>
						<CommandEmpty
							data-test-id={testId ? `${testId}__empty-text` : undefined}
						>
							{isLoading ? "Loading..." : emptyText}
						</CommandEmpty>
						{[...groups].map(([key, group]) => {
							const tree =
								getAncestors && !query
									? resourceSearchTree(group.items, {
											getKey,
											getLabel,
											getAncestors,
										})
									: undefined;
							if (tree?.size === 0) return null;
							const selectItem = (item: T) => {
								onSelect(item);
								setOpen(false);
							};
							const options = tree ? (
								<div key={key} className={getGroup ? "pl-3" : undefined}>
									<ResourceSearchTreeOptions
										nodes={tree}
										selectedKey={selectedKey}
										onSelect={selectItem}
										testId={testId}
									/>
								</div>
							) : (
								group.items.map((item) => {
									const itemKey = getKey(item);
									const itemLabel = getLabel(item);
									const ancestors = getAncestors?.(item);
									return (
										<CommandItem
											key={itemKey}
											data-test-id={testId ? `${testId}__option` : undefined}
											value={itemKey}
											keywords={
												group.label && !getAncestors
													? [itemLabel, group.label]
													: [itemLabel]
											}
											className={getGroup ? "pl-6" : undefined}
											onSelect={() => selectItem(item)}
										>
											<span className="min-w-0" title={itemLabel}>
												<span className="block truncate">{itemLabel}</span>
												{ancestors && ancestors.length > 0 && (
													<span className="block truncate text-xs text-text-tertiary">
														{ancestors
															.map((ancestor) => ancestor.label)
															.join(" / ")}
													</span>
												)}
											</span>
											<Check
												className={cn(
													"ml-auto size-4 shrink-0",
													selectedKey === itemKey ? "opacity-100" : "opacity-0",
												)}
											/>
										</CommandItem>
									);
								})
							);
							return group.label ? (
								<CommandGroup
									key={key}
									value={key}
									className="px-0"
									heading={
										<span className="min-w-0 truncate" title={group.label}>
											{group.label}
										</span>
									}
								>
									{options}
								</CommandGroup>
							) : (
								<Fragment key={key}>{options}</Fragment>
							);
						})}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

function ResourceSearchTreeOptions<T>({
	nodes,
	selectedKey,
	onSelect,
	testId,
}: {
	nodes: Map<string, ResourceSearchNode<T>>;
	selectedKey: string | null;
	onSelect: (item: T) => void;
	testId?: string;
}) {
	return [...nodes.values()].map((node) => (
		<Fragment key={node.key}>
			<CommandItem
				value={node.key}
				disabled={node.item === undefined}
				data-test-id={testId ? `${testId}__option` : undefined}
				className={cn(
					node.item === undefined &&
						"cursor-default text-text-secondary data-[disabled=true]:opacity-100",
				)}
				onSelect={() => {
					if (node.item !== undefined) onSelect(node.item);
				}}
			>
				<span className="min-w-0 truncate" title={node.label}>
					{node.label}
				</span>
				{node.item !== undefined && (
					<Check
						className={cn(
							"ml-auto size-4 shrink-0",
							selectedKey === node.key ? "opacity-100" : "opacity-0",
						)}
					/>
				)}
			</CommandItem>
			{node.children.size > 0 && (
				<div
					className="ml-3 border-l border-border-secondary pl-3"
					data-test-id={testId ? `${testId}__branch` : undefined}
				>
					<ResourceSearchTreeOptions
						nodes={node.children}
						selectedKey={selectedKey}
						onSelect={onSelect}
						testId={testId}
					/>
				</div>
			)}
		</Fragment>
	));
}
