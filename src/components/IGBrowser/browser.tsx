import { useLocalStorage } from "@aidbox-ui/hooks/useLocalStorage";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import Fuse from "fuse.js";
import { Pin, PlusIcon, Search, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useAidboxClient } from "../../AidboxClient";
import { createFuzzySearch } from "../../utils/fuzzy-search";
import {
	filterHighlightRanges,
	highlight,
	type MatchRange,
} from "../../utils/highlight";
import { parseQuery, tagSlug } from "../../utils/tag-search";
import { useWebMCPIGBrowser } from "../../webmcp/ig-browser";
import type { IGBrowserActions } from "../../webmcp/ig-browser-context";
import { EmptyState } from "../empty-state";

type Installation = {
	intention?: string;
};

type PackageTag = "system" | "direct" | "transitive";

type PackageItem = {
	id: string;
	name: string;
	version: string;
	description?: string;
	tags: string[];
	nameMatches?: readonly MatchRange[];
	descriptionMatches?: readonly MatchRange[];
};

const SYSTEM_PREFIXES = [
	"io.health-samurai.core",
	"io.health-samurai.sdc",
	"io.health-samurai.mdm",
];

function getPackageTag(name: string, installation: Installation[]): PackageTag {
	if (SYSTEM_PREFIXES.some((prefix) => name.startsWith(prefix))) {
		return "system";
	}
	return installation?.[0]?.intention === "transitive"
		? "transitive"
		: "direct";
}

function usePackagesData() {
	const client = useAidboxClient();

	return useQuery<PackageItem[]>({
		queryKey: ["ig-browser-packages"],
		staleTime: 5 * 60 * 1000,
		queryFn: async () => {
			const response = await client.rawRequest({
				method: "POST",
				url: "/rpc?_m=aidbox.profiles/list-packages",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					method: "aidbox.profiles/list-packages",
					params: {},
				}),
			});
			const json = await response.response.json();
			const data: Record<string, unknown>[] = json.data ?? json.result ?? [];
			return data.map((pkg) => {
				const name = (pkg.name as string) ?? "";
				const version = (pkg.version as string) ?? "";
				const installation = (pkg.installation as Installation[]) ?? [];
				const typeTag = (pkg.type as string | undefined)?.toLowerCase();
				return {
					id: `${name}#${version}`,
					name,
					version,
					description: (pkg.description ?? pkg.author ?? pkg.title) as
						| string
						| undefined,
					tags: typeTag
						? [getPackageTag(name, installation), typeTag]
						: [getPackageTag(name, installation)],
				} satisfies PackageItem;
			});
		},
	});
}

const CHIP_STYLE = "bg-blue-50 text-text-info-primary";

function itemTagSlugs(item: PackageItem): string[] {
	return item.tags.map(tagSlug);
}

function filterByTags(
	items: PackageItem[],
	tagTokens: string[],
): PackageItem[] {
	if (tagTokens.length === 0) return items;
	return items.filter((item) => {
		const slugs = itemTagSlugs(item);
		return tagTokens.every((tag) => slugs.some((slug) => slug === tag));
	});
}

function sortByName(items: PackageItem[]): PackageItem[] {
	return [...items].sort(
		(a, b) =>
			a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
	);
}

function applyFavorites(
	items: PackageItem[],
	favorites: Set<string>,
	hasQuery: boolean,
): PackageItem[] {
	if (hasQuery) return items;
	return [...items].sort((a, b) => {
		const af = favorites.has(a.id);
		const bf = favorites.has(b.id);
		if (af === bf) return 0;
		return af ? -1 : 1;
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
	item: PackageItem;
	isFavorite: boolean;
	onTagClick: (text: string) => void;
	onToggleFavorite: (id: string) => void;
	focused: boolean;
}) {
	return (
		<li
			className={`relative group/row transition-colors hover:bg-bg-secondary border-b border-border-default ${focused ? "bg-bg-secondary" : ""}`}
		>
			<Link
				to="/ig/$packageId"
				params={{ packageId: item.id }}
				search={{
					tab: undefined,
					view: undefined,
					q: undefined,
				}}
				className="block"
			>
				<div className="flex flex-col pl-4 pr-10 py-3 min-w-0">
					<div className="typo-body text-text-primary truncate">
						{highlight(item.name, item.nameMatches)}{" "}
						<span className="text-text-secondary">{item.version}</span>
					</div>
					{item.description && (
						<div className="typo-body-xs text-text-secondary mt-0.5 line-clamp-1">
							{highlight(item.description, item.descriptionMatches)}
						</div>
					)}
					<div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2">
						{item.tags.map((t) => (
							<Badge key={t} text={t} onClick={() => onTagClick(t)} />
						))}
					</div>
				</div>
			</Link>
			<button
				type="button"
				aria-label={isFavorite ? "Unpin" : "Pin"}
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					onToggleFavorite(item.id);
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
					chips.length === 0 ? "Search packages by name or description…" : ""
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

export function Browser() {
	const search = useSearch({ from: "/ig/" });
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
					from: "/ig/",
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
				from: "/ig/",
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
		key: "ig-browser-favorites",
		defaultValue: [],
	});
	const favorites = useMemo(() => new Set(favoritesArray), [favoritesArray]);

	const { data, isLoading } = usePackagesData();
	const allItems = data ?? [];

	const tagFiltered = filterByTags(allItems, tagTokens);

	const fuse = useMemo(
		() =>
			new Fuse(tagFiltered, {
				keys: [
					{ name: "name", weight: 10 },
					{ name: "version", weight: 3 },
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

	const textFiltered: PackageItem[] = text
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
		(id: string) => {
			setFavoritesArray((prev) =>
				prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
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
		getItemKey: (index) => items[index]?.id ?? index,
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
				to: "/ig/$packageId",
				params: { packageId: it.id },
				search: {
					tab: undefined,
					view: undefined,
					q: undefined,
				},
			});
		}
	};

	const actionsRef = useRef<IGBrowserActions>({} as IGBrowserActions);
	actionsRef.current = {
		listPackages: (filter) => {
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
							{ name: "version", weight: 1 },
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
				name: row.name,
				version: row.version,
				tags: row.tags,
			}));
		},
		selectPackage: (id) => {
			navigate({
				to: "/ig/$packageId",
				params: { packageId: id },
				search: {
					tab: undefined,
					view: undefined,
					q: undefined,
				},
			});
		},
		openInstallationPage: () => {
			navigate({ to: "/ig/add" });
		},
	};
	useWebMCPIGBrowser(actionsRef);

	return (
		<div ref={scrollRef} className="h-full overflow-y-auto pb-[250px]">
			<div className="sticky top-0 z-10 bg-bg-primary py-4 shadow-[0_10px_10px_0_var(--color-bg-primary)]">
				<div className="mx-auto max-w-[990px] px-8 flex items-start gap-3">
					<SearchBar
						chips={chips}
						textPart={inputText}
						inputRef={setSearchInputRef}
						onTextChange={updateTextPart}
						onRemoveChip={removeChip}
						onClear={onClear}
						onInputKeyDown={handleKeyDown}
					/>
					<HSComp.Button variant="secondary" className="shrink-0" asChild>
						<Link to="/ig/add">
							<PlusIcon
								className="size-4 text-text-error-primary"
								strokeWidth={1.25}
							/>
							Package
						</Link>
					</HSComp.Button>
				</div>
			</div>
			{!isLoading && items.length === 0 ? (
				<div className="mx-auto max-w-[990px] px-8">
					<EmptyState
						title="No packages found"
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
									key={it.id}
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
										isFavorite={favorites.has(it.id)}
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
