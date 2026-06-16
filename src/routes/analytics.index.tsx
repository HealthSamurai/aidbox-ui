import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { ViewDefinition } from "@aidbox-ui/fhir-types/org-sql-on-fhir-ig";
import * as HSComp from "@health-samurai/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import Fuse from "fuse.js";
import {
	EllipsisVertical,
	FileCode2,
	GitBranch,
	Layers,
	Plus,
	Search,
	Table,
	Trash2,
	X,
} from "lucide-react";
import * as React from "react";
import { useAidboxClient } from "../AidboxClient";
import { EmptyState } from "../components/empty-state";
import {
	filterHighlightRanges,
	highlight,
	type MatchRange,
} from "../utils/highlight";
import { parseQuery, tagSlug } from "../utils/tag-search";

const SQL_QUERY_TYPE_TOKEN =
	"https://sql-on-fhir.org/ig/CodeSystem/LibraryTypesCodes|sql-query";
const SQL_VIEW_TYPE_TOKEN =
	"https://sql-on-fhir.org/ig/CodeSystem/LibraryTypesCodes|sql-view";

type AnalyticsKind = "view" | "query" | "sql-view";

const KIND_META: Record<
	AnalyticsKind,
	{ label: string; accentClass: string; Icon: typeof Table }
> = {
	view: {
		label: "ViewDefinition",
		accentClass: "text-text-info-primary",
		Icon: Table,
	},
	query: {
		label: "SQLQuery",
		accentClass: "text-text-warning-primary",
		Icon: FileCode2,
	},
	"sql-view": {
		label: "SQLView",
		accentClass: "text-text-success-primary",
		Icon: Layers,
	},
};

const RECENT_QUERY_KEY: Record<AnalyticsKind, string> = {
	view: "analytics-recent-views",
	query: "analytics-recent-queries",
	"sql-view": "analytics-recent-sql-views",
};

function editRoutePath(kind: AnalyticsKind) {
	if (kind === "view") return "/analytics/views/edit/$id" as const;
	if (kind === "sql-view") return "/analytics/sqlview/edit/$id" as const;
	return "/analytics/queries/edit/$id" as const;
}

type LibraryResource = {
	resourceType: "Library";
	id?: string;
	name?: string;
	title?: string;
	description?: string;
	url?: string;
	meta?: { lastUpdated?: string };
	relatedArtifact?: Array<{
		type?: string;
		label?: string;
		resource?: string;
	}>;
};

type RelatedArtifactRef = {
	url: string;
	label?: string;
};

type RecentItem = {
	kind: AnalyticsKind;
	id: string;
	url?: string;
	resource?: string;
	relatedArtifacts?: RelatedArtifactRef[];
	label: string;
	description?: string;
	lastUpdated?: string;
	labelMatches?: readonly MatchRange[];
	descriptionMatches?: readonly MatchRange[];
};

const VIEW_EDIT_SEARCH = {
	tab: "builder" as const,
	mode: "json" as const,
	builderTab: "form" as const,
};
const QUERY_EDIT_SEARCH = {
	tab: "sqlquery" as const,
	mode: "json" as const,
	builderTab: "form" as const,
};
function pickLabel(r: { id?: string; name?: string; title?: string }): string {
	return r.title || r.name || r.id || "(unnamed)";
}

function useRecentViews() {
	const client = useAidboxClient();
	return useQuery<RecentItem[]>({
		queryKey: ["analytics-recent-views"],
		queryFn: async () => {
			const r = await client.request<Bundle>({
				method: "GET",
				url: "/fhir/ViewDefinition",
				params: [
					["_count", "1000"],
					["_sort", "-_lastUpdated"],
				],
			});
			if (r.isErr()) return [];
			return (r.value.resource.entry ?? []).flatMap((e) => {
				const vd = e.resource as
					| (ViewDefinition & {
							description?: string;
							url?: string;
							meta?: { lastUpdated?: string };
					  })
					| undefined;
				if (!vd?.id) return [];
				return [
					{
						kind: "view",
						id: vd.id,
						url: vd.url,
						resource: vd.resource,
						label: pickLabel(vd),
						description: vd.description,
						lastUpdated: vd.meta?.lastUpdated,
					} satisfies RecentItem,
				];
			});
		},
	});
}

