import { useLocalStorage } from "@aidbox-ui/hooks/useLocalStorage";
import type * as AidboxTypes from "@health-samurai/aidbox-client";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Pin } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useAidboxClient } from "../../AidboxClient";

type ResourceRow = {
	resourceType: string;
	tableSize: number;
	historySize: number;
	indexSize: number;
	defaultProfile: string;
	system: boolean;
	fhir: boolean;
	custom: boolean;
	populated: boolean;
};

type Subsets = {
	all: ResourceRow[];
	populated: ResourceRow[];
	fhir: ResourceRow[];
	custom: ResourceRow[];
	system: ResourceRow[];
	favorites: ResourceRow[];
};

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";

	const units = ["bytes", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const value = bytes / 1024 ** i;

	return `${value % 1 === 0 ? value : value.toFixed(2)} ${units[i]}`;
}

const FavoriteCell = memo(
	({
		resourceType,
		getFavorites,
		onToggle,
	}: {
		resourceType: string;
		getFavorites: () => Set<string>;
		onToggle: (resourceType: string) => void;
	}) => {
		const [, forceUpdate] = useState({});
		const isFavorite = getFavorites().has(resourceType);
		return (
			<button
				type="button"
				onClick={() => {
					onToggle(resourceType);
					forceUpdate({});
				}}
				className="cursor-pointer transition-opacity pin-button"
				style={{ opacity: isFavorite ? 1 : 0 }}
			>
				<Pin size={16} />
			</button>
		);
	},
	(prev, next) => prev.resourceType === next.resourceType,
);

const ResourceList = memo(
	function ResourceList({
		tableData,
		filterQuery,
		getFavorites,
		onToggleFavorite,
	}: {
		tableData: ResourceRow[];
		filterQuery: string;
		getFavorites: () => Set<string>;
		onToggleFavorite: (resourceType: string) => void;
	}) {
		const navigate = useNavigate();

		const filteredData = useMemo(() => {
			if (!filterQuery) return tableData;
			const lowerQuery = filterQuery.toLowerCase();
			return tableData.filter((row) =>
				row.resourceType.toLowerCase().includes(lowerQuery),
			);
		}, [tableData, filterQuery]);

		const makeClickableCell = <T,>(renderer: (value: T) => React.ReactNode) => {
			return (info: { row: { original: ResourceRow }; getValue: () => T }) => (
				<button
					type="button"
					className="cursor-pointer"
					onClick={() =>
						navigate({
							to: "/resource/$resourceType",
							params: { resourceType: info.row.original.resourceType },
						})
					}
				>
					{renderer(info.getValue())}
				</button>
			);
		};

		const columns: {
			[K in keyof ResourceRow]: HSComp.ColumnDef<ResourceRow, ResourceRow[K]>;
		}[keyof ResourceRow][] = [
			{
				accessorKey: "favorite",
				header: () => <Pin size={14} />,
				size: 20,
				cell: (info) => {
					const resourceType = info.row.original.resourceType;
					return (
						<FavoriteCell
							resourceType={resourceType}
							getFavorites={getFavorites}
							onToggle={onToggleFavorite}
						/>
					);
				},
			},
			{
				accessorKey: "resourceType",
				header: "Resource type",
				cell: makeClickableCell<string>((value) => value),
			},
			{
				accessorKey: "tableSize",
				header: "Table size",
				cell: makeClickableCell(formatBytes),
			},
			{
				accessorKey: "historySize",
				header: "History size",
				cell: makeClickableCell(formatBytes),
			},
			{
				accessorKey: "indexSize",
				header: "Index size",
				cell: makeClickableCell(formatBytes),
			},
			{
				accessorKey: "defaultProfile",
				header: "Default profile",
				cell: makeClickableCell<string>((value) => value),
			},
		];

		return (
			<div className="h-full">
				<HSComp.DataTable columns={columns} data={filteredData} stickyHeader />
			</div>
		);
	},
	(prevProps, nextProps) => {
		return (
			prevProps.tableData === nextProps.tableData &&
			prevProps.filterQuery === nextProps.filterQuery
		);
	},
);

type ResourceTypeInfo = {
	"system?": boolean;
	"fhir?": boolean;
	"custom?": boolean;
	"default-profile": string;
};

type ResourceDataStats = {
	total_size?: number;
	index_size?: number;
	num_rows?: number;
};

type ResourceData = {
	resources: Record<string, ResourceTypeInfo>;
	stats: Record<string, ResourceDataStats>;
};

