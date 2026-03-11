import { useLocalStorage } from "@aidbox-ui/hooks/useLocalStorage";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { X } from "lucide-react";
import React, { useMemo, useRef, useState } from "react";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import { createFuzzySearch } from "../../utils/fuzzy-search";
import { useWebMCPResourceBrowser } from "../../webmcp/resource-browser";
import type { ResourceBrowserActions } from "../../webmcp/resource-browser-context";
import { EmptyState } from "../empty-state";

type ResourceRow = {
	resourceType: string;
	url: string;
};

const skeletonRows = Array.from({ length: 30 }, (_, i) => (
	// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
	<HSComp.TableRow key={`skeleton-${i}`} zebra index={i}>
		<HSComp.TableCell className="w-8" />
		<HSComp.TableCell>
			<HSComp.Skeleton
				className="h-5"
				style={{ width: `${100 + ((i * 47) % 120)}px` }}
			/>
		</HSComp.TableCell>
		<HSComp.TableCell>
			<HSComp.Skeleton
				className="h-5"
				style={{ width: `${200 + ((i * 73) % 300)}px` }}
			/>
		</HSComp.TableCell>
	</HSComp.TableRow>
));

function ResourceList({
	data,
	favorites,
	onToggleFavorite,
	isLoading,
	focusedIndex,
	sort,
	onSort,
}: {
	data: ResourceRow[];
	favorites: Set<string>;
	onToggleFavorite: (resourceType: string) => void;
	isLoading: boolean;
	focusedIndex: number;
	sort: SortState;
	onSort: (column: SortColumn) => void;
}) {
	const navigate = useNavigate();
	const focusedRowRef = React.useRef<HTMLTableRowElement | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: focusedIndex triggers scroll
	React.useEffect(() => {
		focusedRowRef.current?.scrollIntoView({ block: "nearest" });
	}, [focusedIndex]);

	const goToResource = (resourceType: string) =>
		navigate({
			to: "/resource/$resourceType",
			params: { resourceType },
		});

	return (
		<HSComp.Table zebra className="typo-code">
			<HSComp.TableHeader className="block shrink-0 overflow-y-scroll scrollbar-none [&_tr]:table [&_tr]:table-fixed [&_tr]:w-full">
				<HSComp.TableRow>
					<HSComp.TableHead className="w-8 px-1 text-text-secondary">
						<span className="opacity-50 flex items-center justify-center">
							<HSComp.PinIcon />
						</span>
					</HSComp.TableHead>
					<HSComp.TableHead
						className="w-72"
						sortable
						sorted={sort.column === "resourceType" && sort.direction}
						onClick={() => onSort("resourceType")}
					>
						Resource type
					</HSComp.TableHead>
					<HSComp.TableHead
						sortable
						sorted={sort.column === "url" && sort.direction}
						onClick={() => onSort("url")}
					>
						URL
					</HSComp.TableHead>
				</HSComp.TableRow>
			</HSComp.TableHeader>
			<HSComp.TableBody className="block grow min-h-0 overflow-y-auto pb-10 [&_tr]:table [&_tr]:table-fixed [&_tr]:w-full">
				{isLoading
					? skeletonRows
					: data.length
						? data.map((row, index) => {
								const isFavorite = favorites.has(row.resourceType);
								const isLastFavorite =
									isFavorite &&
									(index + 1 >= data.length ||
										!favorites.has(data[index + 1].resourceType));
								return (
									<HSComp.TableRow
										ref={index === focusedIndex ? focusedRowRef : undefined}
										key={row.resourceType}
										zebra
										index={index}
										className={HSComp.cn(
											isLastFavorite && "border-b border-border-secondary",
											index === focusedIndex && "bg-bg-hover",
										)}
									>
										<HSComp.TableCell
											className="w-8 px-1 align-middle text-center cursor-pointer"
											onClick={() => onToggleFavorite(row.resourceType)}
										>
											<span
												className="pin-button flex items-center justify-center transition-opacity"
												style={{
													opacity: favorites.has(row.resourceType) ? 0.5 : 0,
												}}
											>
												<HSComp.PinIcon />
											</span>
										</HSComp.TableCell>
										<HSComp.TableCell className="w-72">
											<a
												href={`/u/resource/${row.resourceType}`}
												onClick={(e) => {
													e.preventDefault();
													goToResource(row.resourceType);
												}}
												className="text-text-link hover:underline"
											>
												{row.resourceType}
											</a>
										</HSComp.TableCell>
										<HSComp.TableCell
											onClick={() => goToResource(row.resourceType)}
											className="cursor-pointer"
										>
											{row.url}
										</HSComp.TableCell>
									</HSComp.TableRow>
								);
							})
						: null}
			</HSComp.TableBody>
		</HSComp.Table>
	);
}

type StructureDefinitionEntry = {
	resource: {
		type?: string;
		name?: string;
		url?: string;
	};
};

type StructureDefinitionBundle = {
	entry?: StructureDefinitionEntry[];
};

function useResourceData(client: AidboxClientR5) {
	return useQuery<ResourceRow[]>({
		queryKey: ["resource-browser-resources"],
		staleTime: 5 * 60 * 1000,
		queryFn: async () => {
			const response = await client.rawRequest({
				method: "GET",
				url: "/fhir/StructureDefinition?kind=resource&derivation=specialization&_count=1000&_elements=type,name,url",
			});
			const bundle: StructureDefinitionBundle = await response.response.json();
			return (bundle.entry ?? []).map((entry) => ({
				resourceType: entry.resource.type ?? entry.resource.name ?? "",
				url: entry.resource.url ?? "",
			}));
		},
	});
}

