import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { PlusIcon, X } from "lucide-react";
import React, { useMemo, useRef, useState } from "react";
import { useAidboxClient } from "../../AidboxClient";
import { createFuzzySearch } from "../../utils/fuzzy-search";
import { useWebMCPIGBrowser } from "../../webmcp/ig-browser";
import type { IGBrowserActions } from "../../webmcp/ig-browser-context";
import { EmptyState } from "../empty-state";

type Installation = {
	intention: string;
};

type PackageRow = {
	id: string;
	name: string;
	version: string;
	type: string;
	installation: Installation[];
};

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

const SYSTEM_PREFIXES = [
	"io.health-samurai.core",
	"io.health-samurai.sdc",
	"io.health-samurai.mdm",
];

function getPackageType(name: string, installation: Installation[]): string {
	if (SYSTEM_PREFIXES.some((prefix) => name.startsWith(prefix))) {
		return "System";
	}
	const first = installation?.[0]?.intention;
	return first ? capitalize(first) : "";
}

function usePackagesData() {
	const client = useAidboxClient();

	return useQuery<PackageRow[]>({
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
				return {
					id: `${name}#${version}`,
					name,
					version,
					type: getPackageType(name, installation),
					installation,
				};
			});
		},
	});
}

type SortColumn = "name" | "type";
type SortState = { column: SortColumn; direction: "asc" | "desc" };

const skeletonRows = Array.from({ length: 20 }, (_, i) => (
	// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
	<HSComp.TableRow key={`skeleton-${i}`} zebra index={i}>
		<HSComp.TableCell>
			<div className="flex items-center gap-2">
				<HSComp.Skeleton
					className="h-5"
					style={{ width: `${140 + ((i * 47) % 160)}px` }}
				/>
				<HSComp.Skeleton
					className="h-5"
					style={{ width: `${50 + ((i * 31) % 40)}px` }}
				/>
			</div>
		</HSComp.TableCell>
		<HSComp.TableCell>
			<HSComp.Skeleton
				className="h-5"
				style={{ width: `${60 + ((i * 23) % 40)}px` }}
			/>
		</HSComp.TableCell>
	</HSComp.TableRow>
));

function PackageList({
	data,
	isLoading,
	sort,
	onSort,
	focusedIndex,
}: {
	data: PackageRow[];
	isLoading: boolean;
	sort: SortState;
	onSort: (column: SortColumn) => void;
	focusedIndex: number;
}) {
	const navigate = useNavigate();
	const focusedRowRef = React.useRef<HTMLTableRowElement | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: focusedIndex triggers scroll
	React.useEffect(() => {
		focusedRowRef.current?.scrollIntoView({ block: "nearest" });
	}, [focusedIndex]);

	const goToPackage = (packageId: string) =>
		navigate({
			to: "/ig/$packageId",
			params: { packageId },
		});

	return (
		<div className="h-full overflow-hidden [&_[data-slot=table-container]]:overflow-visible [&_[data-slot=table-container]]:h-full [&_table]:h-full">
			<HSComp.Table zebra>
				<HSComp.TableHeader className="block overflow-y-scroll scrollbar-none [&_tr]:table [&_tr]:w-full">
					<HSComp.TableRow>
						<HSComp.TableHead
							sortable
							sorted={sort.column === "name" && sort.direction}
							onClick={() => onSort("name")}
							className="pl-7!"
						>
							Package
						</HSComp.TableHead>
						<HSComp.TableHead
							className="w-36"
							sortable
							sorted={sort.column === "type" && sort.direction}
							onClick={() => onSort("type")}
						>
							Type
						</HSComp.TableHead>
					</HSComp.TableRow>
				</HSComp.TableHeader>
				<HSComp.TableBody
					className="block overflow-y-auto [&_tr]:table [&_tr]:w-full"
					style={{ height: "calc(100% - 41px)" }}
				>
					{isLoading
						? skeletonRows
						: data.map((row, index) => (
								<HSComp.TableRow
									ref={index === focusedIndex ? focusedRowRef : undefined}
									key={row.id}
									zebra
									index={index}
									className={HSComp.cn(
										"cursor-pointer",
										index === focusedIndex && "bg-bg-hover",
									)}
									onClick={() => goToPackage(row.id)}
								>
									<HSComp.TableCell className="pl-7!">
										<span className="text-text-link hover:underline">
											{row.name}
										</span>{" "}
										<span className="text-text-secondary">{row.version}</span>
									</HSComp.TableCell>
									<HSComp.TableCell className="w-36 text-text-secondary">
										{row.type}
									</HSComp.TableCell>
								</HSComp.TableRow>
							))}
				</HSComp.TableBody>
			</HSComp.Table>
		</div>
	);
}

