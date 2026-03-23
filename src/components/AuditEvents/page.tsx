import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import { useCallback, useState } from "react";
import { useAidboxClient } from "../../AidboxClient";
import { formatSearchQuery } from "../../utils";
import { AuditEventsFilters } from "./audit-events-filters";
import { AuditEventsTable } from "./audit-events-table";
import {
	type AuditEventFilters,
	type AuditEventResource,
	buildQueryParams,
	emptyFilters,
	PAGE_SIZE,
	PAGE_SIZE_OPTIONS,
} from "./utils";

export function AuditEventsPage() {
	const client = useAidboxClient();
	const [filters, setFilters] = useState<AuditEventFilters>(emptyFilters);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(PAGE_SIZE);

	const params = buildQueryParams(filters, page, pageSize);

	const { data, isLoading } = useQuery({
		queryKey: ["audit-events", params],
		queryFn: async () => {
			const result = await client.searchType({
				type: "AuditEvent",
				query: formatSearchQuery(params),
			});
			if (result.isErr()) {
				throw new Error("Failed to fetch audit events", {
					cause: result.value.resource,
				});
			}
			const bundle = result.value.resource;
			return {
				total: bundle?.total ?? 0,
				events:
					bundle?.entry?.flatMap((e) =>
						e.resource ? [e.resource as AuditEventResource] : [],
					) ?? [],
			};
		},
	});

	const total = data?.total ?? 0;
	const events = data?.events ?? [];
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	const handleFiltersChange = useCallback((newFilters: AuditEventFilters) => {
		setFilters(newFilters);
		setPage(1);
	}, []);

	const handlePageSizeChange = (size: number) => {
		setPageSize(size);
		setPage(1);
	};

	return (
		<div className="flex flex-col h-full">
			<AuditEventsFilters
				filters={filters}
				onFiltersChange={handleFiltersChange}
			/>
			<div className="flex-1 overflow-auto">
				<AuditEventsTable
					events={events}
					isLoading={isLoading}
					onUserClick={(userId) => handleFiltersChange({ ...filters, userId })}
					onPatientClick={(patientId) =>
						handleFiltersChange({ ...filters, patientId })
					}
					onClientClick={(clientId) =>
						handleFiltersChange({ ...filters, clientId })
					}
				/>
			</div>
			<div className="flex items-center justify-between border-t bg-bg-secondary px-4 h-10">
				<div className="flex items-center gap-4">
					<span className="text-text-secondary text-sm">
						{total} event{total !== 1 ? "s" : ""}
					</span>
				</div>
				<div className="flex items-center gap-4">
					<HSComp.DropdownMenu>
						<HSComp.DropdownMenuTrigger asChild>
							<HSComp.Button variant="ghost" size="small">
								{pageSize}/page
								<Lucide.ChevronDownIcon size={14} />
							</HSComp.Button>
						</HSComp.DropdownMenuTrigger>
						<HSComp.DropdownMenuContent align="end">
							{PAGE_SIZE_OPTIONS.map((size) => (
								<HSComp.DropdownMenuItem
									key={size}
									onClick={() => handlePageSizeChange(size)}
								>
									{size}/page
								</HSComp.DropdownMenuItem>
							))}
						</HSComp.DropdownMenuContent>
					</HSComp.DropdownMenu>
					<PaginationPages
						currentPage={page}
						totalPages={totalPages}
						onPageChange={setPage}
					/>
				</div>
			</div>
		</div>
	);
}

function PaginationPages({
	currentPage,
	totalPages,
	onPageChange,
}: {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}) {
	const pages: (number | string)[] = [];

	if (totalPages <= 7) {
		for (let i = 1; i <= totalPages; i++) pages.push(i);
	} else {
		pages.push(1);
		if (currentPage > 3) pages.push("ellipsis-start");
		const start = Math.max(2, currentPage - 1);
		const end = Math.min(totalPages - 1, currentPage + 1);
		for (let i = start; i <= end; i++) pages.push(i);
		if (currentPage < totalPages - 2) pages.push("ellipsis-end");
		pages.push(totalPages);
	}

	return (
		<div className="flex items-center gap-1">
			<HSComp.Button
				variant="ghost"
				size="small"
				disabled={currentPage <= 1}
				onClick={() => onPageChange(currentPage - 1)}
			>
				<Lucide.ChevronLeftIcon size={16} />
			</HSComp.Button>
			{pages.map((p) =>
				typeof p === "string" ? (
					<span key={p} className="px-1 text-elements-assistive">
						...
					</span>
				) : (
					<HSComp.Button
						key={p}
						variant={p === currentPage ? "secondary" : "ghost"}
						size="small"
						onClick={() => onPageChange(p)}
					>
						{p}
					</HSComp.Button>
				),
			)}
			<HSComp.Button
				variant="ghost"
				size="small"
				disabled={currentPage >= totalPages}
				onClick={() => onPageChange(currentPage + 1)}
			>
				<Lucide.ChevronRightIcon size={16} />
			</HSComp.Button>
		</div>
	);
}
