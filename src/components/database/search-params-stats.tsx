import { Combobox, Input } from "@health-samurai/react-components";
import { useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useAidboxClient } from "../../AidboxClient";
import {
	type SearchParamStatRow,
	type SearchParamStatsOrderBy,
	type SortDir,
	useResetSearchParamStatsRows,
	useResourceTypes,
	useSearchParamStats,
	useSearchParamStatsCount,
} from "../../api/database";
import { DataTable } from "../data-table";
import { DataTableFooter } from "../data-table/footer";
import type { BulkAction, ColumnDef, SortState } from "../data-table/types";

function formatMs(v: number | null | undefined): string {
	if (v == null) return "—";
	if (v < 1) return `${v.toFixed(2)} ms`;
	if (v < 1000) return `${v.toFixed(1)} ms`;
	return `${(v / 1000).toFixed(2)} s`;
}

function formatNum(v: number | null | undefined): string {
	if (v == null) return "—";
	return v.toLocaleString();
}

function rowKey(r: SearchParamStatRow): string {
	return `${r.resource_type}:${r.search_param ?? (r.search_params ?? []).join(",")}`;
}

// Map UI column id → backend `order-by` key. Columns without a backend
// equivalent (e.g. `has_index`, which is computed post-query) are absent
// and won't render as sortable.
const COLUMN_TO_ORDER_BY: Record<string, SearchParamStatsOrderBy> = {
	resource_type: "resource-type",
	search_param: "search-param",
	calls: "calls",
	mean_time_ms: "mean-time-ms",
	total_time_ms: "total-time-ms",
	min_time_ms: "min-time-ms",
	max_time_ms: "max-time-ms",
	last_used_at: "last-used",
};

const DEFAULT_PAGE_SIZE = 30;

// Resolve `(resource_type, search_param)` → SearchParameter id by fetching
// the SP catalog per base (cached in react-query). We pre-fetch for the
// resource types on the current page so each row already knows its id by
// the time a user clicks. Lookups are small (one request per distinct base
// on the page); the response is cached, so paging through repeat bases
// only hits the server once.
function useSearchParameterIdLookup(rows: SearchParamStatRow[]) {
	const client = useAidboxClient();
	const bases = useMemo(
		() => Array.from(new Set(rows.map((r) => r.resource_type))).sort(),
		[rows],
	);
	const queries = useQueries({
		queries: bases.map((base) => ({
			queryKey: ["search-parameter-id-lookup", base] as const,
			queryFn: async () => {
				const resp = await client.rawRequest({
					method: "GET",
					url: `/fhir/SearchParameter?base=${base}&_count=500&_elements=id,code`,
					headers: { "Content-Type": "application/json" },
				});
				const json = (await resp.response.json()) as {
					entry?: { resource?: { id?: string; code?: string } }[];
				};
				const map: Record<string, string> = {};
				for (const e of json.entry ?? []) {
					const id = e.resource?.id;
					const c = e.resource?.code;
					if (id && c) map[c] = id;
				}
				return map;
			},
			staleTime: 5 * 60_000,
			retry: false,
		})),
	});
	return useMemo(() => {
		const merged: Record<string, string> = {};
		bases.forEach((base, i) => {
			const data = queries[i]?.data;
			if (!data) return;
			for (const [code, id] of Object.entries(data)) {
				merged[`${base}:${code}`] = id;
			}
		});
		return merged;
	}, [bases, queries]);
}

