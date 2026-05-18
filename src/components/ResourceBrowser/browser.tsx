import { useLocalStorage } from "@aidbox-ui/hooks/useLocalStorage";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
	ArrowDownAZ,
	ArrowDownZA,
	ArrowUpDown,
	Pin,
	Search,
	X,
} from "lucide-react";
import React, { useMemo, useRef } from "react";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import { createFuzzySearch } from "../../utils/fuzzy-search";
import { buildQuery, parseQuery, tagSlug } from "../../utils/tag-search";
import { useWebMCPResourceBrowser } from "../../webmcp/resource-browser";
import type { ResourceBrowserActions } from "../../webmcp/resource-browser-context";
import { EmptyState } from "../empty-state";

const CATEGORY_EXT_URL =
	"http://hl7.org/fhir/StructureDefinition/structuredefinition-category";
const STATUS_EXT_URL =
	"http://hl7.org/fhir/StructureDefinition/structuredefinition-standards-status";

const STATUS_VALUES = new Set([
	"normative",
	"trial-use",
	"draft",
	"informative",
]);

type SDExtension = {
	url?: string;
	valueString?: string;
	valueCode?: string;
};

type SDItem = {
	resourceType: string;
	name: string;
	url: string;
	description?: string;
	categoryTop?: string;
	categorySub?: string;
	standardsStatus?: string;
};

function decodeAmp(s: string): string {
	return s.replace(/&amp;/g, "&");
}

function parseCategory(extensions: SDExtension[] | undefined): {
	top?: string;
	sub?: string;
} {
	const ext = extensions?.find((e) => e.url === CATEGORY_EXT_URL);
	if (!ext?.valueString) return {};
	const raw = decodeAmp(ext.valueString);
	const dot = raw.indexOf(".");
	if (dot === -1) return { top: raw };
	return { top: raw.slice(0, dot), sub: raw.slice(dot + 1) };
}

function parseStandardsStatus(
	extensions: SDExtension[] | undefined,
): string | undefined {
	const ext = extensions?.find((e) => e.url === STATUS_EXT_URL);
	return ext?.valueCode;
}

function itemTagSlugs(item: SDItem): string[] {
	const slugs: string[] = [tagSlug(item.resourceType)];
	if (item.categoryTop) slugs.push(tagSlug(item.categoryTop));
	if (item.categorySub) slugs.push(tagSlug(item.categorySub));
	if (item.standardsStatus) slugs.push(tagSlug(item.standardsStatus));
	return slugs;
}

function filterByTags(items: SDItem[], tagTokens: string[]): SDItem[] {
	if (tagTokens.length === 0) return items;
	return items.filter((item) => {
		const slugs = itemTagSlugs(item);
		return tagTokens.every((tag) => slugs.some((slug) => slug === tag));
	});
}

function chipStyleFor(slug: string): string {
	if (STATUS_VALUES.has(slug)) return "bg-yellow-50 text-text-warning-primary";
	return "bg-blue-50 text-text-info-primary";
}

type StructureDefinitionResource = {
	resourceType: "StructureDefinition";
	type?: string;
	name?: string;
	url?: string;
	description?: string;
	extension?: SDExtension[];
};

type StructureDefinitionBundle = {
	entry?: { resource: StructureDefinitionResource }[];
};

function useStructureDefinitions(client: AidboxClientR5) {
	return useQuery<SDItem[]>({
		queryKey: ["resource-browser-sd"],
		staleTime: 5 * 60 * 1000,
		queryFn: async () => {
			const response = await client.rawRequest({
				method: "GET",
				url: "/fhir/StructureDefinition?kind=resource&derivation=specialization&_count=1000&_elements=type,name,url,description,extension",
			});
			const bundle: StructureDefinitionBundle = await response.response.json();
			return (bundle.entry ?? []).flatMap((entry) => {
				const r = entry.resource;
				const resourceType = r.type ?? r.name;
				if (!resourceType) return [];
				const cat = parseCategory(r.extension);
				return [
					{
						resourceType,
						name: r.name ?? resourceType,
						url: r.url ?? "",
						description: r.description,
						categoryTop: cat.top,
						categorySub: cat.sub,
						standardsStatus: parseStandardsStatus(r.extension),
					} satisfies SDItem,
				];
			});
		},
	});
}

type SortColumn = "name" | "url";
type SortDirection = "asc" | "desc";
type SortState = { column: SortColumn; direction: SortDirection };

