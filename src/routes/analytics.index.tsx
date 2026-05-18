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
	Plus,
	Search,
	Table,
	Trash2,
	X,
} from "lucide-react";
import * as React from "react";
import { useAidboxClient } from "../AidboxClient";
import { EmptyState } from "../components/empty-state";
import { buildQuery, parseQuery, tagSlug } from "../utils/tag-search";

type MatchRange = readonly [number, number];

function highlight(text: string, ranges: readonly MatchRange[] | undefined) {
	if (!ranges || ranges.length === 0) return text;
	const sorted = ranges.slice().sort((a, b) => a[0] - b[0]);
	const parts: React.ReactNode[] = [];
	let cursor = 0;
	sorted.forEach(([start, end]) => {
		if (start < cursor) return;
		if (start > cursor) parts.push(text.slice(cursor, start));
		parts.push(
			<span key={`${start}-${end}`} className="text-text-link">
				{text.slice(start, end + 1)}
			</span>,
		);
		cursor = end + 1;
	});
	if (cursor < text.length) parts.push(text.slice(cursor));
	return <>{parts}</>;
}

const SQL_QUERY_TYPE_TOKEN =
	"https://sql-on-fhir.org/ig/CodeSystem/LibraryTypesCodes|sql-query";

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
	kind: "view" | "query";
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

