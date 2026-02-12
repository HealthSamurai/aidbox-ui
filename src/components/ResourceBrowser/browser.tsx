import { useLocalStorage } from "@aidbox-ui/hooks/useLocalStorage";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import * as Lucide from "lucide-react";
import React, { useMemo, useState } from "react";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";

type ResourceRow = {
	resourceType: string;
	defaultProfile: string;
};

function SkeletonRows() {
	return (
		<>
			{Array.from({ length: 160 }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
				<HSComp.TableRow key={i} zebra index={i}>
					<HSComp.TableCell className="w-8" />
					<HSComp.TableCell className="w-52 min-w-52 max-w-52">
						<HSComp.Skeleton className="h-5 w-full" />
					</HSComp.TableCell>
					<HSComp.TableCell>
						<HSComp.Skeleton className="h-5 w-full" />
					</HSComp.TableCell>
				</HSComp.TableRow>
			))}
		</>
	);
}

function ResourceList({
	tableData,
	filterQuery,
	favorites,
	onToggleFavorite,
	isLoading,
	focusedIndex,
	sort,
	onSort,
}: {
	tableData: ResourceRow[];
	filterQuery: string;
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

	const filteredData = useMemo(() => {
		if (!filterQuery) return tableData;
		const lowerQuery = filterQuery.toLowerCase();
		return tableData.filter((row) =>
			row.resourceType.toLowerCase().includes(lowerQuery),
		);
	}, [tableData, filterQuery]);

	const goToResource = (resourceType: string) =>
		navigate({
			to: "/resource/$resourceType",
			params: { resourceType },
		});

	return (
		<HSComp.Table zebra stickyHeader>
			<HSComp.TableHeader>
				<HSComp.TableRow>
					<HSComp.TableHead className="w-8 text-text-secondary">
						<span className="opacity-50">
							<HSComp.PinIcon />
						</span>
					</HSComp.TableHead>
					<HSComp.TableHead
						className="w-52 min-w-52 max-w-52"
						sortable
						sorted={sort.column === "resourceType" && sort.direction}
						onClick={() => onSort("resourceType")}
					>
						Resource type
					</HSComp.TableHead>
					<HSComp.TableHead
						sortable
						sorted={sort.column === "defaultProfile" && sort.direction}
						onClick={() => onSort("defaultProfile")}
					>
						Default profile
					</HSComp.TableHead>
				</HSComp.TableRow>
			</HSComp.TableHeader>
			<HSComp.TableBody>
				{isLoading ? (
					<SkeletonRows />
				) : filteredData.length ? (
					filteredData.map((row, index) => {
						const isFavorite = favorites.has(row.resourceType);
						const isLastFavorite =
							isFavorite &&
							(index + 1 >= filteredData.length ||
								!favorites.has(filteredData[index + 1].resourceType));
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
									className="w-8 align-middle text-center cursor-pointer"
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
								<HSComp.TableCell className="w-52 min-w-52 max-w-52">
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
									{row.defaultProfile}
								</HSComp.TableCell>
							</HSComp.TableRow>
						);
					})
				) : null}
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
		queryFn: async () => {
			const response = await client.rawRequest({
				method: "GET",
				url: "/fhir/StructureDefinition?kind=resource&derivation=specialization&_count=1000",
			});
			const bundle: StructureDefinitionBundle = await response.response.json();
			return (bundle.entry ?? []).map((entry) => ({
				resourceType: entry.resource.type ?? entry.resource.name ?? "",
				defaultProfile: entry.resource.url ?? "",
			}));
		},
	});
}

type SortColumn = "resourceType" | "defaultProfile";
type SortDirection = "asc" | "desc";
type SortState = { column: SortColumn; direction: SortDirection };

function useSortedData(
	data: ResourceRow[] | undefined,
	favorites: Set<string>,
	sort: SortState,
): ResourceRow[] {
	return useMemo(() => {
		if (!data) return [];
		return [...data].sort((a, b) => {
			const aFav = favorites.has(a.resourceType);
			const bFav = favorites.has(b.resourceType);
			if (aFav !== bFav) return aFav ? -1 : 1;
			const cmp = a[sort.column].localeCompare(b[sort.column]);
			return sort.direction === "asc" ? cmp : -cmp;
		});
	}, [data, favorites, sort]);
}

export function Browser() {
	const client = useAidboxClient();

	const [filterQuery, setFilterQuery] = useState("");
	const [favoritesArray, setFavoritesArray] = useLocalStorage<string[]>({
		key: "resource-browser-favorites",
		defaultValue: [],
	});

	const favorites = useMemo(() => new Set(favoritesArray), [favoritesArray]);

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
	const allTableData = useSortedData(data, favorites, sort);

	const filteredData = useMemo(() => {
		if (!filterQuery) return allTableData;
		const lowerQuery = filterQuery.toLowerCase();
		return allTableData.filter((row) =>
			row.resourceType.toLowerCase().includes(lowerQuery),
		);
	}, [allTableData, filterQuery]);

	const [focusedIndex, setFocusedIndex] = useState(-1);
	const navigate = useNavigate();

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
				/>
				<HSComp.Button variant="primary" className="min-w-24">
					Search
				</HSComp.Button>
				<div className="w-px h-6 bg-border-secondary" />
				<HSComp.Button variant="secondary">
					<Lucide.PlusIcon
						className="size-4 text-text-error-primary"
						strokeWidth={1.25}
					/>
					Create
				</HSComp.Button>
			</div>
			<div className="grow min-h-0">
				{!isLoading && filteredData.length === 0 ? (
					<div className="flex items-center justify-center h-full">
						<div className="flex flex-col items-center gap-4">
							<div className="flex flex-col items-center gap-2">
								<img src="/no-resources.svg" alt="" />
								<span className="text-lg font-semibold">
									No resource types found
								</span>
							</div>
							<span className="text-text-secondary">
								Try a different search query
							</span>
						</div>
					</div>
				) : (
					<ResourceList
						tableData={allTableData}
						filterQuery={filterQuery}
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
