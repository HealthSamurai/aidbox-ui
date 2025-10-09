import { useState } from "react";
import * as HSComp from "@health-samurai/react-components";
import { AidboxCallWithMeta } from "../../api/auth";
import { useQuery } from "@tanstack/react-query";
import { Pin, PinOff } from "lucide-react";

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";

	const units = ["bytes", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const value = bytes / Math.pow(1024, i);

	return `${value % 1 === 0 ? value : value.toFixed(2)} ${units[i]}`;
}

function ResourceList({
	isLoading,
	data,
	filterQuery,
	subset,
	favorites,
	onToggleFavorite,
}: {
	isLoading: boolean;
	data: { resources: unknown; stats: unknown } | undefined;
	filterQuery: string;
	subset?: string;
	favorites: Set<string>;
	onToggleFavorite: (resourceType: string) => void;
}) {
	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Fetching resource types...</div>
				</div>
			</div>
		);
	}

	const { resources, stats } = data;

	const lowerFilterQuery = filterQuery.toLowerCase();
	const isFavoritesSubset = subset === "favorites";

	const tableData = Object.entries(resources || {}).reduce(
		(acc, [key, value]) => {
			if (isFavoritesSubset && !favorites.has(key)) return acc;
			if (lowerFilterQuery && !key.toLowerCase().includes(lowerFilterQuery))
				return acc;

			const keyLower = key.toLowerCase();
			const resourceStats = stats[keyLower] || {};
			const historyStats = stats[`${keyLower}_history`] || {};

			const row = {
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

			if (subset && !isFavoritesSubset && !row[subset]) return acc;

			acc.push(row);
			return acc;
		},
		[],
	);

	const columns = [
		{
			accessorKey: "favorite",
			header: <Pin />,
			cell: (info: any) => {
				const resourceType = info.row.original.resourceType;
				const isFavorite = favorites.has(resourceType);
				return (
					<button
						type="button"
						onClick={() => onToggleFavorite(resourceType)}
						className="cursor-pointer"
					>
						{isFavorite ? <Pin size={16} /> : <PinOff size={16} />}
					</button>
				);
			},
		},
		{
			accessorKey: "resourceType",
			header: "Resource type",
			cell: (info: any) => info.getValue(),
		},
		{
			accessorKey: "tableSize",
			header: "Table size",
			cell: (info: any) => formatBytes(info.getValue()),
		},
		{
			accessorKey: "historySize",
			header: "History size",
			cell: (info: any) => formatBytes(info.getValue()),
		},
		{
			accessorKey: "indexSize",
			header: "Index size",
			cell: (info: any) => formatBytes(info.getValue()),
		},
		{
			accessorKey: "defaultProfile",
			header: "Default profile",
			cell: (info: any) => info.getValue(),
		},
	];

	return (
		<div className="h-full">
			<HSComp.DataTable columns={columns} data={tableData} stickyHeader />
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
						<HSComp.TabsTrigger value="all">All</HSComp.TabsTrigger>
						<HSComp.TabsTrigger value="populated">Polulated</HSComp.TabsTrigger>
						<HSComp.TabsTrigger value="fhir">FHIR</HSComp.TabsTrigger>
						<HSComp.TabsTrigger value="custom">Custom</HSComp.TabsTrigger>
						<HSComp.TabsTrigger value="system">System</HSComp.TabsTrigger>
						<HSComp.TabsTrigger value="favorites">
							favorites ({favorites.size})
						</HSComp.TabsTrigger>
					</HSComp.TabsList>
				</div>
				<HSComp.TabsContent value="all" className="min-h-0">
					<ResourceList
						isLoading={isLoading}
						data={data}
						filterQuery={filterQuery}
						favorites={favorites}
						onToggleFavorite={toggleFavorite}
					/>
				</HSComp.TabsContent>
				<HSComp.TabsContent value="populated">
					<ResourceList
						isLoading={isLoading}
						data={data}
						filterQuery={filterQuery}
						subset="populated"
						favorites={favorites}
						onToggleFavorite={toggleFavorite}
					/>
				</HSComp.TabsContent>
				<HSComp.TabsContent value="fhir">
					<ResourceList
						isLoading={isLoading}
						data={data}
						filterQuery={filterQuery}
						subset="fhir"
						favorites={favorites}
						onToggleFavorite={toggleFavorite}
					/>
				</HSComp.TabsContent>
				<HSComp.TabsContent value="custom">
					<ResourceList
						isLoading={isLoading}
						data={data}
						filterQuery={filterQuery}
						subset="custom"
						favorites={favorites}
						onToggleFavorite={toggleFavorite}
					/>
				</HSComp.TabsContent>
				<HSComp.TabsContent value="system">
					<ResourceList
						isLoading={isLoading}
						data={data}
						filterQuery={filterQuery}
						subset="system"
						favorites={favorites}
						onToggleFavorite={toggleFavorite}
					/>
				</HSComp.TabsContent>
				<HSComp.TabsContent value="favorites">
					<ResourceList
						isLoading={isLoading}
						data={data}
						filterQuery={filterQuery}
						subset="favorites"
						favorites={favorites}
						onToggleFavorite={toggleFavorite}
					/>
				</HSComp.TabsContent>
			</HSComp.Tabs>
		</div>
	);
}