function useResourceData(client: AidboxTypes.AidboxClient) {
	return useQuery<ResourceData>({
		queryKey: ["resource-browser-resources"],
		queryFn: async () => {
			const [resourceTypes, stats] = await Promise.all([
				client.aidboxRawRequest({
					method: "GET",
					url: "/$resource-types",
				}),
				client.aidboxRawRequest({
					method: "GET",
					url: "/$resource-types-pg-stats",
				}),
			]);
			return {
				resources: JSON.parse(await resourceTypes.response.text()),
				stats: JSON.parse(await stats.response.text()),
			};
		},
	});
}

function useProcessedData(
	data: ResourceData | undefined,
	favorites: Set<string>,
): { allTableData: ResourceRow[]; subsets: Subsets } {
	const allTableData = useMemo(() => {
		if (!data) return [];
		const { resources, stats } = data;

		return Object.entries(resources || {}).map(([key, value]) => {
			const keyLower = key.toLowerCase();
			const resourceStats = stats[keyLower] || {};
			const historyStats = stats[`${keyLower}_history`] || {};

			return {
				resourceType: key,
				tableSize: resourceStats.total_size || 0,
				historySize: historyStats.total_size || 0,
				indexSize: resourceStats.index_size || 0,
				defaultProfile: value["default-profile"],
				system: value["system?"],
				fhir: value["fhir?"],
				custom: value["custom?"],
				populated: (resourceStats.num_rows ?? 0) > 0,
			};
		});
	}, [data]).sort((a, b) => a.resourceType.localeCompare(b.resourceType));

	// Memoize static subsets separately (don't depend on favorites)
	const staticSubsets = useMemo(
		() => ({
			all: allTableData,
			populated: allTableData.filter((row) => row.populated),
			fhir: allTableData.filter((row) => row.fhir),
			custom: allTableData.filter((row) => row.custom),
			system: allTableData.filter((row) => row.system),
		}),
		[allTableData],
	);

	// Only recompute favorites subset when favorites change
	const favoritesSubset = useMemo(
		() => allTableData.filter((row) => favorites.has(row.resourceType)),
		[allTableData, favorites],
	);

	const subsets = useMemo(
		() => ({
			...staticSubsets,
			favorites: favoritesSubset,
		}),
		[staticSubsets, favoritesSubset],
	);

	return { allTableData, subsets };
}

export function Browser() {
	const client = useAidboxClient();

	const [selectedTab, setSelectedTab] = useLocalStorage<string>({
		key: "resource-browser-selected-tab",
		defaultValue: "all",
	});
	const [filterQuery, setFilterQuery] = useState("");
	const [favoritesArray, setFavoritesArray] = useLocalStorage<string[]>({
		key: "resource-browser-favorites",
		defaultValue: [],
	});

	const favorites = useMemo(() => new Set(favoritesArray), [favoritesArray]);
	const favoritesRef = useMemo(() => ({ current: favorites }), [favorites]);
	favoritesRef.current = favorites;

	const getFavorites = useMemo(
		() => () => favoritesRef.current,
		[favoritesRef.current],
	);

	const { data, isLoading } = useResourceData(client);
	const { subsets } = useProcessedData(data, favorites);

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

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Fetching resource types...</div>
				</div>
			</div>
		);
	}

	const tabs = [
		{ value: "all", label: "All", count: subsets.all.length },
		{ value: "populated", label: "Populated", count: subsets.populated.length },
		{ value: "fhir", label: "FHIR", count: subsets.fhir.length },
		{ value: "custom", label: "Custom", count: subsets.custom.length },
		{ value: "system", label: "System", count: subsets.system.length },
		{ value: "favorites", label: "Favorites", count: favorites.size },
	];

	return (
		<div className="overflow-hidden h-full flex flex-col">
			<div className="flex gap-1 items-center p-1">
				<HSComp.Input
					type="text"
					className="flex-1 bg-bg-primary"
					placeholder="Search resource types"
					value={filterQuery}
					onChange={(e) => setFilterQuery(e.target.value)}
				/>
			</div>
			<HSComp.Tabs
				value={selectedTab}
				onValueChange={setSelectedTab}
				className="grow min-h-0 flex flex-col"
			>
				<div className="flex items-center gap-4 bg-bg-secondary px-4 border-b h-10 flex-none">
					<HSComp.TabsList>
						{tabs.map((tab) => (
							<HSComp.TabsTrigger key={tab.value} value={tab.value}>
								{tab.label} ({tab.count})
							</HSComp.TabsTrigger>
						))}
					</HSComp.TabsList>
				</div>
				{tabs.map((tab) => (
					<HSComp.TabsContent
						key={tab.value}
						value={tab.value}
						className="min-h-0"
					>
						<ResourceList
							tableData={subsets[tab.value as keyof Subsets]}
							filterQuery={filterQuery}
							getFavorites={getFavorites}
							onToggleFavorite={toggleFavorite}
						/>
					</HSComp.TabsContent>
				))}
			</HSComp.Tabs>
		</div>
	);
}