function useRecentQueries() {
	const client = useAidboxClient();
	return useQuery<RecentItem[]>({
		queryKey: ["analytics-recent-queries"],
		queryFn: async () => {
			const r = await client.request<Bundle>({
				method: "GET",
				url: "/fhir/Library",
				params: [
					["_count", "1000"],
					["_sort", "-_lastUpdated"],
					["type", SQL_QUERY_TYPE_TOKEN],
				],
			});
			if (r.isErr()) return [];
			return (r.value.resource.entry ?? []).flatMap((e) => {
				const lib = e.resource as LibraryResource | undefined;
				if (!lib?.id) return [];
				const relatedArtifacts = (lib.relatedArtifact ?? []).flatMap((ra) =>
					ra.resource ? [{ url: ra.resource, label: ra.label }] : [],
				);
				return [
					{
						kind: "query",
						id: lib.id,
						url: lib.url,
						relatedArtifacts:
							relatedArtifacts.length > 0 ? relatedArtifacts : undefined,
						label: pickLabel(lib),
						description: lib.description,
						lastUpdated: lib.meta?.lastUpdated,
					} satisfies RecentItem,
				];
			});
		},
	});
}

function useRecentSqlViews() {
	const client = useAidboxClient();
	return useQuery<RecentItem[]>({
		queryKey: ["analytics-recent-sql-views"],
		queryFn: async () => {
			const r = await client.request<Bundle>({
				method: "GET",
				url: "/fhir/Library",
				params: [
					["_count", "1000"],
					["_sort", "-_lastUpdated"],
					["type", SQL_VIEW_TYPE_TOKEN],
				],
			});
			if (r.isErr()) return [];
			return (r.value.resource.entry ?? []).flatMap((e) => {
				const lib = e.resource as LibraryResource | undefined;
				if (!lib?.id) return [];
				const relatedArtifacts = (lib.relatedArtifact ?? []).flatMap((ra) =>
					ra.resource ? [{ url: ra.resource, label: ra.label }] : [],
				);
				return [
					{
						kind: "sql-view",
						id: lib.id,
						url: lib.url,
						relatedArtifacts:
							relatedArtifacts.length > 0 ? relatedArtifacts : undefined,
						label: pickLabel(lib),
						description: lib.description,
						lastUpdated: lib.meta?.lastUpdated,
					} satisfies RecentItem,
				];
			});
		},
	});
}

type LookupByUrl = (url: string) => RecentItem | undefined;

function getItemTagSlugs(item: RecentItem, lookup: LookupByUrl): string[] {
	const slugs: string[] = [tagSlug(item.label)];
	if (item.resource) slugs.push(tagSlug(item.resource));
	if (item.relatedArtifacts) {
		for (const ra of item.relatedArtifacts) {
			const linked = lookup(ra.url);
			const text = linked?.label ?? ra.label ?? ra.url;
			slugs.push(tagSlug(text));
		}
	}
	return slugs;
}

function filterByTags(
	items: RecentItem[],
	tagTokens: string[],
	lookup: LookupByUrl,
): RecentItem[] {
	if (tagTokens.length === 0) return items;
	return items.filter((item) => {
		const slugs = getItemTagSlugs(item, lookup);
		return tagTokens.every((tag) => slugs.some((slug) => slug === tag));
	});
}

function chipStyleFor(tag: string, items: RecentItem[]): string {
	const slug = tagSlug(tag);
	for (const item of items) {
		if (tagSlug(item.label) === slug) {
			if (item.kind === "view") return "bg-blue-50 text-text-info-primary";
			if (item.kind === "sql-view") {
				return "bg-green-50 text-text-success-primary";
			}
			return "bg-yellow-50 text-text-warning-primary";
		}
	}
	for (const item of items) {
		if (item.resource && tagSlug(item.resource) === slug) {
			return "bg-green-50 text-text-success-primary";
		}
	}
	return "bg-bg-tertiary text-text-primary";
}

function Badge({
	text,
	accentClass,
	onClick,
}: {
	text: string;
	accentClass: string;
	onClick?: () => void;
}) {
	const base = `shrink-0 text-[11px] leading-4 normal-case whitespace-nowrap ${accentClass}`;
	if (onClick) {
		return (
			<button
				type="button"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					onClick();
				}}
				className={`${base} cursor-pointer hover:underline`}
			>
				#{text}
			</button>
		);
	}
	return <span className={base}>#{text}</span>;
}

