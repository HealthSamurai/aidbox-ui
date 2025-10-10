import { useState, useMemo } from "react";
import * as HSComp from "@health-samurai/react-components";
import { AidboxCallWithMeta } from "../../api/auth";
import { useQuery } from "@tanstack/react-query";
import { Pin } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

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
	const value = bytes / Math.pow(1024, i);

	return `${value % 1 === 0 ? value : value.toFixed(2)} ${units[i]}`;
}

function FavoriteCell({
	resourceType,
	isFavorite,
	onToggle,
}: {
	resourceType: string;
	isFavorite: boolean;
	onToggle: (resourceType: string) => void;
}) {
	return (
		<button
			type="button"
			onClick={() => onToggle(resourceType)}
			className="cursor-pointer transition-opacity pin-button"
			style={{ opacity: isFavorite ? 1 : 0 }}
		>
			<Pin size={16} />
		</button>
	);
}

function ResourceList({
	tableData,
	filterQuery,
	favorites,
	onToggleFavorite,
}: {
	tableData: ResourceRow[];
	filterQuery: string;
	favorites: Set<string>;
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

	const makeClickableCell = (renderer: (value: any) => any) => {
		return (info: any) => (
			<div
				className="cursor-pointer"
				onClick={() =>
					navigate({
						to: "/resource-types/$resourceType",
						params: { resourceType: info.row.original.resourceType },
					})
				}
			>
				{renderer(info.getValue())}
			</div>
		);
	};

	const columns = [
		{
			accessorKey: "favorite",
			header: <Pin size={14} />,
			size: 40,
			cell: (info: any) => {
				const resourceType = info.row.original.resourceType;
				const isFavorite = favorites.has(resourceType);
				return (
					<FavoriteCell
						resourceType={resourceType}
						isFavorite={isFavorite}
						onToggle={onToggleFavorite}
					/>
				);
			},
		},
		{
			accessorKey: "resourceType",
			header: "Resource type",
			cell: makeClickableCell((value) => value),
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
			cell: makeClickableCell((value) => value),
		},
	];

	return (
		<div className="h-full">
			<HSComp.DataTable columns={columns} data={filteredData} stickyHeader />
		</div>
	);
}

function useResourceData() {
	return useQuery({
		queryKey: ["resource-browser-resources"],
		queryFn: async () => {
			const [resourceTypes, stats] = await Promise.all([
				AidboxCallWithMeta({
					method: "GET",
					url: "/$resource-types",
				}),
				AidboxCallWithMeta({
					method: "GET",
					url: "/$resource-types-pg-stats",
				}),
			]);
			return {
				resources: JSON.parse(resourceTypes.body),
				stats: JSON.parse(stats.body),
			};
		},
	});
}

function useProcessedData(
	data: any,
	favorites: Set<string>,
): { allTableData: ResourceRow[]; subsets: Subsets } {
	const allTableData = useMemo(() => {
		if (!data) return [];
		const { resources, stats } = data;

		return Object.entries(resources || {}).map(
			([key, value]: [string, any]) => {
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
					populated: resourceStats["num_rows"] > 0,
				};
			},
		);
	}, [data]);

	const subsets = useMemo(
		() => ({
			all: allTableData,
			populated: allTableData.filter((row) => row.populated),
			fhir: allTableData.filter((row) => row.fhir),
			custom: allTableData.filter((row) => row.custom),
			system: allTableData.filter((row) => row.system),
			favorites: allTableData.filter((row) => favorites.has(row.resourceType)),
		}),
		[allTableData, favorites],
	);

	return { allTableData, subsets };
}

export function Browser() {
	const [selectedTab, setSelectedTab] = useState("all");
	const [filterQuery, setFilterQuery] = useState("");
	const [favorites, setFavorites] = useState<Set<string>>(new Set());

	const { data, isLoading } = useResourceData();
	const { subsets } = useProcessedData(data, favorites);

	const toggleFavorite = (resourceType: string) => {
		setFavorites((prev) => {
			const next = new Set(prev);
			if (next.has(resourceType)) {
				next.delete(resourceType);
			} else {
				next.add(resourceType);
			}
			return next;
		});
	};

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
				defaultValue={selectedTab}
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
							favorites={favorites}
							onToggleFavorite={toggleFavorite}
						/>
					</HSComp.TabsContent>
				))}
			</HSComp.Tabs>
		</div>
	);
}
