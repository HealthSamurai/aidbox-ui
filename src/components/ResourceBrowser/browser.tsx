import { useState } from "react";
import * as HSComp from "@health-samurai/react-components";
import { AidboxCallWithMeta } from "../../api/auth";
import { useQuery } from "@tanstack/react-query";

export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";

	const units = ["bytes", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const value = bytes / Math.pow(1024, i);

	return `${value % 1 === 0 ? value : value.toFixed(2)} ${units[i]}`;
}

function ResourceList({
	isLoading,
	data,
}: {
	isLoading: boolean;
	data: { resources: unknown; stats: unknown } | undefined;
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

	const tableData = Object.entries(resources || {}).map(([key, value]) => {
		const resourceStats = stats[key.toLowerCase()] || {};
		const historyStats = stats[`${key.toLowerCase()}_history`] || {};
		console.log(key, typeof key);
		return {
			resourceType: key,
			tableSize: resourceStats.total_size || 0,
			historySize: historyStats.total_size || 0,
			indexSize: resourceStats.index_size || 0,
			defaultProfile: value["default-profile"],
		};
	});

	const columns = [
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
	const [searchQuery, setSearchQuery] = useState("");

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
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					onKeyPress={(e) => {}}
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
						<HSComp.TabsTrigger value="favorites">Favorites</HSComp.TabsTrigger>
					</HSComp.TabsList>
				</div>
				<HSComp.TabsContent value="all" className="min-h-0">
					<ResourceList isLoading={isLoading} data={data} />
				</HSComp.TabsContent>
				<HSComp.TabsContent value="populated">
					{/* Profiles content */}
				</HSComp.TabsContent>
				<HSComp.TabsContent value="fhir">{/* */}</HSComp.TabsContent>
				<HSComp.TabsContent value="custom">{/* */}</HSComp.TabsContent>
				<HSComp.TabsContent value="system">{/* */}</HSComp.TabsContent>
				<HSComp.TabsContent value="favorites">{/* */}</HSComp.TabsContent>
			</HSComp.Tabs>
		</div>
	);
}
