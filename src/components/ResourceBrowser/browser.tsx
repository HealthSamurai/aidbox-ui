import { useState, useMemo } from "react";
import * as HSComp from "@health-samurai/react-components";
import { AidboxCallWithMeta } from "../../api/auth";
import { useQuery } from "@tanstack/react-query";
import { Pin, PinOff } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

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
	tableData: any[];
	filterQuery: string;
	favorites: Set<string>;
	onToggleFavorite: (resourceType: string) => void;
}) {
	const navigate = useNavigate();
	const lowerFilterQuery = filterQuery.toLowerCase();

	const filteredData = useMemo(() => {
		if (!lowerFilterQuery) return tableData;
		return tableData.filter((row) =>
			row.resourceType.toLowerCase().includes(lowerFilterQuery),
		);
	}, [tableData, lowerFilterQuery]);

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
			header: <Pin size={16} />,
			size: 20,
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

export function Browser() {
	const [selectedTab, setSelectedTab] = useState("all");
	const [filterQuery, setFilterQuery] = useState("");
	const [favorites, setFavorites] = useState<Set<string>>(new Set());

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

	const { data, isLoading } = useQuery({
		queryKey: ["resource-browser-resources"],
		queryFn: async () => {
			const resourceTypes = await AidboxCallWithMeta({
				method: "GET",
				url: "/$resource-types",
			});
			const stats = await AidboxCallWithMeta({
				method: "GET",
				url: "/$resource-types-pg-stats",
			});
			return {
				resources: JSON.parse(resourceTypes.body),
				stats: JSON.parse(stats.body),
			};
		},
	});

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
				populated: resourceStats["num_rows"] > 0,
			};
		});
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

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Fetching resource types...</div>
				</div>
			</div>
		);
	}

	return (
		<div className="overflow-hidden">
			<div className="flex gap-1 items-center p-1">
				<HSComp.Input
					type="text"
					className="flex-1 bg-bg-primary"
					placeholder="search resource types"
					value={filterQuery}
					onChange={(e) => setFilterQuery(e.target.value)}
				/>
				<div className="flex gap-4 items-center">
					<HSComp.Button
						variant="primary"
						onClick={() => {}}
						disabled={isLoading}
					>
						Search
					</HSComp.Button>
				</div>
			</div>
			<HSComp.Tabs
				defaultValue={selectedTab}
				onValueChange={setSelectedTab}
				className="grow min-h-0 flex flex-col"
			>
				<div className="flex items-center gap-4 bg-bg-secondary px-4 border-b h-10 flex-none">
					<HSComp.TabsList>
						<HSComp.TabsTrigger value="all">
							All ({subsets.all.length})
						</HSComp.TabsTrigger>
						<HSComp.TabsTrigger value="populated">
							Polulated ({subsets.populated.length})
						</HSComp.TabsTrigger>
						<HSComp.TabsTrigger value="fhir">
							FHIR ({subsets.fhir.length})
						</HSComp.TabsTrigger>
						<HSComp.TabsTrigger value="custom">
							Custom ({subsets.custom.length})
						</HSComp.TabsTrigger>
						<HSComp.TabsTrigger value="system">
							System ({subsets.system.length})
						</HSComp.TabsTrigger>
						<HSComp.TabsTrigger value="favorites">
							favorites ({favorites.size})
						</HSComp.TabsTrigger>
					</HSComp.TabsList>
				</div>
				<HSComp.TabsContent value="all" className="min-h-0">
					<ResourceList
						tableData={subsets.all}
						filterQuery={filterQuery}
						favorites={favorites}
						onToggleFavorite={toggleFavorite}
					/>
				</HSComp.TabsContent>
				<HSComp.TabsContent value="populated">
					<ResourceList
						tableData={subsets.populated}
						filterQuery={filterQuery}
						favorites={favorites}
						onToggleFavorite={toggleFavorite}
					/>
				</HSComp.TabsContent>
				<HSComp.TabsContent value="fhir">
					<ResourceList
						tableData={subsets.fhir}
						filterQuery={filterQuery}
						favorites={favorites}
						onToggleFavorite={toggleFavorite}
					/>
				</HSComp.TabsContent>
				<HSComp.TabsContent value="custom">
					<ResourceList
						tableData={subsets.custom}
						filterQuery={filterQuery}
						favorites={favorites}
						onToggleFavorite={toggleFavorite}
					/>
				</HSComp.TabsContent>
				<HSComp.TabsContent value="system">
					<ResourceList
						tableData={subsets.system}
						filterQuery={filterQuery}
						favorites={favorites}
						onToggleFavorite={toggleFavorite}
					/>
				</HSComp.TabsContent>
				<HSComp.TabsContent value="favorites">
					<ResourceList
						tableData={subsets.favorites}
						filterQuery={filterQuery}
						favorites={favorites}
						onToggleFavorite={toggleFavorite}
					/>
				</HSComp.TabsContent>
			</HSComp.Tabs>
		</div>
	);
}
