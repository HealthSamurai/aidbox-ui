import {
	Combobox,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocalStorage } from "../../hooks";
import { DataTable } from "../data-table/data-table";
import { DataTableFooter } from "../data-table/footer";
import type { ColumnDef, SortState } from "../data-table/types";
import { useAsyncOperationsList } from "./api";
import { StatusBadge } from "./status-badge";
import {
	type AsyncOperationSummary,
	DEFAULT_LIST_QUERY,
	type DisplayStatus,
	type ListQuery,
	type SortField,
	type SortOrder,
	STATUS_FILTER_OPTIONS,
	STATUS_TEXT_COLOR,
} from "./types";
import { displayStatus } from "./utils";

const COLUMN_TO_SORT_FIELD: Record<string, SortField> = {
	created: "created-at",
	lastUpdated: "last-updated",
};
const SORT_FIELD_TO_COLUMN: Record<SortField, string> = {
	"created-at": "created",
	"last-updated": "lastUpdated",
};

const parseTs = (s: string | null): number | null =>
	s ? new Date(s).getTime() : null;

function formatDuration(ms: number): string {
	const seconds = Math.max(0, Math.floor(ms / 1000));
	if (seconds < 60) return `${seconds}s`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
	return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function AsyncOperationsPage() {
	const search = useSearch({ from: "/async-operations/" });
	const navigate = useNavigate({ from: "/async-operations/" });

	const [sort, setSort] = useState<{
		sortField: SortField;
		sortOrder: SortOrder;
	}>({
		sortField: DEFAULT_LIST_QUERY.sortField,
		sortOrder: DEFAULT_LIST_QUERY.sortOrder,
	});
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useLocalStorage<number>({
		key: "async-operations:list-page-size",
		getInitialValueInEffect: false,
		defaultValue: DEFAULT_LIST_QUERY.pageSize,
	});

	const query: ListQuery = {
		statusFilter: search.status ?? "all",
		taskName: search.task ?? "",
		sortField: sort.sortField,
		sortOrder: sort.sortOrder,
		page,
		pageSize,
	};

	const { data, isLoading } = useAsyncOperationsList(query);

	const operations = data?.operations ?? [];
	const taskNames = data?.["task-names"] ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	if (total > 0 && page > totalPages) {
		setPage(totalPages);
	}

	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!operations.some((o) => o.status === "in-progress")) return;
		const t = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(t);
	}, [operations]);

	const setStatusFilter = (v: string) => {
		setPage(1);
		navigate({
			search: (prev) => ({
				...prev,
				status: v === "all" || v === "" ? undefined : (v as DisplayStatus),
			}),
		});
	};

	const setTaskFilter = (v: string | undefined) => {
		setPage(1);
		navigate({ search: (prev) => ({ ...prev, task: v || undefined }) });
	};

	const tableSort: SortState = {
		column: SORT_FIELD_TO_COLUMN[query.sortField],
		direction: query.sortOrder,
	};

	const handleSortToggle = (columnId: string) => {
		const field = COLUMN_TO_SORT_FIELD[columnId];
		if (!field) return;
		setPage(1);
		setSort((prev) =>
			prev.sortField === field
				? { ...prev, sortOrder: prev.sortOrder === "asc" ? "desc" : "asc" }
				: { sortField: field, sortOrder: "desc" },
		);
	};

	const columns: ColumnDef<AsyncOperationSummary>[] = [
		{
			id: "operation",
			header: "Operation",
			maxSize: 400,
			cell: (op) => {
				const id = op["operation-id"];
				return (
					<Link
						to="/async-operations/$operationId"
						params={{ operationId: id }}
						className="text-text-link hover:underline font-medium"
						title={id}
					>
						{id}
					</Link>
				);
			},
		},
		{
			id: "status",
			header: "Status",
			maxSize: 180,
			cell: (op) => (
				<StatusBadge status={displayStatus(op.status, op.running, op.active)} />
			),
		},
		{
			id: "task",
			header: "Task",
			maxSize: 300,
			cell: (op) => op["task-name"] ?? "—",
		},
		{
			id: "duration",
			header: "Duration",
			maxSize: 160,
			cell: (op) => {
				const start = parseTs(op["started-at"]);
				if (start === null) return "—";
				const end =
					op.status === "in-progress" ? now : parseTs(op["last-updated"]);
				if (end === null) return "—";
				return (
					<span className="text-text-secondary tabular-nums">
						{formatDuration(end - start)}
					</span>
				);
			},
		},
		{
			id: "tasks",
			header: "Tasks",
			maxSize: 180,
			cell: (op) => (
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="text-text-secondary tabular-nums">
							{op.succeeded}/{op.total}
						</span>
					</TooltipTrigger>
					<TooltipContent
						side="bottom"
						style={{ fontFamily: "var(--font-family-mono)" }}
						className="bg-bg-primary text-text-primary border border-border-primary shadow-md font-medium"
					>
						<div className="flex flex-col gap-0.5">
							<div className="flex justify-between gap-4">
								<span className={STATUS_TEXT_COLOR["in-progress"]}>Active</span>
								<span className="tabular-nums">{op.active}</span>
							</div>
							<div className="flex justify-between gap-4">
								<span className={STATUS_TEXT_COLOR.completed}>Succeeded</span>
								<span className="tabular-nums">{op.succeeded}</span>
							</div>
							<div className="flex justify-between gap-4">
								<span className={STATUS_TEXT_COLOR.failed}>Failed</span>
								<span className="tabular-nums">{op.failed}</span>
							</div>
						</div>
					</TooltipContent>
				</Tooltip>
			),
		},
		{
			id: "created",
			header: "Created",
			sortable: true,
			maxSize: 320,
			cell: (op) => (
				<span className="text-text-secondary whitespace-nowrap">
					{op["created-at"]}
				</span>
			),
		},
		{
			id: "lastUpdated",
			header: "Last updated",
			sortable: true,
			maxSize: 320,
			cell: (op) => (
				<span className="text-text-secondary whitespace-nowrap">
					{op["last-updated"]}
				</span>
			),
		},
	];

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border-secondary bg-bg-primary">
				<div className="flex items-center gap-2 flex-1 min-w-0">
					<Select
						value={query.statusFilter === "all" ? "" : query.statusFilter}
						onValueChange={setStatusFilter}
					>
						<SelectTrigger className="w-44 h-8">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							{STATUS_FILTER_OPTIONS.map((opt) => (
								<SelectItem
									key={opt.value}
									value={opt.value}
									className={
										opt.value === "all"
											? undefined
											: STATUS_TEXT_COLOR[opt.value]
									}
								>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Combobox
						options={taskNames.map((tn) => ({ value: tn, label: tn }))}
						value={query.taskName}
						onValueChange={setTaskFilter}
						placeholder="Task"
						searchPlaceholder="Search task..."
						emptyText="No tasks found."
						className="w-56 h-8"
					/>
					{query.taskName ? (
						<button
							type="button"
							onClick={() => setTaskFilter(undefined)}
							aria-label="Clear task filter"
							className="-ml-2 flex items-center justify-center size-8 shrink-0 cursor-pointer text-text-tertiary hover:text-text-primary"
						>
							<X className="size-4" />
						</button>
					) : null}
				</div>
			</div>

			<div className="flex-1 overflow-auto">
				<DataTable<AsyncOperationSummary>
					data={operations}
					columns={columns}
					rowKey={(op) => op["operation-id"]}
					loading={isLoading}
					sort={tableSort}
					onSortToggle={handleSortToggle}
					resizable
					tableId="async-operations"
					emptyState={
						<div className="flex items-center justify-center h-full text-text-secondary">
							No async operations found
						</div>
					}
				/>
			</div>
			{total > 0 ? (
				<DataTableFooter
					total={total}
					currentPage={page}
					pageSize={pageSize}
					selectedCount={0}
					onPageChange={setPage}
					onPageSizeChange={(size) => {
						setPageSize(size);
						setPage(1);
					}}
				/>
			) : null}
		</div>
	);
}