export function Browser() {
	const { data, isLoading } = usePackagesData();

	const { q, sort: sortParam } = useSearch({ from: "/ig/" });
	const filterQuery = q ?? "";
	const [focusedIndex, setFocusedIndex] = useState(-1);
	const navigate = useNavigate();

	const DEFAULT_SORT: SortState = { column: "type", direction: "asc" };

	const sort: SortState = useMemo(() => {
		if (!sortParam) return DEFAULT_SORT;
		const desc = sortParam.startsWith("-");
		const col = (desc ? sortParam.slice(1) : sortParam) as SortColumn;
		if (col !== "name" && col !== "type") return DEFAULT_SORT;
		return { column: col, direction: desc ? "desc" : "asc" };
	}, [sortParam]);

	const serializeSort = (s: SortState): string | undefined => {
		if (
			s.column === DEFAULT_SORT.column &&
			s.direction === DEFAULT_SORT.direction
		)
			return undefined;
		return s.direction === "desc" ? `-${s.column}` : s.column;
	};

	const setFilterQuery = (q: string) => {
		navigate({ search: (prev) => ({ ...prev, q: q || undefined }) });
	};

	const handleSort = (column: SortColumn) => {
		const next =
			sort.column === column
				? {
						column,
						direction:
							sort.direction === "asc" ? ("desc" as const) : ("asc" as const),
					}
				: { column, direction: "asc" as const };
		navigate({ search: (prev) => ({ ...prev, sort: serializeSort(next) }) });
	};

	const fuzzySearch = useMemo(
		() =>
			data
				? createFuzzySearch(data, {
						keys: [
							{ name: "id", weight: 2 },
							{ name: "type", weight: 1 },
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
			const aVal = a[sort.column];
			const bVal = b[sort.column];
			const cmp = aVal.localeCompare(bVal);
			return sort.direction === "asc" ? cmp : -cmp;
		});
	}, [fuzzySearch, filterQuery, sort]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset focus on filter change
	React.useEffect(() => {
		setFocusedIndex(filteredData.length === 1 ? 0 : -1);
	}, [filterQuery]);

	const actionsRef = useRef<IGBrowserActions>({} as IGBrowserActions);
	actionsRef.current = {
		listPackages: (query?: string) => {
			if (query !== undefined) {
				setFilterQuery(query);
			}
			const results = fuzzySearch(query ?? filterQuery);
			const sorted = [...results].sort((a, b) => {
				const cmp = a[sort.column].localeCompare(b[sort.column]);
				return sort.direction === "asc" ? cmp : -cmp;
			});
			return sorted.map((p) => ({
				name: p.name,
				version: p.version,
				type: p.type,
			}));
		},
		getSort: () => ({ column: sort.column, direction: sort.direction }),
		sortPackages: (column) => {
			handleSort(column);
		},
		selectPackage: (id) => {
			navigate({ to: "/ig/$packageId", params: { packageId: id } });
		},
		openInstallationPage: () => {
			navigate({ to: "/ig/add" });
		},
	};
	useWebMCPIGBrowser(actionsRef);

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
				to: "/ig/$packageId",
				params: { packageId: filteredData[focusedIndex].id },
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
					placeholder="Search packages"
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
				<div className="w-px h-6 bg-border-secondary" />
				<HSComp.Button variant="secondary" asChild>
					<Link to="/ig/add">
						<PlusIcon
							className="size-4 text-text-error-primary"
							strokeWidth={1.25}
						/>
						Package
					</Link>
				</HSComp.Button>
			</div>
			<div className="grow min-h-0">
				{!isLoading && filteredData.length === 0 ? (
					<EmptyState
						title="No packages found"
						description="Try a different search query"
					/>
				) : (
					<PackageList
						data={filteredData}
						isLoading={isLoading}
						sort={sort}
						onSort={handleSort}
						focusedIndex={focusedIndex}
					/>
				)}
			</div>
		</div>
	);
}