function ItemRow({
	item,
	lookup,
	showKindLabel = true,
	onTagClick,
}: {
	item: RecentItem;
	lookup: LookupByUrl;
	showKindLabel?: boolean;
	onTagClick?: (text: string) => void;
}) {
	const isView = item.kind === "view";
	const { Icon, label: kindLabel, accentClass } = KIND_META[item.kind];
	const badges: React.ReactNode[] = [];
	if (isView && item.resource) {
		const resourceText = item.resource;
		badges.push(
			<Badge
				key="resource"
				text={resourceText}
				accentClass="text-text-success-primary"
				onClick={onTagClick ? () => onTagClick(resourceText) : undefined}
			/>,
		);
	}
	if (!isView && item.relatedArtifacts) {
		for (const ra of item.relatedArtifacts) {
			const linked = lookup(ra.url);
			const text = linked?.label ?? ra.label ?? ra.url;
			const accent = linked
				? KIND_META[linked.kind].accentClass
				: ra.url.includes("/ViewDefinition/")
					? KIND_META.view.accentClass
					: KIND_META.query.accentClass;
			badges.push(
				<Badge
					key={ra.url}
					text={text}
					accentClass={accent}
					onClick={onTagClick ? () => onTagClick(text) : undefined}
				/>,
			);
		}
	}
	return (
		<div className="flex flex-col pl-3.5 pr-4 py-3 min-w-0">
			{showKindLabel && (
				<div
					className={`flex items-center gap-1.5 typo-label-tiny uppercase tracking-wide ${accentClass}`}
				>
					<Icon className="size-3.5 shrink-0" />
					<span>{kindLabel}</span>
				</div>
			)}
			<div
				className={`typo-body text-text-primary truncate first-letter:uppercase ${showKindLabel ? "mt-0.5" : ""}`}
			>
				{highlight(item.label, item.labelMatches)}
			</div>
			{item.description && (
				<div className="typo-body-xs text-text-secondary mt-0.5">
					{highlight(item.description, item.descriptionMatches)}
				</div>
			)}
			{badges.length > 0 && (
				<div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2">{badges}</div>
			)}
		</div>
	);
}

export type AnalyticsListKind = AnalyticsKind;

const VIEW_CREATE_SEARCH = {
	tab: "builder" as const,
	mode: "json" as const,
	builderTab: "form" as const,
};
const QUERY_CREATE_SEARCH = {
	tab: "sqlquery" as const,
	mode: "json" as const,
	builderTab: "form" as const,
};
const SQLVIEW_CREATE_SEARCH = QUERY_CREATE_SEARCH;

