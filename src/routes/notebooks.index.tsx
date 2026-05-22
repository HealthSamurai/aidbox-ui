import * as HSComp from "@health-samurai/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import Fuse from "fuse.js";
import {
	FileUp,
	Globe,
	Link as LinkIcon,
	Plus,
	Search,
	Upload,
	User,
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

const ACRONYM_TAGS = new Set(["rest", "sql", "rpc"]);
function formatTag(s: string): string {
	const lower = s.toLowerCase();
	if (ACRONYM_TAGS.has(lower)) return lower.toUpperCase();
	return lower.charAt(0).toUpperCase() + lower.slice(1);
}

type RpcNotebook = {
	id: string;
	name?: string;
	description?: string;
	source?: { type: "rpc" | "uri"; id?: string; path?: string };
	origin?: string | null;
	tags?: { value?: string[] };
	"cell-types"?: string[] | null;
};

type NotebookItem = {
	id: string;
	name: string;
	description?: string;
	isCommunity: boolean;
	path?: string;
	cellTypes: string[];
	nameMatches?: readonly MatchRange[];
	descriptionMatches?: readonly MatchRange[];
};

function useNotebooks() {
	const client = useAidboxClient();
	return useQuery<NotebookItem[]>({
		queryKey: ["notebooks-list"],
		queryFn: async () => {
			const resp = await client.rawRequest({
				method: "POST",
				url: "/rpc?_m=aidbox.notebooks/notebooks",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					method: "aidbox.notebooks/notebooks",
					params: { query: "" },
				}),
			});
			const json = (await resp.response.json()) as {
				result?: { notebooks?: RpcNotebook[] };
				error?: unknown;
			};
			const list = json.result?.notebooks ?? [];
			const personalIds = new Set(
				list
					.filter((nb) => nb.id && nb.source?.type === "rpc")
					.map((nb) => nb.id),
			);
			return list.flatMap((nb) => {
				if (!nb.id) return [];
				const isCommunity = nb.source?.type === "uri";
				// Hide the published copy when its source notebook is already listed locally.
				if (isCommunity && nb.origin && personalIds.has(nb.origin)) return [];
				const cellTypes = Array.from(new Set(nb["cell-types"] ?? [])).sort();
				return [
					{
						id: nb.id,
						name: nb.name ?? "(unnamed)",
						description: nb.description,
						isCommunity,
						path: nb.source?.path,
						cellTypes,
					} satisfies NotebookItem,
				];
			});
		},
	});
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
					className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] leading-4 whitespace-nowrap cursor-pointer bg-bg-tertiary text-text-info-primary"
				>
					#{formatTag(chip)}
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
					chips.length === 0 ? "Search notebooks by name or description…" : ""
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

const NotebookRow = React.memo(function NotebookRow({
	nb,
	focused,
	onTagClick,
}: {
	nb: NotebookItem;
	focused: boolean;
	onTagClick: (t: string) => void;
}) {
	const KindIcon = nb.isCommunity ? Globe : User;
	const kindLabel = nb.isCommunity ? "Community" : "Personal";
	const accentClass = nb.isCommunity
		? "text-text-success-primary"
		: "text-text-warning-primary";
	return (
		<li
			className={`relative transition-colors hover:bg-bg-secondary border-b border-border-default ${focused ? "bg-bg-secondary" : ""}`}
		>
			<Link
				to="/notebooks/$id"
				params={{ id: nb.id }}
				search={nb.path ? { path: nb.path } : {}}
				className="flex flex-col pl-3.5 pr-4 py-3 min-w-0"
			>
				<div
					className={`flex items-center gap-1.5 typo-label-tiny uppercase tracking-wide ${accentClass}`}
				>
					<KindIcon className="size-3.5 shrink-0" />
					<span>{kindLabel}</span>
				</div>
				<div className="typo-body text-text-primary truncate mt-0.5">
					{highlight(nb.name, nb.nameMatches)}
				</div>
				{nb.description && (
					<div className="typo-body-xs text-text-secondary mt-0.5">
						{highlight(nb.description, nb.descriptionMatches)}
					</div>
				)}
				{nb.cellTypes.length > 0 && (
					<div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2">
						{nb.cellTypes.map((t) => (
							<button
								key={t}
								type="button"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									onTagClick(t);
								}}
								className="shrink-0 text-[11px] leading-4 whitespace-nowrap text-text-info-primary cursor-pointer hover:underline"
							>
								#{formatTag(t)}
							</button>
						))}
					</div>
				)}
			</Link>
		</li>
	);
});