function chipStyleFor(slug: string, items: RecentItem[]): string {
	for (const item of items) {
		if (tagSlug(item.label) === slug) {
			return item.kind === "view"
				? "bg-blue-50 text-text-info-primary"
				: "bg-yellow-50 text-text-warning-primary";
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
	const Icon = isView ? Table : FileCode2;
	const kindLabel = isView ? "View" : "Query";
	const accentClass = isView
		? "text-text-info-primary"
		: "text-text-warning-primary";
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
			const isLinkedView =
				linked?.kind === "view" || ra.url.includes("/ViewDefinition/");
			const text = linked?.label ?? ra.label ?? ra.url;
			badges.push(
				<Badge
					key={ra.url}
					text={text}
					accentClass={
						isLinkedView
							? "text-text-info-primary"
							: "text-text-warning-primary"
					}
					onClick={onTagClick ? () => onTagClick(text) : undefined}
				/>,
			);
		}
	}
	return (
		<div className="flex flex-col pl-3 pr-4 py-3 min-w-0">
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

export type AnalyticsListKind = "view" | "query";

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

function SearchBar({
	chips,
	textPart,
	placeholder,
	allItems,
	inputRef,
	onTextChange,
	onRemoveChip,
	onClear,
}: {
	chips: string[];
	textPart: string;
	placeholder: string;
	allItems: RecentItem[];
	inputRef: (el: HTMLInputElement | null) => void;
	onTextChange: (next: string) => void;
	onRemoveChip: (slug: string) => void;
	onClear: () => void;
}) {
	return (
		<div className="flex flex-1 items-center gap-2 min-h-9 px-3 py-1 rounded-lg border border-border-primary bg-bg-primary flex-wrap">
			<Search className="size-4 text-text-tertiary shrink-0" />
			{chips.map((chip) => (
				<span
					key={chip}
					className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] leading-4 whitespace-nowrap ${chipStyleFor(chip, allItems)}`}
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
					}
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
	searchQ,
	setSearchQ,
}: {
	kind?: AnalyticsListKind;
	searchQ: string;
	setSearchQ: (next: string) => void;
}) {
	const views = useRecentViews();
	const queries = useRecentQueries();
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
				queryKey: [
					item.kind === "view"
						? "analytics-recent-views"
						: "analytics-recent-queries",
				],
			});
			HSComp.toast.success(
				`${item.kind === "view" ? "View" : "Query"} deleted`,
			);
		},
		onError: () => {
			HSComp.toast.error("Failed to delete");
		},
	});
	const [openMenuKey, setOpenMenuKey] = React.useState<string | null>(null);
	const [confirmingDelete, setConfirmingDelete] =
		React.useState<RecentItem | null>(null);
	const openLineage = (item: RecentItem) => {
		if (item.kind === "view") {
			navigate({
				to: "/analytics/views/edit/$id",
				params: { id: item.id },
				search: { tab: "lineage", mode: "json", builderTab: "form" },
			});
		} else {
			navigate({
				to: "/analytics/queries/edit/$id",
				params: { id: item.id },
				search: { tab: "lineage", mode: "json", builderTab: "form" },
			});
		}
	};
	const didFocus = React.useRef(false);
	const setSearchInputRef = React.useCallback((el: HTMLInputElement | null) => {
		if (el && !didFocus.current) {
			el.focus();
			didFocus.current = true;
		}
	}, []);

	const loading =
		kind === "view"
			? views.isLoading
			: kind === "query"
				? queries.isLoading
				: views.isLoading || queries.isLoading;
	const combined: RecentItem[] = [
		...(views.data ?? []),
		...(queries.data ?? []),
	];
	const allItems: RecentItem[] = (
		kind === "view"
			? (views.data ?? [])
			: kind === "query"
				? (queries.data ?? [])
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
		for (const it of [...(views.data ?? []), ...(queries.data ?? [])]) {
			if (it.url) map.set(it.url, it);
		}
		return (url: string) => map.get(url);
	}, [views.data, queries.data]);
	const { chips, text: textPart } = parseQuery(searchQ);
	const tagTokens = chips.map((c) => c.toLowerCase());
	const textQuery = textPart;

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
	const minHighlight = Math.min(Math.max(needle.length, 1), 3);
	const items: RecentItem[] = needle
		? fuse.search(needle).map((r) => {
				const labelMatch = r.matches?.find((m) => m.key === "label");
				const descriptionMatch = r.matches?.find(
					(m) => m.key === "description",
				);
				const filterRanges = (
					indices?: readonly MatchRange[],
				): readonly MatchRange[] | undefined =>
					indices?.filter(([s, e]) => e - s + 1 >= minHighlight);
				return {
					...r.item,
					labelMatches: filterRanges(
						labelMatch?.indices as readonly MatchRange[] | undefined,
					),
					descriptionMatches: filterRanges(
						descriptionMatch?.indices as readonly MatchRange[] | undefined,
					),
				};
			})
		: tagFiltered;

	if (loading) {
		return (
			<div className="h-full overflow-y-auto p-6 space-y-2">
				<HSComp.Skeleton className="h-14 w-full" />
				<HSComp.Skeleton className="h-14 w-full" />
				<HSComp.Skeleton className="h-14 w-full" />
			</div>
		);
	}

	if (allItems.length === 0 && !searchQ) {
		const noun =
			kind === "view" ? "view" : kind === "query" ? "query" : "view or query";
		return (
			<EmptyState
				title="Analytics"
				description={`Create your first ${noun} from the sidebar.`}
			/>
		);
	}

	const placeholder =
		kind === "view"
			? "Search views by name or description…"
			: kind === "query"
				? "Search queries by name or description…"
				: "Search by name or description…";
	const createView = () =>
		navigate({ to: "/analytics/views/create", search: VIEW_CREATE_SEARCH });
	const createQuery = () =>
		navigate({ to: "/analytics/queries/create", search: QUERY_CREATE_SEARCH });
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

	return (
		<div className="h-full overflow-y-auto pb-[250px]">
			<div className="sticky top-0 z-10 bg-bg-primary py-4 shadow-[0_10px_10px_0_var(--color-bg-primary)]">
				<div className="mx-auto max-w-[990px] px-8 flex items-center gap-2">
					<SearchBar
						chips={chips}
						textPart={textPart}
						placeholder={placeholder}
						allItems={allItems}
						inputRef={setSearchInputRef}
						onTextChange={updateTextPart}
						onRemoveChip={removeChip}
						onClear={() => setSearchQ("")}
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
									View
								</HSComp.DropdownMenuItem>
								<HSComp.DropdownMenuItem
									className="justify-start! text-text-warning-primary!"
									onSelect={createQuery}
								>
									<FileCode2 className="size-4 text-text-warning-primary" />
									Query
								</HSComp.DropdownMenuItem>
							</HSComp.DropdownMenuContent>
						</HSComp.DropdownMenu>
					)}
				</div>
			</div>
			{items.length === 0 ? (
				<div className="mx-auto max-w-[990px] px-8 py-6 typo-body-xs text-text-tertiary italic">
					Nothing matches “{searchQ}”.
				</div>
			) : (
				<ul className="mx-auto max-w-[990px] px-8 bg-bg-primary divide-y divide-border-default">
					{items.map((it) => {
						const itemKey = `${it.kind}-${it.id}`;
						const isMenuOpen = openMenuKey === itemKey;
						return (
							<li
								key={itemKey}
								className="relative group/row transition-colors hover:bg-bg-secondary"
							>
								{it.kind === "view" ? (
									<Link
										to="/analytics/views/edit/$id"
										params={{ id: it.id }}
										search={VIEW_EDIT_SEARCH}
										className="block"
									>
										<ItemRow
											item={it}
											lookup={lookup}
											showKindLabel={!kind}
											onTagClick={handleTagClick}
										/>
									</Link>
								) : (
									<Link
										to="/analytics/queries/edit/$id"
										params={{ id: it.id }}
										search={QUERY_EDIT_SEARCH}
										className="block"
									>
										<ItemRow
											item={it}
											lookup={lookup}
											showKindLabel={!kind}
											onTagClick={handleTagClick}
										/>
									</Link>
								)}
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
			<HSComp.AlertDialog
				open={!!confirmingDelete}
				onOpenChange={(o) => {
					if (!o) setConfirmingDelete(null);
				}}
			>
				<HSComp.AlertDialogContent>
					<HSComp.AlertDialogHeader>
						<HSComp.AlertDialogTitle>
							Delete {confirmingDelete?.kind === "view" ? "view" : "query"}
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
}): { q?: string } =>
	typeof search.q === "string" && search.q.length > 0 ? { q: search.q } : {};

function AnalyticsHomeRoute() {
	const { q: searchQ = "" } = Route.useSearch();
	const navigate = useNavigate({ from: "/analytics/" });
	const setSearchQ = (next: string) =>
		navigate({
			search: (prev) => ({ ...prev, q: next || undefined }),
			replace: true,
		});
	return <AnalyticsListPage searchQ={searchQ} setSearchQ={setSearchQ} />;
}

export const Route = createFileRoute("/analytics/")({
	component: AnalyticsHomeRoute,
	validateSearch: validateAnalyticsSearch,
});
