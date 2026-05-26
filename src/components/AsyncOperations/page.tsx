import {
	Button,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@health-samurai/react-components";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useAsyncOperationsList } from "./api";
import { StatusBadge } from "./status-badge";
import {
	type AsyncOperationStatus,
	DEFAULT_LIST_QUERY,
	type ListQuery,
	type SortField,
	STATUS_FILTER_OPTIONS,
} from "./types";
import { formatDateTime } from "./utils";

function SortHeader({
	label,
	field,
	query,
	onSort,
}: {
	label: string;
	field: SortField;
	query: ListQuery;
	onSort: (field: SortField) => void;
}) {
	const active = query.sortField === field;
	const Icon = !active
		? ArrowUpDown
		: query.sortOrder === "asc"
			? ArrowUp
			: ArrowDown;
	return (
		<TableHead className="whitespace-nowrap">
			<button
				type="button"
				className={`inline-flex items-center gap-1 cursor-pointer hover:text-text-primary ${active ? "text-text-primary font-medium" : "text-text-secondary"}`}
				onClick={() => onSort(field)}
			>
				{label}
				<Icon className="size-3" />
			</button>
		</TableHead>
	);
}

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

	const toggleSort = (field: SortField) => {
		setQuery((prev) =>
			prev.sortField === field
				? { ...prev, sortOrder: prev.sortOrder === "asc" ? "desc" : "asc" }
				: { ...prev, sortField: field, sortOrder: "desc" },
		);
	};

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
				{isLoading ? (
					<div className="flex items-center justify-center h-full text-text-secondary">
						Loading...
					</div>
				) : operations.length === 0 ? (
					<div className="flex items-center justify-center h-full text-text-secondary">
						No async operations found
					</div>
				) : (
					<Table stickyHeader>
						<TableHeader>
							<TableRow>
								<TableHead>Operation</TableHead>
								<TableHead>Task</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="text-right">Tasks</TableHead>
								<SortHeader
									label="Created"
									field="created-at"
									query={query}
									onSort={toggleSort}
								/>
								<SortHeader
									label="Last updated"
									field="last-updated"
									query={query}
									onSort={toggleSort}
								/>
							</TableRow>
						</TableHeader>
						<TableBody>
							{operations.map((op) => {
								const id = op["operation-id"];
								return (
									<TableRow key={id}>
										<TableCell className="max-w-0 truncate">
											<Link
												to="/async-operations/$operationId"
												params={{ operationId: id }}
												className="text-text-link hover:underline font-medium"
												title={id}
											>
												{id}
											</Link>
										</TableCell>
										<TableCell className="whitespace-nowrap">
											{op["task-name"] ?? "—"}
										</TableCell>
										<TableCell>
											<StatusBadge status={op.status} />
										</TableCell>
										<TableCell className="text-right text-text-secondary tabular-nums">
											<span
												title={`active=${op.active} succeeded=${op.succeeded} failed=${op.failed}`}
											>
												{op.succeeded}/{op.total}
												{op.failed > 0 ? (
													<span className="text-text-error-primary ml-1">
														({op.failed} failed)
													</span>
												) : null}
											</span>
										</TableCell>
										<TableCell className="whitespace-nowrap text-text-secondary">
											{formatDateTime(op["created-at"])}
										</TableCell>
										<TableCell className="whitespace-nowrap text-text-secondary">
											{formatDateTime(op["last-updated"])}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				)}
			</div>
		</div>
	);
}