function SearchBar({
	chips,
	textPart,
	placeholder,
	allItems,
	inputRef,
	onTextChange,
	onRemoveChip,
	onClear,
	onInputKeyDown,
}: {
	chips: string[];
	textPart: string;
	placeholder: string;
	allItems: RecentItem[];
	inputRef: (el: HTMLInputElement | null) => void;
	onTextChange: (next: string) => void;
	onRemoveChip: (tag: string) => void;
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
					className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] leading-4 whitespace-nowrap cursor-pointer ${chipStyleFor(chip, allItems)}`}
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
				placeholder={chips.length === 0 ? placeholder : ""}
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

export function AnalyticsListPage({
	kind,
	tags,
	text,
	setTags,
	setText,
}: {
	kind?: AnalyticsListKind;
	tags: string[];
	text: string;
	setTags: (next: string[]) => void;
	setText: (next: string) => void;
}) {
	const views = useRecentViews();
	const queries = useRecentQueries();
	const sqlViews = useRecentSqlViews();
	const client = useAidboxClient();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const deleteMutation = useMutation({
		mutationFn: async (item: RecentItem) => {
			const url =
				item.kind === "view"
					? `/fhir/ViewDefinition/${item.id}`
					: `/fhir/Library/${item.id}`;
			const r = await client.request({ method: "DELETE", url });
			if (r.isErr()) throw new Error("Delete failed");
			return r.value;
		},
		onSuccess: (_data, item) => {
			queryClient.invalidateQueries({
				queryKey: [RECENT_QUERY_KEY[item.kind]],
			});
			HSComp.toast.success(`${KIND_META[item.kind].label} deleted`);
		},
		onError: () => {
			HSComp.toast.error("Failed to delete");
		},
	});
	const [openMenuKey, setOpenMenuKey] = React.useState<string | null>(null);
	const [confirmingDelete, setConfirmingDelete] =
		React.useState<RecentItem | null>(null);
	const openLineage = (item: RecentItem) => {
		navigate({
			to: editRoutePath(item.kind),
			params: { id: item.id },
			search: { tab: "lineage", mode: "json", builderTab: "form" },
		});
	};
	const didFocus = React.useRef(false);
	const setSearchInputRef = React.useCallback((el: HTMLInputElement | null) => {
		if (el && !didFocus.current) {
			el.focus();
			didFocus.current = true;
		}
	}, []);

	const combined: RecentItem[] = [
		...(views.data ?? []),
		...(queries.data ?? []),
		...(sqlViews.data ?? []),
	];
	const allItems: RecentItem[] = (
		kind === "view"
			? (views.data ?? [])
			: kind === "query"
				? (queries.data ?? [])
				: kind === "sql-view"
					? (sqlViews.data ?? [])
					: combined
	)
		.slice()
		.sort((a, b) => {
			const da = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
			const db = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
			return db - da;
		});
	const lookup: LookupByUrl = React.useMemo(() => {
		const map = new Map<string, RecentItem>();
		for (const it of [
			...(views.data ?? []),
			...(queries.data ?? []),
			...(sqlViews.data ?? []),
		]) {
			if (it.url) map.set(it.url, it);
		}
		return (url: string) => map.get(url);
	}, [views.data, queries.data, sqlViews.data]);
	const tagTokens = tags.map(tagSlug);
	const textQuery = text;

	const tagFiltered = filterByTags(allItems, tagTokens, lookup);

	const fuse = React.useMemo(
		() =>
			new Fuse(tagFiltered, {
				keys: ["label", "description"],
				includeMatches: true,
				threshold: 0.3,
				ignoreLocation: true,
				minMatchCharLength: 1,
			}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[tagFiltered],
	);
	const needle = textQuery;
	const items: RecentItem[] = needle
		? fuse.search(needle).map((r) => {
				const labelMatch = r.matches?.find((m) => m.key === "label");
				const descriptionMatch = r.matches?.find(
					(m) => m.key === "description",
				);
				return {
					...r.item,
					labelMatches: filterHighlightRanges(
						needle,
						labelMatch?.indices as readonly MatchRange[] | undefined,
					),
					descriptionMatches: filterHighlightRanges(
						needle,
						descriptionMatch?.indices as readonly MatchRange[] | undefined,
					),
				};
			})
		: tagFiltered;

	const noun = kind ? KIND_META[kind].label : "view, query or SQL view";
	const isEmpty = allItems.length === 0 && tags.length === 0 && !text;

	const placeholder = "Search by name or description…";
	const createView = () =>
		navigate({ to: "/analytics/views/create", search: VIEW_CREATE_SEARCH });
	const createQuery = () =>
		navigate({ to: "/analytics/queries/create", search: QUERY_CREATE_SEARCH });
	const createSqlView = () =>
		navigate({
			to: "/analytics/sqlview/create",
			search: SQLVIEW_CREATE_SEARCH,
		});
	const handleTagClick = (tagText: string) => {
		const slug = tagSlug(tagText);
		if (tags.some((t) => tagSlug(t) === slug)) return;
		setTags([...tags, tagText]);
	};
	const removeChip = (tag: string) => {
		setTags(tags.filter((t) => t !== tag));
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
			const seen = new Set(tags.map(tagSlug));
			const extra: string[] = [];
			for (const c of parsed.chips) {
				const s = tagSlug(c);
				if (!seen.has(s)) {
					extra.push(c);
					seen.add(s);
				}
			}
			if (extra.length > 0) setTags([...tags, ...extra]);
			setText([parsed.text, tail].filter(Boolean).join(" "));
		} else {
			setText(next);
		}
	};
	const onClear = () => {
		setTags([]);
		setText("");
	};

	const [focusedIndex, setFocusedIndex] = React.useState(-1);
	const focusedRowRef = React.useRef<HTMLLIElement | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: focusedIndex triggers scroll
	React.useEffect(() => {
		focusedRowRef.current?.scrollIntoView({ block: "nearest" });
	}, [focusedIndex]);

	React.useEffect(() => {
		if (text && items.length > 0) setFocusedIndex(0);
		else setFocusedIndex(-1);
	}, [text, items.length]);

	const openItem = (it: RecentItem) => {
		navigate({
			to: editRoutePath(it.kind),
			params: { id: it.id },
			search: it.kind === "view" ? VIEW_EDIT_SEARCH : QUERY_EDIT_SEARCH,
		});
	};

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
			openItem(it);
		}
	};

	return (
		<div className="h-full flex flex-col">
			<div className="bg-bg-primary py-4 shadow-[0_10px_10px_0_var(--color-bg-primary)]">
				<div className="mx-auto max-w-[990px] px-8 flex items-center gap-2">
					<SearchBar
						chips={tags}
						textPart={text}
						placeholder={placeholder}
						allItems={combined}
						inputRef={setSearchInputRef}
						onTextChange={updateTextPart}
						onRemoveChip={removeChip}
						onClear={onClear}
						onInputKeyDown={handleKeyDown}
					/>
					{kind === "view" ? (
						<HSComp.Button variant="secondary" onClick={createView}>
							<Plus className="size-4 text-text-info-primary" />
							Create
						</HSComp.Button>
					) : kind === "query" ? (
						<HSComp.Button variant="secondary" onClick={createQuery}>
							<Plus className="size-4 text-text-info-primary" />
							Create
						</HSComp.Button>
					) : (
						<HSComp.DropdownMenu>
							<HSComp.DropdownMenuTrigger asChild>
								<HSComp.Button variant="secondary">
									<Plus className="size-4 text-text-info-primary" />
									Create
								</HSComp.Button>
							</HSComp.DropdownMenuTrigger>
							<HSComp.DropdownMenuContent align="end">
								<HSComp.DropdownMenuItem
									className="justify-start! text-text-info-primary!"
									onSelect={createView}
								>
									<Table className="size-4 text-text-info-primary" />
									ViewDefinition
								</HSComp.DropdownMenuItem>
								<HSComp.DropdownMenuItem
									className="justify-start! text-text-warning-primary!"
									onSelect={createQuery}
								>
									<FileCode2 className="size-4 text-text-warning-primary" />
									SQLQuery
								</HSComp.DropdownMenuItem>
								<HSComp.DropdownMenuItem
									className="justify-start! text-text-success-primary!"
									onSelect={createSqlView}
								>
									<Layers className="size-4 text-text-success-primary" />
									SQLView
								</HSComp.DropdownMenuItem>
							</HSComp.DropdownMenuContent>
						</HSComp.DropdownMenu>
					)}
				</div>
			</div>
			<div className="flex-1 min-h-0 overflow-y-auto pb-[250px]">
				{isEmpty ? (
					<EmptyState
						title="Analytics"
						description={`Create your first ${noun}.`}
						action={
							kind === "view" ? (
								<HSComp.Button variant="secondary" onClick={createView}>
									<Plus className="size-4 text-text-info-primary" />
									Create
								</HSComp.Button>
							) : kind === "query" ? (
								<HSComp.Button variant="secondary" onClick={createQuery}>
									<Plus className="size-4 text-text-info-primary" />
									Create
								</HSComp.Button>
							) : (
								<HSComp.DropdownMenu>
									<HSComp.DropdownMenuTrigger asChild>
										<HSComp.Button variant="secondary">
											<Plus className="size-4 text-text-info-primary" />
											Create
										</HSComp.Button>
									</HSComp.DropdownMenuTrigger>
									<HSComp.DropdownMenuContent align="end">
										<HSComp.DropdownMenuItem
											className="justify-start! text-text-info-primary!"
											onSelect={createView}
										>
											<Table className="size-4 text-text-info-primary" />
											ViewDefinition
										</HSComp.DropdownMenuItem>
										<HSComp.DropdownMenuItem
											className="justify-start! text-text-warning-primary!"
											onSelect={createQuery}
										>
											<FileCode2 className="size-4 text-text-warning-primary" />
											SQLQuery
										</HSComp.DropdownMenuItem>
										<HSComp.DropdownMenuItem
											className="justify-start! text-text-success-primary!"
											onSelect={createSqlView}
										>
											<Layers className="size-4 text-text-success-primary" />
											SQLView
										</HSComp.DropdownMenuItem>
									</HSComp.DropdownMenuContent>
								</HSComp.DropdownMenu>
							)
						}
					/>
				) : items.length === 0 ? (
					<div className="mx-auto max-w-[990px] px-8 py-6 typo-body-xs text-text-tertiary italic">
						Nothing matches “
						{[...tags.map((t) => `#${t}`), text].filter(Boolean).join(" ")}”.
					</div>
				) : (
					<ul className="mx-auto max-w-[990px] px-8 bg-bg-primary divide-y divide-border-default">
						{items.map((it, index) => {
							const itemKey = `${it.kind}-${it.id}`;
							const isMenuOpen = openMenuKey === itemKey;
							const focused = index === focusedIndex;
							return (
								<li
									key={itemKey}
									ref={focused ? focusedRowRef : undefined}
									className={`relative group/row transition-colors hover:bg-bg-secondary first:rounded-t-lg last:rounded-b-lg ${focused ? "bg-bg-secondary" : ""}`}
								>
									<Link
										to={editRoutePath(it.kind)}
										params={{ id: it.id }}
										search={
											it.kind === "view" ? VIEW_EDIT_SEARCH : QUERY_EDIT_SEARCH
										}
										className="block"
									>
										<ItemRow
											item={it}
											lookup={lookup}
											showKindLabel={!kind}
											onTagClick={handleTagClick}
										/>
									</Link>
									<div
										className={`${isMenuOpen ? "block" : "hidden group-hover/row:block focus-within:block"} absolute top-2 right-2`}
									>
										<HSComp.DropdownMenu
											open={isMenuOpen}
											onOpenChange={(o) => setOpenMenuKey(o ? itemKey : null)}
										>
											<HSComp.DropdownMenuTrigger asChild>
												<button
													type="button"
													aria-label="More actions"
													className="size-7 flex items-center justify-center rounded hover:bg-bg-tertiary text-text-secondary"
												>
													<EllipsisVertical className="size-4" />
												</button>
											</HSComp.DropdownMenuTrigger>
											<HSComp.DropdownMenuContent align="end">
												<HSComp.DropdownMenuItem
													className="justify-start!"
													onSelect={() => openLineage(it)}
												>
													<GitBranch className="size-4" />
													Lineage
												</HSComp.DropdownMenuItem>
												<HSComp.DropdownMenuItem
													className="justify-start!"
													variant="destructive"
													onSelect={() => setConfirmingDelete(it)}
												>
													<Trash2 className="size-4" />
													Delete
												</HSComp.DropdownMenuItem>
											</HSComp.DropdownMenuContent>
										</HSComp.DropdownMenu>
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</div>
			<HSComp.AlertDialog
				open={!!confirmingDelete}
				onOpenChange={(o) => {
					if (!o) setConfirmingDelete(null);
				}}
			>
				<HSComp.AlertDialogContent>
					<HSComp.AlertDialogHeader>
						<HSComp.AlertDialogTitle>
							Delete{" "}
							{confirmingDelete ? KIND_META[confirmingDelete.kind].label : ""}
						</HSComp.AlertDialogTitle>
					</HSComp.AlertDialogHeader>
					<HSComp.AlertDialogDescription>
						Are you sure you want to delete{" "}
						<span className="font-medium text-text-primary">
							{confirmingDelete?.label}
						</span>
						? This action cannot be undone.
					</HSComp.AlertDialogDescription>
					<HSComp.AlertDialogFooter>
						<HSComp.AlertDialogCancel>Cancel</HSComp.AlertDialogCancel>
						<HSComp.AlertDialogAction
							danger
							onClick={() => {
								if (confirmingDelete) deleteMutation.mutate(confirmingDelete);
								setConfirmingDelete(null);
							}}
						>
							Delete
						</HSComp.AlertDialogAction>
					</HSComp.AlertDialogFooter>
				</HSComp.AlertDialogContent>
			</HSComp.AlertDialog>
		</div>
	);
}

export const validateAnalyticsSearch = (search: {
	q?: unknown;
	tags?: unknown;
}): { q?: string; tags?: string[] } => {
	const out: { q?: string; tags?: string[] } = {};
	if (typeof search.q === "string" && search.q.length > 0) out.q = search.q;
	if (Array.isArray(search.tags)) {
		const tags = search.tags.filter(
			(t): t is string => typeof t === "string" && t.length > 0,
		);
		if (tags.length > 0) out.tags = tags;
	} else if (typeof search.tags === "string" && search.tags.length > 0) {
		out.tags = [search.tags];
	}
	return out;
};

function AnalyticsHomeRoute() {
	const search = Route.useSearch();
	const text = search.q ?? "";
	const tags = search.tags ?? [];
	const navigate = useNavigate({ from: "/analytics/" });
	const setText = (next: string) =>
		navigate({
			search: (prev) => ({ ...prev, q: next || undefined }),
			replace: true,
		});
	const setTags = (next: string[]) =>
		navigate({
			search: (prev) => ({ ...prev, tags: next.length > 0 ? next : undefined }),
			replace: true,
		});
	return (
		<AnalyticsListPage
			text={text}
			tags={tags}
			setText={setText}
			setTags={setTags}
		/>
	);
}

export const Route = createFileRoute("/analytics/")({
	component: AnalyticsHomeRoute,
	validateSearch: validateAnalyticsSearch,
});