function Badge({ text, onClick }: { text: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				onClick();
			}}
			className="shrink-0 text-[11px] leading-4 normal-case whitespace-nowrap text-text-info-primary cursor-pointer hover:underline data-[status=true]:text-text-warning-primary"
			data-status={STATUS_VALUES.has(tagSlug(text))}
		>
			#{text}
		</button>
	);
}

function ItemCard({
	item,
	isFavorite,
	onTagClick,
	onToggleFavorite,
	focused,
	rowRef,
}: {
	item: SDItem;
	isFavorite: boolean;
	onTagClick: (text: string) => void;
	onToggleFavorite: () => void;
	focused: boolean;
	rowRef?: React.Ref<HTMLLIElement>;
}) {
	return (
		<li
			ref={rowRef}
			className={`relative group/row transition-colors hover:bg-bg-secondary ${focused ? "bg-bg-secondary" : ""}`}
		>
			<Link
				to="/resource/$resourceType"
				params={{ resourceType: item.resourceType }}
				className="block"
			>
				<div className="flex flex-col pl-3 pr-10 py-3 min-w-0">
					<div className="typo-body text-text-primary truncate first-letter:uppercase">
						{item.name}
					</div>
					{item.description && (
						<div className="typo-body-xs text-text-secondary mt-0.5">
							{item.description}
						</div>
					)}
					{(item.categoryTop || item.standardsStatus) && (
						<div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2">
							{item.categoryTop && (
								<Badge
									text={item.categoryTop}
									onClick={() => onTagClick(item.categoryTop ?? "")}
								/>
							)}
							{item.categorySub && (
								<Badge
									text={item.categorySub}
									onClick={() => onTagClick(item.categorySub ?? "")}
								/>
							)}
							{item.standardsStatus && (
								<Badge
									text={item.standardsStatus}
									onClick={() => onTagClick(item.standardsStatus ?? "")}
								/>
							)}
						</div>
					)}
				</div>
			</Link>
			<button
				type="button"
				aria-label={isFavorite ? "Unpin" : "Pin"}
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					onToggleFavorite();
				}}
				className={`absolute top-2 right-2 size-7 flex items-center justify-center rounded hover:bg-bg-tertiary transition-opacity ${isFavorite ? "opacity-100 text-text-info-primary" : "opacity-0 group-hover/row:opacity-100 text-text-secondary"}`}
			>
				<Pin className="size-4" />
			</button>
		</li>
	);
}