type SortColumn = "resourceType" | "url";
type SortDirection = "asc" | "desc";
type SortState = { column: SortColumn; direction: SortDirection };

export function Browser() {
	const client = useAidboxClient();

	const { q } = useSearch({ from: "/resource/" });
	const filterQuery = q ?? "";

	const [favoritesArray, setFavoritesArray] = useLocalStorage<string[]>({
		key: "resource-browser-favorites",
		defaultValue: [],
	});

	const favorites = useMemo(() => new Set(favoritesArray), [favoritesArray]);

	const actionsRef = useRef<ResourceBrowserActions>(null!);
	useWebMCPResourceBrowser(actionsRef);

	const [sort, setSort] = useState<SortState>({
		column: "resourceType",
		direction: "asc",
	});

	const handleSort = (column: SortColumn) => {
		setSort((prev) =>
			prev.column === column
				? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
				: { column, direction: "asc" },
		);
	};

	const { data, isLoading } = useResourceData(client);

	const fuzzySearch = useMemo(
		() =>
			data
				? createFuzzySearch(data, {
						keys: [
							{ name: "resourceType", weight: 2 },
							{ name: "url", weight: 1 },
						],
						minMatchCharLength: 1,
						threshold: 0.3,
					})
				: () => [],
		[data],
	);

	const filteredData = useMemo(() => {
		const results = fuzzySearch(filterQuery);
		return [...results].sort((a, b) => {
			const aFav = favorites.has(a.resourceType);
			const bFav = favorites.has(b.resourceType);
			if (aFav !== bFav) return aFav ? -1 : 1;
			if (filterQuery) return 0;
			const cmp = a[sort.column].localeCompare(b[sort.column]);
			return sort.direction === "asc" ? cmp : -cmp;
		});
	}, [fuzzySearch, filterQuery, favorites, sort]);

	const [focusedIndex, setFocusedIndex] = useState(-1);
	const navigate = useNavigate();

	const setFilterQuery = (value: string) => {
		navigate({ search: (prev) => ({ ...prev, q: value || undefined }) });
	};

	actionsRef.current = {
		listResourceTypes: (filter) => {
			if (filter !== undefined) {
				setFilterQuery(filter);
			}
			const effectiveQuery = filter ?? filterQuery;
			const results = fuzzySearch(effectiveQuery);
			const sorted = [...results].sort((a, b) => {
				const aFav = favorites.has(a.resourceType);
				const bFav = favorites.has(b.resourceType);
				if (aFav !== bFav) return aFav ? -1 : 1;
				if (effectiveQuery) return 0;
				const cmp = a[sort.column].localeCompare(b[sort.column]);
				return sort.direction === "asc" ? cmp : -cmp;
			});
			return sorted.map((row) => ({
				resourceType: row.resourceType,
				url: row.url,
				isFavorite: favorites.has(row.resourceType),
			}));
		},
		getFavorites: () => favoritesArray,
		toggleFavorite: (resourceType) => {
			toggleFavorite(resourceType);
		},
		navigateToResourceType: (resourceType) => {
			navigate({
				to: "/resource/$resourceType",
				params: { resourceType },
			});
		},
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset focus on filter change
	React.useEffect(() => {
		setFocusedIndex(-1);
	}, [filterQuery]);

	const toggleFavorite = useMemo(
		() => (resourceType: string) => {
			setFavoritesArray((prev) => {
				if (prev.includes(resourceType)) {
					return prev.filter((item) => item !== resourceType);
				}
				return [...prev, resourceType];
			});
		},
		[setFavoritesArray],
	);

	const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
			e.preventDefault();
			setFocusedIndex((prev) => Math.min(prev + 1, filteredData.length - 1));
		} else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
			e.preventDefault();
			setFocusedIndex((prev) => Math.max(prev - 1, -1));
		} else if (
			e.key === "Enter" &&
			focusedIndex >= 0 &&
			focusedIndex < filteredData.length
		) {
			e.preventDefault();
			navigate({
				to: "/resource/$resourceType",
				params: { resourceType: filteredData[focusedIndex].resourceType },
			});
		}
	};

	return (
		<div className="overflow-hidden h-full flex flex-col">
			<div className="flex gap-4 items-center px-4 py-3 border-b border-border-secondary">
				<HSComp.Input
					autoFocus
					type="text"
					className="flex-1 bg-bg-primary"
					placeholder="Search resources"
					value={filterQuery}
					onChange={(e) => setFilterQuery(e.target.value)}
					onKeyDown={handleSearchKeyDown}
					rightSlot={
						filterQuery && (
							<HSComp.IconButton
								icon={<X />}
								aria-label="Clear"
								variant="link"
								onClick={() => setFilterQuery("")}
							/>
						)
					}
				/>
				<HSComp.Button variant="primary" className="min-w-24">
					Search
				</HSComp.Button>
			</div>
			<div className="grow min-h-0 overflow-hidden [&_[data-slot=table-container]]:overflow-visible [&_[data-slot=table-container]]:h-full [&_table]:flex [&_table]:flex-col [&_table]:h-full">
				{!isLoading && filteredData.length === 0 ? (
					<EmptyState
						title="No resource types found"
						description="Try a different search query"
					/>
				) : (
					<ResourceList
						data={filteredData}
						favorites={favorites}
						onToggleFavorite={toggleFavorite}
						isLoading={isLoading}
						focusedIndex={focusedIndex}
						sort={sort}
						onSort={handleSort}
					/>
				)}
			</div>
		</div>
	);
}
