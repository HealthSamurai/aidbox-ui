import { useLocalStorage } from "@aidbox-ui/hooks/useLocalStorage";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import Fuse from "fuse.js";
import { Pin, Search, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import { createFuzzySearch } from "../../utils/fuzzy-search";
import {
	filterHighlightRanges,
	highlight,
	type MatchRange,
} from "../../utils/highlight";
import { parseQuery, tagSlug } from "../../utils/tag-search";
import { useWebMCPResourceBrowser } from "../../webmcp/resource-browser";
import type { ResourceBrowserActions } from "../../webmcp/resource-browser-context";
import { EmptyState } from "../empty-state";

const CATEGORY_EXT_URL =
	"http://hl7.org/fhir/StructureDefinition/structuredefinition-category";
const STATUS_EXT_URL =
	"http://hl7.org/fhir/StructureDefinition/structuredefinition-standards-status";

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
	origin?: string;
	nameMatches?: readonly MatchRange[];
	descriptionMatches?: readonly MatchRange[];
};

const AIDBOX_PUBLISHER = "Health Samurai";
const FHIR_PUBLISHER_PREFIX = "Health Level Seven";

function publisherToOrigin(publisher: string | undefined): string | undefined {
	if (publisher === AIDBOX_PUBLISHER) return "Aidbox";
	if (publisher?.startsWith(FHIR_PUBLISHER_PREFIX)) return "FHIR";
	return undefined;
}

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
	if (item.origin) slugs.push(tagSlug(item.origin));
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

const CHIP_STYLE = "bg-blue-50 text-text-info-primary";

type StructureDefinitionResource = {
	resourceType: "StructureDefinition";
	type?: string;
	name?: string;
	url?: string;
	description?: string;
	publisher?: string;
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
				url: "/fhir/StructureDefinition?kind=resource&derivation=specialization&abstract=false&_count=1000&_elements=type,name,url,description,extension,publisher",
				headers: {
					"Cache-Control": "max-age=300",
				},
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
						origin: publisherToOrigin(r.publisher),
					} satisfies SDItem,
				];
			});
		},
	});
}

function Badge({ text, onClick }: { text: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				onClick();
			}}
			className="shrink-0 text-[11px] leading-4 normal-case whitespace-nowrap cursor-pointer hover:underline text-text-info-primary"
		>
			#{text}
		</button>
	);
}