function UploadButton() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();
	const navigate = useNavigate({ from: "/notebooks/" });
	const fileRef = React.useRef<HTMLInputElement>(null);
	const [linkOpen, setLinkOpen] = React.useState(false);
	const [linkUrl, setLinkUrl] = React.useState("");
	const [error, setError] = React.useState<string | null>(null);

	const importLinkMut = useMutation<{ id: string }, Error, string>({
		mutationFn: async (url) => {
			const body = {
				method: "aidbox.notebooks/import-notebook",
				params: { "notebook-url": url },
			};
			const resp = await client.rawRequest({
				method: "POST",
				url: `/rpc?_m=${body.method}`,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const json = (await resp.response.json()) as {
				result?: { notebook?: { id?: string } };
				error?: { message?: string };
			};
			const nb = json.result?.notebook;
			if (!nb?.id) throw new Error(json.error?.message ?? "import failed");
			return { id: nb.id };
		},
		onSuccess: ({ id }) => {
			void queryClient.invalidateQueries({ queryKey: ["notebooks-list"] });
			setLinkOpen(false);
			setLinkUrl("");
			void navigate({ to: "/notebooks/$id", params: { id } });
		},
		onError: (e) => setError(e.message),
	});

	const importFileMut = useMutation<{ id: string }, Error, File>({
		mutationFn: async (file) => {
			const text = await file.text();
			const m = text.match(/<data value="([^"]+)"/);
			if (!m?.[1]) throw new Error("File is not a notebook export");
			let parsed: Record<string, unknown>;
			try {
				parsed = JSON.parse(decodeURIComponent(m[1])) as Record<
					string,
					unknown
				>;
			} catch {
				throw new Error("Invalid notebook payload");
			}
			delete parsed.id;
			delete parsed.meta;
			delete parsed.source;
			const body = {
				method: "aidbox.notebooks/import-notebook-as-json",
				params: { notebook: parsed },
			};
			const resp = await client.rawRequest({
				method: "POST",
				url: `/rpc?_m=${body.method}`,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const json = (await resp.response.json()) as {
				result?: { notebook?: { id?: string } };
				error?: { message?: string };
			};
			const nb = json.result?.notebook;
			if (!nb?.id) throw new Error(json.error?.message ?? "import failed");
			return { id: nb.id };
		},
		onSuccess: ({ id }) => {
			void queryClient.invalidateQueries({ queryKey: ["notebooks-list"] });
			void navigate({ to: "/notebooks/$id", params: { id } });
		},
		onError: (e) => HSComp.toast.error(e.message),
	});

	return (
		<>
			<HSComp.DropdownMenu>
				<HSComp.DropdownMenuTrigger asChild>
					<HSComp.Button variant="secondary">
						<Upload className="size-4 text-text-info-primary" />
						Upload
					</HSComp.Button>
				</HSComp.DropdownMenuTrigger>
				<HSComp.DropdownMenuContent align="end">
					<HSComp.DropdownMenuItem
						className="justify-start!"
						onClick={() => {
							setError(null);
							setLinkOpen(true);
						}}
					>
						<LinkIcon className="size-4" />
						as link
					</HSComp.DropdownMenuItem>
					<HSComp.DropdownMenuItem
						className="justify-start!"
						onClick={() => fileRef.current?.click()}
					>
						<FileUp className="size-4" />
						as file
					</HSComp.DropdownMenuItem>
				</HSComp.DropdownMenuContent>
			</HSComp.DropdownMenu>
			<input
				ref={fileRef}
				type="file"
				accept=".html,text/html"
				className="hidden"
				onChange={(e) => {
					const file = e.target.files?.[0];
					e.target.value = "";
					if (file) importFileMut.mutate(file);
				}}
			/>
			<HSComp.Dialog open={linkOpen} onOpenChange={setLinkOpen}>
				<HSComp.DialogContent className="max-w-lg">
					<HSComp.DialogHeader>
						<HSComp.DialogTitle>Upload notebook by link</HSComp.DialogTitle>
					</HSComp.DialogHeader>
					<div className="flex flex-col gap-2">
						<input
							autoFocus
							value={linkUrl}
							onChange={(e) => setLinkUrl(e.target.value)}
							placeholder="https://aidbox.app/ExportedNotebook/…"
							className="w-full border border-border-default rounded-md px-3 py-2 typo-body outline-none focus:border-border-info-primary bg-bg-primary text-text-primary"
						/>
						{error && (
							<p className="typo-body-xs text-critical-default">{error}</p>
						)}
					</div>
					<HSComp.DialogFooter>
						<HSComp.Button
							variant="secondary"
							onClick={() => setLinkOpen(false)}
						>
							Cancel
						</HSComp.Button>
						<HSComp.Button
							variant="primary"
							disabled={!linkUrl.trim() || importLinkMut.isPending}
							onClick={() => importLinkMut.mutate(linkUrl.trim())}
						>
							Import
						</HSComp.Button>
					</HSComp.DialogFooter>
				</HSComp.DialogContent>
			</HSComp.Dialog>
		</>
	);
}

function NotebooksPage() {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: "/notebooks/" });
	const text = search.q ?? "";
	const tags = search.tags ?? [];
	const { data: rawItems = [], isLoading } = useNotebooks();

	const setText = (next: string) =>
		navigate({
			search: (prev) => ({ ...prev, q: next || undefined }),
			replace: true,
		});
	const setTags = React.useCallback(
		(next: string[]) =>
			navigate({
				search: (prev) => ({
					...prev,
					tags: next.length > 0 ? next : undefined,
				}),
				replace: true,
			}),
		[navigate],
	);

	const tagTokens = tags.map(tagSlug);

	const tagFiltered = React.useMemo(() => {
		if (tagTokens.length === 0) return rawItems;
		return rawItems.filter((nb) => {
			const slugs = nb.cellTypes.map(tagSlug);
			return tagTokens.every((t) => slugs.includes(t));
		});
	}, [rawItems, tagTokens]);

	const fuse = React.useMemo(
		() =>
			new Fuse(tagFiltered, {
				keys: ["name", "description"],
				includeMatches: true,
				threshold: 0.3,
				ignoreLocation: true,
				minMatchCharLength: 1,
			}),
		[tagFiltered],
	);

	const items: NotebookItem[] = text
		? fuse.search(text).map((r) => {
				const nameMatch = r.matches?.find((m) => m.key === "name");
				const descriptionMatch = r.matches?.find(
					(m) => m.key === "description",
				);
				return {
					...r.item,
					nameMatches: filterHighlightRanges(
						text,
						nameMatch?.indices as readonly MatchRange[] | undefined,
					),
					descriptionMatches: filterHighlightRanges(
						text,
						descriptionMatch?.indices as readonly MatchRange[] | undefined,
					),
				};
			})
		: [...tagFiltered].sort(
				(a, b) => Number(a.isCommunity) - Number(b.isCommunity),
			);

	const [focusedIndex, setFocusedIndex] = React.useState(-1);
	const scrollRef = React.useRef<HTMLDivElement | null>(null);
	const didFocus = React.useRef(false);
	const setSearchInputRef = React.useCallback((el: HTMLInputElement | null) => {
		if (el && !didFocus.current) {
			el.focus();
			didFocus.current = true;
		}
	}, []);

	const rowVirtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => 100,
		overscan: 8,
	});

	React.useEffect(() => {
		if (focusedIndex < 0) return;
		rowVirtualizer.scrollToIndex(focusedIndex, { align: "auto" });
	}, [focusedIndex, rowVirtualizer]);

	React.useEffect(() => {
		if (text && items.length > 0) setFocusedIndex(0);
		else setFocusedIndex(-1);
	}, [text, items.length]);

	const openItem = (it: NotebookItem) => {
		navigate({
			to: "/notebooks/$id",
			params: { id: it.id },
			search: it.path ? { path: it.path } : {},
		});
	};

	const tagsRef = React.useRef(tags);
	tagsRef.current = tags;
	const addTag = React.useCallback(
		(tagText: string) => {
			const slug = tagSlug(tagText);
			const current = tagsRef.current;
			if (current.some((t) => tagSlug(t) === slug)) return;
			setTags([...current, tagText]);
		},
		[setTags],
	);
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

	const isEmpty = rawItems.length === 0 && tags.length === 0 && !text;

	return (
		<div className="h-full flex flex-col">
			<div className="sticky top-0 z-10 bg-bg-primary py-4 shadow-[0_10px_10px_0_var(--color-bg-primary)]">
				<div className="mx-auto max-w-[990px] px-8 flex items-center gap-2">
					<SearchBar
						chips={tags}
						textPart={text}
						inputRef={setSearchInputRef}
						onTextChange={updateTextPart}
						onRemoveChip={removeChip}
						onClear={onClear}
						onInputKeyDown={handleKeyDown}
					/>
					<UploadButton />
					<HSComp.Button
						variant="secondary"
						onClick={() => navigate({ to: "/notebooks/new" })}
					>
						<Plus className="size-4 text-text-info-primary" />
						New
					</HSComp.Button>
				</div>
			</div>
			<div
				ref={scrollRef}
				className="flex-1 min-h-0 overflow-y-auto pb-[250px]"
			>
				{isLoading ? null : isEmpty ? (
					<EmptyState
						title="Notebooks"
						description="Create your first notebook."
					/>
				) : items.length === 0 ? (
					<div className="mx-auto max-w-[990px] px-8 py-6 typo-body-xs text-text-tertiary italic">
						Nothing matches “
						{[...tags.map((t) => `#${t}`), text].filter(Boolean).join(" ")}”.
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
								const nb = items[vi.index];
								if (!nb) return null;
								return (
									<div
										key={nb.id}
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
										<NotebookRow
											nb={nb}
											focused={vi.index === focusedIndex}
											onTagClick={addTag}
										/>
									</div>
								);
							})}
						</ul>
					</div>
				)}
			</div>
		</div>
	);
}

const validateSearch = (search: {
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

export const Route = createFileRoute("/notebooks/")({
	staticData: { title: "Notebooks" },
	component: NotebooksPage,
	validateSearch,
});
