import {
	Button,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@health-samurai/react-components";
import { Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable } from "../data-table/data-table";
import type { ColumnDef, SortState } from "../data-table/types";
import { useAsyncOperationsList } from "./api";
import { StatusBadge } from "./status-badge";
import {
	type AsyncOperationStatus,
	type AsyncOperationSummary,
	DEFAULT_LIST_QUERY,
	type ListQuery,
	type SortField,
	STATUS_FILTER_OPTIONS,
} from "./types";
import { formatDateTime } from "./utils";

const COLUMN_TO_SORT_FIELD: Record<string, SortField> = {
	created: "created-at",
	lastUpdated: "last-updated",
};
const SORT_FIELD_TO_COLUMN: Record<SortField, string> = {
	"created-at": "created",
	"last-updated": "lastUpdated",
};

export function AsyncOperationsPage() {
	const [query, setQuery] = useState<ListQuery>(DEFAULT_LIST_QUERY);
	// Local input value, debounced into query.taskName so we don't refetch on every keystroke.
	const [taskNameInput, setTaskNameInput] = useState("");
	useEffect(() => {
		const t = setTimeout(() => {
			setQuery((prev) =>
				prev.taskName === taskNameInput
					? prev
					: { ...prev, taskName: taskNameInput },
			);
		}, 300);
		return () => clearTimeout(t);
	}, [taskNameInput]);

	const { data, isLoading, refetch, isFetching } =
		useAsyncOperationsList(query);

	const operations = data?.operations ?? [];
	const total = data?.total ?? 0;

	const tableSort: SortState = {
		column: SORT_FIELD_TO_COLUMN[query.sortField],
		direction: query.sortOrder,
	};

	const handleSortToggle = (columnId: string) => {
		const field = COLUMN_TO_SORT_FIELD[columnId];
		if (!field) return;
		setQuery((prev) =>
			prev.sortField === field
				? { ...prev, sortOrder: prev.sortOrder === "asc" ? "desc" : "asc" }
				: { ...prev, sortField: field, sortOrder: "desc" },
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
			id: "task",
			header: "Task",
			maxSize: 300,
			cell: (op) => op["task-name"] ?? "—",
		},
		{
			id: "status",
			header: "Status",
			maxSize: 180,
			cell: (op) => <StatusBadge status={op.status} />,
		},
		{
			id: "tasks",
			header: "Tasks",
			maxSize: 180,
			cell: (op) => (
				<span
					className="text-text-secondary tabular-nums"
					title={`active=${op.active} succeeded=${op.succeeded} failed=${op.failed}`}
				>
					{op.succeeded}/{op.total}
					{op.failed > 0 ? (
						<span className="text-text-error-primary ml-1">
							({op.failed} failed)
						</span>
					) : null}
				</span>
			),
		},
		{
			id: "created",
			header: "Created",
			sortable: true,
			defaultSize: 200,
			maxSize: 320,
			cell: (op) => (
				<span className="text-text-secondary whitespace-nowrap">
					{formatDateTime(op["created-at"])}
				</span>
			),
		},
		{
			id: "lastUpdated",
			header: "Last updated",
			sortable: true,
			defaultSize: 200,
			maxSize: 320,
			cell: (op) => (
				<span className="text-text-secondary whitespace-nowrap">
					{formatDateTime(op["last-updated"])}
				</span>
			),
		},
	];

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between gap-3 px-4 h-12 border-b border-border-secondary bg-bg-secondary">
				<div className="flex items-center gap-3 flex-1 min-w-0">
					<Select
						value={query.statusFilter}
						onValueChange={(v) =>
							setQuery((prev) => ({
								...prev,
								statusFilter: v as AsyncOperationStatus | "all",
							}))
						}
					>
						<SelectTrigger className="w-44 h-8">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							{STATUS_FILTER_OPTIONS.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Input
						className="h-8 max-w-72"
						placeholder="Filter by task name..."
						value={taskNameInput}
						onChange={(e) => setTaskNameInput(e.target.value)}
					/>
					<Button
						variant="ghost"
						size="small"
						onClick={() => refetch()}
						disabled={isFetching}
					>
						<RefreshCw
							className={isFetching ? "animate-spin size-4" : "size-4"}
						/>
						Refresh
					</Button>
				</div>
				<span className="text-text-secondary text-sm whitespace-nowrap">
					{total} operation{total === 1 ? "" : "s"}
				</span>
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
		</div>
	);
}
