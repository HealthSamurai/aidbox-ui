import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AidboxCallWithMeta } from "../../../api/auth";

interface BundleEntry {
	resource: {
		id: string;
		resourceType: string;
		name?: string;
		status?: string;
		resource?: string;
		description?: string;
		meta?: {
			lastUpdated?: string;
			versionId?: string;
		};
	};
}

interface Bundle {
	resourceType: string;
	type: string;
	total: number;
	entry?: BundleEntry[];
}

const handleKeyPress = (
	e: React.KeyboardEvent<HTMLInputElement>,
	handleSearch: (query?: string) => void,
	searchQuery?: string,
) => {
	if (e.key === "Enter") {
		handleSearch(searchQuery);
	}
};

function ResourcesTab() {
	const [searchQuery, setSearchQuery] = useState("_count=30&_page=1");

	const { data, isLoading, refetch } = useQuery({
		queryKey: ["viewDefinitions", searchQuery],
		queryFn: async () => {
			const response = await AidboxCallWithMeta({
				method: "GET",
				url: `/fhir/ViewDefinition?${searchQuery}`,
			});
			return JSON.parse(response.body) as Bundle;
		},
	});

	const handleSearch = (query?: string) => {
		setSearchQuery(query || "");
		refetch();
	};

	const columns = [
		{
			accessorKey: "id",
			header: "ID",
			cell: (info: any) => (
				<a
					href={`/u/ViewDefinition/${info.getValue()}`}
					className="text-blue-500 hover:underline"
				>
					{info.getValue()}
				</a>
			),
		},
		{
			accessorKey: "lastUpdated",
			header: "Last Updated",
			cell: (info: any) => {
				const value = info.getValue();
				if (!value) return "";
				const date = new Date(value);
				const day = String(date.getDate()).padStart(2, "0");
				const month = String(date.getMonth() + 1).padStart(2, "0");
				const year = date.getFullYear();
				const hours = String(date.getHours()).padStart(2, "0");
				const minutes = String(date.getMinutes()).padStart(2, "0");
				const seconds = String(date.getSeconds()).padStart(2, "0");
				const ms = String(date.getMilliseconds()).padStart(3, "0");
				return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}.${ms}`;
			},
		},
		{
			accessorKey: "description",
			header: "Description",
			cell: (info: any) => info.getValue(),
		},
		{
			accessorKey: "name",
			header: "Name",
			cell: (info: any) => info.getValue(),
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: (info: any) => info.getValue(),
		},
		{
			accessorKey: "resource",
			header: "Resource",
			cell: (info: any) => info.getValue(),
		},
	];

	const tableData =
		data?.entry?.map((entry) => ({
			id: entry.resource.id,
			name: entry.resource.name,
			resource: entry.resource.resource,
			status: entry.resource.status,
			description: entry.resource.description,
			lastUpdated: entry.resource.meta?.lastUpdated,
		})) || [];

	return (
		<div className="flex flex-col h-full">
			<div className="p-3 border-b flex-none">
				<div className="flex gap-2">
					<HSComp.Input
						type="text"
						className="flex-1 bg-bg-primary"
						prefixValue={
							<span className="flex gap-1 text-nowrap text-elements-assistive">
								<span className="font-bold">GET</span>
								<span>/fhir/ViewDefinition?</span>
							</span>
						}
						placeholder="e.g. _count=30&_page=1&_sort=_id&_ilike="
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						onKeyPress={(e) => {
							handleKeyPress(e, handleSearch, searchQuery);
						}}
					/>
					<HSComp.Button
						variant="secondary"
						onClick={() => {
							handleSearch(searchQuery);
						}}
						disabled={isLoading}
					>
						Search
					</HSComp.Button>
				</div>
			</div>
			<div className="flex-1 min-h-0">
				{isLoading ? (
					<div>Loading...</div>
				) : (
					<div className="h-full">
						<HSComp.DataTable columns={columns} data={tableData} />
					</div>
				)}
			</div>
		</div>
	);
}

export function Resources() {
	const [selectedTab, setSelectedTab] = useState("resources");

	return (
		<HSComp.Tabs
			defaultValue={selectedTab}
			onValueChange={setSelectedTab}
			className="grow min-h-0 flex flex-col"
		>
			<div className="flex items-center gap-4 bg-bg-secondary px-6 border-b h-10 flex-none">
				<HSComp.TabsList>
					<HSComp.TabsTrigger value="resources">Resources</HSComp.TabsTrigger>
					<HSComp.TabsTrigger value="profiles">Profiles</HSComp.TabsTrigger>
					<HSComp.TabsTrigger value="operations">Operations</HSComp.TabsTrigger>
					<HSComp.TabsTrigger value="extensions">Extensions</HSComp.TabsTrigger>
				</HSComp.TabsList>
			</div>
			<HSComp.TabsContent value="resources" className="flex-1 min-h-0">
				<ResourcesTab />
			</HSComp.TabsContent>
			<HSComp.TabsContent value="profiles">
				{/* Profiles content */}
			</HSComp.TabsContent>
			<HSComp.TabsContent value="operations">
				{/* Operations content */}
			</HSComp.TabsContent>
			<HSComp.TabsContent value="extensions">
				{/* Extensions content */}
			</HSComp.TabsContent>
		</HSComp.Tabs>
	);
}