const ItemCard = React.memo(function ItemCard({
	item,
	isFavorite,
	onTagClick,
	onToggleFavorite,
	focused,
}: {
	item: SDItem;
	isFavorite: boolean;
	onTagClick: (text: string) => void;
	onToggleFavorite: (resourceType: string) => void;
	focused: boolean;
}) {
	return (
		<li
			className={`relative group/row transition-colors hover:bg-bg-secondary border-b border-border-default ${focused ? "bg-bg-secondary" : ""}`}
		>
			<Link
				to="/resource/$resourceType"
				params={{ resourceType: item.resourceType }}
				className="block"
			>
				<div className="flex flex-col pl-3 pr-10 py-3 min-w-0">
					<div className="typo-body text-text-primary truncate font-medium!">
						{highlight(item.name, item.nameMatches)}
					</div>
					{item.description && (
						<div className="typo-body-xs text-text-secondary mt-0.5 line-clamp-2">
							{highlight(item.description, item.descriptionMatches)}
						</div>
					)}
					{(item.origin || item.categoryTop || item.standardsStatus) && (
						<div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2">
							{item.origin && (
								<Badge
									text={item.origin}
									onClick={() => onTagClick(item.origin ?? "")}
								/>
							)}
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
					onToggleFavorite(item.resourceType);
				}}
				className={`absolute top-2 right-2 size-7 flex items-center justify-center rounded hover:bg-bg-tertiary transition-opacity ${isFavorite ? "opacity-100 text-text-info-primary" : "opacity-0 group-hover/row:opacity-100 text-text-secondary"}`}
			>
				<Pin className="size-4" />
			</button>
		</li>
	);
});

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
				<button
					key={chip}
					type="button"
					aria-label={`Remove tag ${chip}`}
					onClick={() => onRemoveChip(chip)}
					className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] leading-4 whitespace-nowrap cursor-pointer ${CHIP_STYLE}`}
				>
					#{chip}
					<X className="size-3 opacity-70" />
				</button>
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

function sortByName(items: SDItem[]): SDItem[] {
	return [...items].sort((a, b) => a.name.localeCompare(b.name));
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
	const search = useSearch({ from: "/resource/" });
	const navigate = useNavigate();

	const urlText = search.q ?? "";
	const chips = search.tags ?? [];
	const tagTokens = chips.map(tagSlug);

	// Local input state for instant typing; URL sync is debounced + non-blocking.
	const [inputText, setInputText] = React.useState(urlText);
	const text = React.useDeferredValue(inputText);
	const hasQuery = chips.length > 0 || Boolean(text);

	// Pull external URL changes (back/forward, navigate from outside) back into local state.
	const lastUrlTextRef = useRef(urlText);
	useEffect(() => {
		if (urlText !== lastUrlTextRef.current) {
			lastUrlTextRef.current = urlText;
			setInputText(urlText);
		}
	}, [urlText]);

	const urlSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const setText = useCallback(
		(next: string) => {
			setInputText(next);
			if (urlSyncTimerRef.current) clearTimeout(urlSyncTimerRef.current);
			urlSyncTimerRef.current = setTimeout(() => {
				lastUrlTextRef.current = next;
				navigate({
					from: "/resource/",
					search: (prev) => ({ ...prev, q: next || undefined }),
					replace: true,
				});
			}, 200);
		},
		[navigate],
	);
	useEffect(
		() => () => {
			if (urlSyncTimerRef.current) clearTimeout(urlSyncTimerRef.current);
		},
		[],
	);
	const setTags = useCallback(
		(next: string[]) => {
			navigate({
				from: "/resource/",
				search: (prev) => ({
					...prev,
					tags: next.length > 0 ? next : undefined,
				}),
				replace: true,
			});
		},
		[navigate],
	);

	const [favoritesArray, setFavoritesArray] = useLocalStorage<string[]>({
		key: "resource-browser-favorites",
		defaultValue: [],
	});
	const favorites = useMemo(() => new Set(favoritesArray), [favoritesArray]);

	const { data, isLoading } = useStructureDefinitions(client);
	const allItems = data ?? [];

	const tagFiltered = filterByTags(allItems, tagTokens);

	const fuse = useMemo(
		() =>
			new Fuse(tagFiltered, {
				keys: [
					{ name: "name", weight: 10 },
					{ name: "description", weight: 1 },
				],
				includeMatches: true,
				ignoreLocation: true,
				useExtendedSearch: true,
				minMatchCharLength: 1,
				threshold: 0.3,
			}),
		[tagFiltered],
	);

	const textFiltered: SDItem[] = text
		? fuse.search(text).map((r) => {
				const nameMatch = r.matches?.find((m) => m.key === "name");
				const descMatch = r.matches?.find((m) => m.key === "description");
				return {
					...r.item,
					nameMatches: filterHighlightRanges(
						text,
						nameMatch?.indices as readonly MatchRange[] | undefined,
					),
					descriptionMatches: filterHighlightRanges(
						text,
						descMatch?.indices as readonly MatchRange[] | undefined,
					),
				};
			})
		: sortByName(tagFiltered);
	const items = applyFavorites(textFiltered, favorites, hasQuery);

	const chipsRef = useRef(chips);
	chipsRef.current = chips;
	const handleTagClick = useCallback(
		(tagText: string) => {
			const slug = tagSlug(tagText);
			const current = chipsRef.current;
			if (current.some((c) => tagSlug(c) === slug)) return;
			setTags([...current, tagText]);
		},
		[setTags],
	);
	const removeChip = (tag: string) => {
		setTags(chips.filter((c) => c !== tag));
	};
	const updateTextPart = (next: string) => {
		// last token without trailing whitespace is "in progress" — don't parse yet
		let toParse = next;
		let tail = "";
		if (!/\s$/.test(next)) {
			const m = next.match(/^(.*\s)(\S*)$/);
			if (m) {
				toParse = m[1] ?? "";
				tail = m[2] ?? "";
			} else {
				toParse = "";
				tail = next;
			}
		}
		const parsed = parseQuery(toParse);
		if (parsed.chips.length > 0) {
			const seen = new Set(chips.map(tagSlug));
			const extra: string[] = [];
			for (const c of parsed.chips) {
				const s = tagSlug(c);
				if (!seen.has(s)) {
					extra.push(c);
					seen.add(s);
				}
			}
			if (extra.length > 0) setTags([...chips, ...extra]);
			setText([parsed.text, tail].filter(Boolean).join(" "));
		} else {
			setText(next);
		}
	};
	const onClear = () => {
		setTags([]);
		setText("");
	};

	const toggleFavorite = useCallback(
		(resourceType: string) => {
			setFavoritesArray((prev) =>
				prev.includes(resourceType)
					? prev.filter((x) => x !== resourceType)
					: [...prev, resourceType],
			);
		},
		[setFavoritesArray],
	);

	const [focusedIndex, setFocusedIndex] = React.useState(-1);
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const didFocus = useRef(false);
	const setSearchInputRef = React.useCallback((el: HTMLInputElement | null) => {
		if (el && !didFocus.current) {
			el.focus();
			didFocus.current = true;
		}
	}, []);

	const rowVirtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => 90,
		overscan: 8,
		getItemKey: (index) => items[index]?.resourceType ?? index,
	});

	useEffect(() => {
		if (focusedIndex < 0) return;
		rowVirtualizer.scrollToIndex(focusedIndex, { align: "auto" });
	}, [focusedIndex, rowVirtualizer]);

	React.useEffect(() => {
		if (text && items.length > 0) setFocusedIndex(0);
		else setFocusedIndex(-1);
	}, [text, items.length]);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
			e.preventDefault();
			setFocusedIndex((p) => Math.min(p + 1, items.length - 1));
		} else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
			e.preventDefault();
			setFocusedIndex((p) => Math.max(p - 1, -1));
		} else if (e.key === "Enter") {
			if (focusedIndex < 0) return;
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
			let resolvedTags: string[];
			let resolvedText: string;
			if (filter !== undefined) {
				const parsed = parseQuery(filter);
				setTags(parsed.chips);
				setText(parsed.text);
				resolvedTags = parsed.chips.map(tagSlug);
				resolvedText = parsed.text;
			} else {
				resolvedTags = tagTokens;
				resolvedText = text;
			}
			const filtered = filterByTags(allItems, resolvedTags);
			const t = resolvedText
				? createFuzzySearch(filtered, {
						keys: [
							{ name: "name", weight: 2 },
							{ name: "description", weight: 1 },
						],
						minMatchCharLength: 1,
						threshold: 0.3,
					})(resolvedText)
				: sortByName(filtered);
			const finalList = applyFavorites(
				t,
				favorites,
				Boolean(resolvedText) || resolvedTags.length > 0,
			);
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
		<div ref={scrollRef} className="h-full overflow-y-auto pb-[250px]">
			<div className="sticky top-0 z-10 bg-bg-primary py-4 shadow-[0_10px_10px_0_var(--color-bg-primary)]">
				<div className="mx-auto max-w-[990px] px-8">
					<SearchBar
						chips={chips}
						textPart={inputText}
						inputRef={setSearchInputRef}
						onTextChange={updateTextPart}
						onRemoveChip={removeChip}
						onClear={onClear}
						onInputKeyDown={handleKeyDown}
					/>
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
				<div className="mx-auto max-w-[990px] px-8 bg-bg-primary">
					<ul
						style={{
							position: "relative",
							height: rowVirtualizer.getTotalSize(),
						}}
					>
						{rowVirtualizer.getVirtualItems().map((vi) => {
							const it = items[vi.index];
							if (!it) return null;
							return (
								<div
									key={it.resourceType}
									ref={rowVirtualizer.measureElement}
									data-index={vi.index}
									style={{
										position: "absolute",
										top: 0,
										left: 0,
										right: 0,
										transform: `translateY(${vi.start}px)`,
									}}
								>
									<ItemCard
										item={it}
										isFavorite={favorites.has(it.resourceType)}
										onTagClick={handleTagClick}
										onToggleFavorite={toggleFavorite}
										focused={vi.index === focusedIndex}
									/>
								</div>
							);
						})}
					</ul>
				</div>
			)}
		</div>
	);
}