function SearchBar({
	chips,
	textPart,
	inputRef,
	onTextChange,
	onRemoveChip,
	onClear,
	onInputKeyDown,
}: {
	chips: string[];
	textPart: string;
	inputRef: (el: HTMLInputElement | null) => void;
	onTextChange: (next: string) => void;
	onRemoveChip: (slug: string) => void;
	onClear: () => void;
	onInputKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
	return (
		<div className="flex flex-1 items-center gap-2 min-h-9 px-3 py-1 rounded-lg border border-border-primary bg-bg-primary flex-wrap">
			<Search className="size-4 text-text-tertiary shrink-0" />
			{chips.map((chip) => (
				<span
					key={chip}
					className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] leading-4 whitespace-nowrap ${chipStyleFor(chip)}`}
				>
					#{chip}
					<button
						type="button"
						aria-label={`Remove tag ${chip}`}
						onClick={() => onRemoveChip(chip)}
						className="flex items-center justify-center rounded opacity-70 hover:opacity-100"
					>
						<X className="size-3" />
					</button>
				</span>
			))}
			<input
				ref={inputRef}
				value={textPart}
				onChange={(e) => onTextChange(e.target.value)}
				onKeyDown={(e) => {
					const last = chips[chips.length - 1];
					if (e.key === "Backspace" && textPart === "" && last) {
						e.preventDefault();
						onRemoveChip(last);
						return;
					}
					onInputKeyDown?.(e);
				}}
				placeholder={
					chips.length === 0 ? "Search resources by name or description…" : ""
				}
				className="flex-1 min-w-[80px] bg-transparent outline-none typo-body text-text-primary placeholder:text-text-tertiary"
			/>
			{(chips.length > 0 || textPart.length > 0) && (
				<HSComp.IconButton
					variant="link"
					aria-label="Clear"
					onClick={onClear}
					icon={<X />}
				/>
			)}
		</div>
	);
}

function SortDropdown({
	sort,
	onChange,
}: {
	sort: SortState;
	onChange: (s: SortState) => void;
}) {
	const label =
		sort.column === "name"
			? sort.direction === "asc"
				? "Name A→Z"
				: "Name Z→A"
			: sort.direction === "asc"
				? "URL A→Z"
				: "URL Z→A";
	const Icon = sort.direction === "asc" ? ArrowDownAZ : ArrowDownZA;
	return (
		<HSComp.DropdownMenu>
			<HSComp.DropdownMenuTrigger asChild>
				<HSComp.Button variant="secondary">
					<Icon className="size-4" />
					{label}
				</HSComp.Button>
			</HSComp.DropdownMenuTrigger>
			<HSComp.DropdownMenuContent align="end">
				<HSComp.DropdownMenuItem
					className="justify-start!"
					onSelect={() => onChange({ column: "name", direction: "asc" })}
				>
					<ArrowDownAZ className="size-4" />
					Name A→Z
				</HSComp.DropdownMenuItem>
				<HSComp.DropdownMenuItem
					className="justify-start!"
					onSelect={() => onChange({ column: "name", direction: "desc" })}
				>
					<ArrowDownZA className="size-4" />
					Name Z→A
				</HSComp.DropdownMenuItem>
				<HSComp.DropdownMenuItem
					className="justify-start!"
					onSelect={() => onChange({ column: "url", direction: "asc" })}
				>
					<ArrowUpDown className="size-4" />
					URL A→Z
				</HSComp.DropdownMenuItem>
				<HSComp.DropdownMenuItem
					className="justify-start!"
					onSelect={() => onChange({ column: "url", direction: "desc" })}
				>
					<ArrowUpDown className="size-4" />
					URL Z→A
				</HSComp.DropdownMenuItem>
			</HSComp.DropdownMenuContent>
		</HSComp.DropdownMenu>
	);
}

function sortItems(items: SDItem[], sort: SortState): SDItem[] {
	const sorted = [...items];
	sorted.sort((a, b) => {
		const av = sort.column === "name" ? a.name : a.url;
		const bv = sort.column === "name" ? b.name : b.url;
		const cmp = av.localeCompare(bv);
		return sort.direction === "asc" ? cmp : -cmp;
	});
	return sorted;
}

function applyFavorites(
	items: SDItem[],
	favorites: Set<string>,
	hasQuery: boolean,
): SDItem[] {
	if (hasQuery) return items;
	return [...items].sort((a, b) => {
		const af = favorites.has(a.resourceType);
		const bf = favorites.has(b.resourceType);
		if (af === bf) return 0;
		return af ? -1 : 1;
	});
}

export function Browser() {
	const client = useAidboxClient();
	const { q } = useSearch({ from: "/resource/" });
	const navigate = useNavigate();

	const searchQ = q ?? "";
	const { chips, text: textPart } = parseQuery(searchQ);
	const tagTokens = chips.map((c) => c.toLowerCase());

	const setSearchQ = (value: string) => {
		navigate({
			from: "/resource/",
			search: (prev) => ({ ...prev, q: value || undefined }),
		});
	};

	const [favoritesArray, setFavoritesArray] = useLocalStorage<string[]>({
		key: "resource-browser-favorites",
		defaultValue: [],
	});
	const favorites = useMemo(() => new Set(favoritesArray), [favoritesArray]);

	const [sort, setSort] = React.useState<SortState>({
		column: "name",
		direction: "asc",
	});

	const { data, isLoading } = useStructureDefinitions(client);
	const allItems = data ?? [];

	const tagFiltered = filterByTags(allItems, tagTokens);

	const fuzzy = useMemo(
		() =>
			createFuzzySearch(tagFiltered, {
				keys: [
					{ name: "name", weight: 2 },
					{ name: "description", weight: 1 },
				],
				minMatchCharLength: 1,
				threshold: 0.3,
			}),
		[tagFiltered],
	);

	const textFiltered = textPart ? fuzzy(textPart) : tagFiltered;
	const sorted = sortItems(textFiltered, sort);
	const items = applyFavorites(sorted, favorites, Boolean(searchQ));

	const handleTagClick = (tagText: string) => {
		const slug = tagSlug(tagText);
		if (chips.includes(slug)) return;
		setSearchQ(buildQuery([...chips, slug], textPart));
	};
	const removeChip = (slug: string) => {
		setSearchQ(
			buildQuery(
				chips.filter((c) => c !== slug),
				textPart,
			),
		);
	};
	const updateTextPart = (next: string) => {
		setSearchQ(buildQuery(chips, next));
	};

	const toggleFavorite = (resourceType: string) => {
		setFavoritesArray((prev) =>
			prev.includes(resourceType)
				? prev.filter((x) => x !== resourceType)
				: [...prev, resourceType],
		);
	};

	const [focusedIndex, setFocusedIndex] = React.useState(-1);
	const focusedRowRef = useRef<HTMLLIElement | null>(null);
	const didFocus = useRef(false);
	const setSearchInputRef = React.useCallback((el: HTMLInputElement | null) => {
		if (el && !didFocus.current) {
			el.focus();
			didFocus.current = true;
		}
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: focusedIndex triggers scroll
	React.useEffect(() => {
		focusedRowRef.current?.scrollIntoView({ block: "nearest" });
	}, [focusedIndex]);

	React.useEffect(() => {
		setFocusedIndex(-1);
	}, []);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
			e.preventDefault();
			setFocusedIndex((p) => Math.min(p + 1, items.length - 1));
		} else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
			e.preventDefault();
			setFocusedIndex((p) => Math.max(p - 1, -1));
		} else if (
			e.key === "Enter" &&
			focusedIndex >= 0 &&
			focusedIndex < items.length
		) {
			const it = items[focusedIndex];
			if (!it) return;
			e.preventDefault();
			navigate({
				to: "/resource/$resourceType",
				params: { resourceType: it.resourceType },
			});
		}
	};

	const actionsRef = useRef<ResourceBrowserActions>(null);
	useWebMCPResourceBrowser(actionsRef);
	actionsRef.current = {
		listResourceTypes: (filter) => {
			if (filter !== undefined) setSearchQ(filter);
			const q2 = filter ?? searchQ;
			const parsed = parseQuery(q2);
			const tags = parsed.chips.map((c) => c.toLowerCase());
			const filtered = filterByTags(allItems, tags);
			const t = parsed.text
				? createFuzzySearch(filtered, {
						keys: [
							{ name: "name", weight: 2 },
							{ name: "description", weight: 1 },
						],
						minMatchCharLength: 1,
						threshold: 0.3,
					})(parsed.text)
				: filtered;
			const sortedRes = sortItems(t, sort);
			const finalList = applyFavorites(sortedRes, favorites, Boolean(q2));
			return finalList.map((row) => ({
				resourceType: row.resourceType,
				url: row.url,
				isFavorite: favorites.has(row.resourceType),
			}));
		},
		getFavorites: () => favoritesArray,
		toggleFavorite,
		navigateToResourceType: (resourceType) => {
			navigate({
				to: "/resource/$resourceType",
				params: { resourceType },
			});
		},
	};

	return (
		<div className="h-full overflow-y-auto pb-[250px]">
			<div className="sticky top-0 z-10 bg-bg-primary py-4 shadow-[0_10px_10px_0_var(--color-bg-primary)]">
				<div className="mx-auto max-w-[990px] px-8 flex items-center gap-2">
					<SearchBar
						chips={chips}
						textPart={textPart}
						inputRef={setSearchInputRef}
						onTextChange={updateTextPart}
						onRemoveChip={removeChip}
						onClear={() => setSearchQ("")}
						onInputKeyDown={handleKeyDown}
					/>
					<SortDropdown sort={sort} onChange={setSort} />
				</div>
			</div>
			{!isLoading && items.length === 0 ? (
				<div className="mx-auto max-w-[990px] px-8">
					<EmptyState
						title="No resource types found"
						description="Try a different search query"
					/>
				</div>
			) : (
				<ul className="mx-auto max-w-[990px] px-8 bg-bg-primary divide-y divide-border-default">
					{items.map((it, index) => (
						<ItemCard
							key={it.resourceType}
							item={it}
							isFavorite={favorites.has(it.resourceType)}
							onTagClick={handleTagClick}
							onToggleFavorite={() => toggleFavorite(it.resourceType)}
							focused={index === focusedIndex}
							rowRef={index === focusedIndex ? focusedRowRef : undefined}
						/>
					))}
				</ul>
			)}
		</div>
	);
}
