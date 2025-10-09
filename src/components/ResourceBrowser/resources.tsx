import * as HSComp from "@health-samurai/react-components";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPageSizeSelector,
	PaginationPrevious,
} from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import * as Lucide from "lucide-react";
import { useState } from "react";
import { AidboxCallWithMeta } from "../../api/auth";

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

function ResourcesTab({ resourceType }: { resourceType: string }) {
	const [searchQuery, setSearchQuery] = useState("_count=30&_page=1");
	const [currentPage, setCurrentPage] = useState(1);
	const [pageSize, setPageSize] = useState(30);

	const { data, isLoading, refetch } = useQuery({
		queryKey: ["resource-browser-resources", searchQuery],
		queryFn: async () => {
			const response = await AidboxCallWithMeta({
				method: "GET",
				url: `/fhir/${resourceType}?${searchQuery}`,
			});
			return JSON.parse(response.body) as Bundle;
		},
	});

	const handleSearch = (query?: string) => {
		setSearchQuery(query || "");
		refetch();
	};

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
		const params = new URLSearchParams(searchQuery);
		params.set("_page", page.toString());
		setSearchQuery(params.toString());
	};

	const handlePageSizeChange = (size: number) => {
		setPageSize(size);
		setCurrentPage(1);
		const params = new URLSearchParams(searchQuery);
		params.set("_count", size.toString());
		params.set("_page", "1");
		setSearchQuery(params.toString());
	};

	const totalItems = data?.total || 0;
	const totalPages = Math.ceil(totalItems / pageSize);

	const getPageNumbers = () => {
		const pages: (number | "ellipsis")[] = [];
		const maxButtons = 5;

		if (totalPages <= maxButtons) {
			// Show all pages if total is less than or equal to max buttons
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			// Always show first page
			pages.push(1);

			if (currentPage <= 3) {
				// Near the beginning
				for (let i = 2; i <= 4; i++) {
					pages.push(i);
				}
				pages.push("ellipsis");
			} else if (currentPage >= totalPages - 2) {
				// Near the end
				pages.push("ellipsis");
				for (let i = totalPages - 3; i <= totalPages - 1; i++) {
					pages.push(i);
				}
			} else {
				// In the middle
				pages.push("ellipsis");
				pages.push(currentPage - 1);
				pages.push(currentPage);
				pages.push(currentPage + 1);
				pages.push("ellipsis");
			}

			// Always show last page
			pages.push(totalPages);
		}

		return pages;
	};

	const tableData =
		data?.entry?.map((entry) => ({
			id: entry.resource.id,
			name: entry.resource.name,
			resource: entry.resource.resource,
			status: entry.resource.status,
			description: entry.resource.description,
			lastUpdated: entry.resource.meta?.lastUpdated,
		})) || [];

	const columns = [
		{
			accessorKey: "id",
			header: "ID",
			cell: (info: any) => (
				<Link to={`/resource-types/${resourceType}/${info.getValue()}`}>
					<span className="text-blue-500 hover:underline">
						{info.getValue()}
					</span>
				</Link>
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

	return (
		<div className="flex flex-col h-full">
			<div className="p-4 border-b flex-none">
				<div className="flex gap-2">
					<HSComp.Input
						type="text"
						className="flex-1 bg-bg-primary"
						prefixValue={
							<span className="flex gap-1 text-nowrap text-elements-assistive">
								<span className="font-bold">GET</span>
								<span>/fhir/${resourceType}?</span>
							</span>
						}
						placeholder="e.g. _count=30&_page=1&_sort=_id&_ilike="
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						onKeyPress={(e) => {
							handleKeyPress(e, handleSearch, searchQuery);
						}}
					/>
					<div className="flex gap-4 items-center">
						<HSComp.Button
							variant="primary"
							onClick={() => {
								handleSearch(searchQuery);
							}}
							disabled={isLoading}
						>
							Search
						</HSComp.Button>
						<div className="h-6 border-l border-border-primary" />
						<Link to={`/resource-types/${resourceType}/new`} asChild>
							<HSComp.Button variant="secondary">
								<Lucide.PlusIcon className="text-fg-brand-primary" />
								Create
							</HSComp.Button>
						</Link>
					</div>
				</div>
			</div>
			<div className="flex-1 min-h-0">
				{isLoading ? (
					<div className="flex items-center justify-center h-full text-text-secondary">
						<div className="text-center">
							<div className="text-lg mb-2">Loading resources...</div>
							<div className="text-sm">Fetching {resourceType} resources</div>
						</div>
					</div>
				) : (
					<div className="h-full">
						<HSComp.DataTable columns={columns} data={tableData} stickyHeader />
					</div>
				)}
			</div>
			<div className="flex items-center justify-end bg-bg-secondary px-6 py-3 border-t h-12">
				<div className="flex items-center gap-4">
					<Pagination>
						<PaginationContent>
							<PaginationPrevious
								href="#"
								onClick={(e) => {
									e.preventDefault();
									if (currentPage > 1) {
										handlePageChange(currentPage - 1);
									}
								}}
								aria-disabled={currentPage <= 1}
								style={
									currentPage <= 1
										? {
												pointerEvents: "none",
												opacity: 0.5,
												cursor: "not-allowed",
											}
										: { cursor: "pointer" }
								}
							/>
							{getPageNumbers().map((page, index) => {
								if (page === "ellipsis") {
									return (
										<PaginationItem key={`ellipsis-${index}`}>
											<PaginationEllipsis />
										</PaginationItem>
									);
								}
								return (
									<PaginationItem key={page}>
										<PaginationLink
											href="#"
											onClick={(e) => {
												e.preventDefault();
												handlePageChange(page);
											}}
											isActive={currentPage === page}
										>
											{page}
										</PaginationLink>
									</PaginationItem>
								);
							})}
							<PaginationNext
								href="#"
								onClick={(e) => {
									e.preventDefault();
									if (currentPage < totalPages) {
										handlePageChange(currentPage + 1);
									}
								}}
								aria-disabled={currentPage >= totalPages}
								style={
									currentPage >= totalPages
										? {
												pointerEvents: "none",
												opacity: 0.5,
												cursor: "not-allowed",
											}
										: { cursor: "pointer" }
								}
							/>
						</PaginationContent>
						<PaginationPageSizeSelector
							pageSize={pageSize}
							onPageSizeChange={handlePageSizeChange}
							pageSizeOptions={[30, 50, 100]}
						/>
					</Pagination>
				</div>
			</div>
		</div>
	);
}

export function Resources({ resourceType }: { resourceType: string }) {
	const [selectedTab, setSelectedTab] = useState("resources");

	return (
		<HSComp.Tabs
			defaultValue={selectedTab}
			onValueChange={setSelectedTab}
			className="grow min-h-0 flex flex-col"
		>
			<div className="flex items-center gap-4 bg-bg-secondary px-4 border-b h-10 flex-none">
				<HSComp.TabsList>
					<HSComp.TabsTrigger value="resources">Resources</HSComp.TabsTrigger>
					<HSComp.TabsTrigger value="profiles">Profiles</HSComp.TabsTrigger>
					<HSComp.TabsTrigger value="operations">Operations</HSComp.TabsTrigger>
					<HSComp.TabsTrigger value="extensions">Extensions</HSComp.TabsTrigger>
				</HSComp.TabsList>
			</div>
			<HSComp.TabsContent value="resources" className="flex-1 min-h-0">
				<ResourcesTab resourceType={resourceType} />
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