export function SearchParamsStats() {
	const [sort, setSort] = useState<SortState>({
		column: "calls",
		direction: "desc",
	});
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
	const [resourceFilter, setResourceFilter] = useState("");
	const [paramFilter, setParamFilter] = useState("");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	const orderBy: SearchParamStatsOrderBy = sort
		? (COLUMN_TO_ORDER_BY[sort.column] ?? "calls")
		: "calls";
	const orderDir: SortDir = sort?.direction ?? "desc";

	const queryArgs = {
		by: "param" as const,
		resourceType: resourceFilter || undefined,
		searchParamLike: paramFilter.trim() || undefined,
		orderBy,
		orderDir,
		limit: pageSize,
		offset: (page - 1) * pageSize,
	};

	const { data: rows, isLoading } = useSearchParamStats(queryArgs);
	const { data: countData } = useSearchParamStatsCount({
		by: "param",
		resourceType: queryArgs.resourceType,
		searchParamLike: queryArgs.searchParamLike,
	});
	const { data: resourceTypes } = useResourceTypes();
	const resourceTypeOptions = useMemo(
		() => [
			{ value: "", label: "All resource types" },
			...(resourceTypes ?? []).map((rt) => ({ value: rt, label: rt })),
		],
		[resourceTypes],
	);
	const resetRows = useResetSearchParamStatsRows();
	const total = countData?.total ?? 0;
	const spIdByKey = useSearchParameterIdLookup(rows ?? []);

	const rowByKey = useMemo(() => {
		const map = new Map<string, SearchParamStatRow>();
		for (const r of rows ?? []) map.set(rowKey(r), r);
		return map;
	}, [rows]);

	const bulkActions: BulkAction[] = [
		{
			id: "drop",
			label: "Drop stats",
			icon: <Trash2 className="size-3.5" />,
			variant: "danger",
			confirm: {
				title: "Drop stats for selected params?",
				description:
					"Removes collected stats for the selected (resource, search param) rows. Counters restart from zero.",
				actionLabel: "Drop",
			},
			onClick: () => {
				const targets = [...selectedIds]
					.map((id) => rowByKey.get(id))
					.filter((r): r is SearchParamStatRow => !!r?.search_param)
					.map((r) => ({
						resourceType: r.resource_type,
						searchParam: r.search_param as string,
					}));
				if (targets.length === 0) return;
				resetRows.mutate(targets, {
					onSuccess: () => setSelectedIds(new Set()),
				});
			},
		},
	];

	const linkToSp = (row: SearchParamStatRow, label: ReactNode) => {
		const code = row.search_param;
		const id = code ? spIdByKey[`${row.resource_type}:${code}`] : undefined;
		if (!id) return <span className="font-mono">{label}</span>;
		return (
			<Link
				to="/resource/$resourceType/edit/$id"
				params={{ resourceType: "SearchParameter", id }}
				search={{
					tab: "builder" as const,
					mode: "json" as const,
					builderTab: "form" as const,
				}}
				className="font-mono text-text-link hover:underline"
				onClick={(e) => e.stopPropagation()}
			>
				{label}
			</Link>
		);
	};

	const onSortToggle = (column: string) => {
		// Ignore clicks on non-sortable columns.
		if (!COLUMN_TO_ORDER_BY[column]) return;
		setPage(1);
		setSort((prev) => {
			if (prev?.column !== column) return { column, direction: "desc" };
			if (prev.direction === "desc") return { column, direction: "asc" };
			return null;
		});
	};

	const columns: ColumnDef<SearchParamStatRow>[] = [
		{
			id: "resource_type",
			header: "Resource",
			sortable: true,
			width: "w-[180px]",
			cell: (r) => linkToSp(r, r.resource_type),
		},
		{
			id: "search_param",
			header: "Search param",
			sortable: true,
			width: "w-[200px]",
			cell: (r) => linkToSp(r, r.search_param ?? "—"),
		},
		{
			id: "calls",
			header: "Calls",
			sortable: true,
			reverseIcon: true,
			width: "w-[100px]",
			className: "text-right tabular-nums",
			cell: (r) => formatNum(r.calls),
		},
		{
			id: "mean_time_ms",
			header: "Mean",
			sortable: true,
			reverseIcon: true,
			width: "w-[120px]",
			className: "text-right tabular-nums",
			cell: (r) => formatMs(r.mean_time_ms),
		},
		{
			id: "total_time_ms",
			header: "Total",
			sortable: true,
			reverseIcon: true,
			width: "w-[120px]",
			className: "text-right tabular-nums",
			cell: (r) => formatMs(r.total_time_ms),
		},
		{
			id: "min_time_ms",
			header: "Min",
			sortable: true,
			reverseIcon: true,
			width: "w-[100px]",
			className: "text-right tabular-nums",
			cell: (r) => formatMs(r.min_time_ms),
		},
		{
			id: "max_time_ms",
			header: "Max",
			sortable: true,
			reverseIcon: true,
			width: "w-[100px]",
			className: "text-right tabular-nums",
			cell: (r) => formatMs(r.max_time_ms),
		},
		{
			id: "has_index",
			header: "Has index",
			width: "w-[80px]",
			cell: (r) => (r.has_index ? "yes" : "no"),
		},
		{
			id: "last_used_at",
			header: "Last used",
			sortable: true,
			width: "w-[180px]",
			cell: (r) => r.last_used_at ?? "—",
		},
	];

	const onResourceFilterChange = (v: string) => {
		setPage(1);
		setResourceFilter(v);
	};
	const onParamFilterChange = (v: string) => {
		setPage(1);
		setParamFilter(v);
	};
	const onPageSizeChange = (s: number) => {
		setPage(1);
		setPageSize(s);
	};

	return (
		<div className="h-full flex flex-col">
			<div className="flex items-center gap-2 px-4 py-3 border-b border-border-secondary">
				<div className="flex flex-1">
					<Combobox
						options={resourceTypeOptions}
						value={resourceFilter}
						onValueChange={onResourceFilterChange}
						placeholder="All resource types"
						searchPlaceholder="Search resource types…"
						emptyText="No resource types found."
						className="w-fit shrink-0 rounded-r-none border-r-0"
					/>
					<Input
						placeholder="Search param"
						value={paramFilter}
						onChange={(e) => onParamFilterChange(e.target.value)}
						className="flex-1 rounded-l-none"
					/>
				</div>
			</div>
			<div className="flex-1 overflow-auto">
				<DataTable
					data={rows ?? []}
					columns={columns}
					rowKey={rowKey}
					loading={isLoading}
					resizable
					tableId="database-search-params"
					sort={sort}
					onSortToggle={onSortToggle}
					selectable
					selectedIds={selectedIds}
					onSelectionChange={setSelectedIds}
					emptyState={
						<div className="flex items-center justify-center h-full text-text-secondary">
							No search-param stats match. Run some FHIR searches or adjust
							filters.
						</div>
					}
				/>
			</div>
			<DataTableFooter
				total={total}
				currentPage={page}
				pageSize={pageSize}
				selectedCount={selectedIds.size}
				bulkActions={bulkActions}
				onPageChange={setPage}
				onPageSizeChange={onPageSizeChange}
			/>
		</div>
	);
}
