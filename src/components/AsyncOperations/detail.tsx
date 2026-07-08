import {
	Alert,
	AlertDescription,
	AlertTitle,
	Badge,
	Button,
	CodeEditor,
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@health-samurai/react-components";
import {
	AlertCircle,
	Ban,
	Check,
	Clock,
	Loader2,
	RefreshCw,
	X,
} from "lucide-react";
import { useRef, useState } from "react";
import { useLocalStorage } from "../../hooks";
import { ConfirmDialog } from "../confirm-dialog";
import { DataTable } from "../data-table/data-table";
import { DataTableFooter } from "../data-table/footer";
import type { ColumnDef, SortState } from "../data-table/types";
import { useAsyncOperationStatus, useCancelAsyncOperation } from "./api";
import { StatusBadge } from "./status-badge";
import type { AsyncOperationTask } from "./types";

const CANCEL_MARKER = "async-api.operation/cancel-marker";
const DEFAULT_PAGE_SIZE = 30;
const PAGE_SIZE_STORAGE_KEY = "async-operations:tasks-page-size";

type TaskState = "succeeded" | "failed" | "running" | "pending";

function taskState(task: AsyncOperationTask): TaskState {
	if (task.success === true) return "succeeded";
	if (task.success === false) return "failed";
	const started =
		task.picked === true ||
		Boolean(task.picked_by) ||
		Boolean(task.time_started);
	return started ? "running" : "pending";
}

function aggregate(tasks: AsyncOperationTask[]) {
	const real = tasks.filter((t) => t.task_name !== CANCEL_MARKER);
	let succeeded = 0;
	let failed = 0;
	let running = 0;
	let pending = 0;
	for (const t of real) {
		switch (taskState(t)) {
			case "succeeded":
				succeeded++;
				break;
			case "failed":
				failed++;
				break;
			case "running":
				running++;
				break;
			case "pending":
				pending++;
				break;
		}
	}
	return { total: real.length, succeeded, failed, running, pending };
}

function parseMs(value: string | null | undefined): number | null {
	return value ? new Date(value).getTime() : null;
}

function timeBounds(tasks: AsyncOperationTask[]) {
	let startMs: number | null = null;
	let startRaw: string | null = null;
	let endMs: number | null = null;
	let endRaw: string | null = null;
	for (const t of tasks) {
		if (t.task_name === CANCEL_MARKER) continue;
		const sRaw = t.time_started ?? t.execution_time ?? null;
		const s = parseMs(sRaw);
		if (s !== null && (startMs === null || s < startMs)) {
			startMs = s;
			startRaw = sRaw;
		}
		const eRaw = t.time_done ?? t.last_heartbeat ?? null;
		const e = parseMs(eRaw);
		if (e !== null && (endMs === null || e > endMs)) {
			endMs = e;
			endRaw = eRaw;
		}
	}
	return { startMs, startRaw, endMs, endRaw };
}

function formatDuration(ms: number): string {
	const sec = Math.max(0, Math.floor(ms / 1000));
	if (sec < 60) return `${sec}s`;
	if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
	return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function taskDurationMs(task: AsyncOperationTask): number | null {
	const start = parseMs(task.time_started ?? task.execution_time);
	if (start === null) return null;
	const end =
		parseMs(task.time_done) ?? (task.success == null ? Date.now() : null);
	return end === null ? null : end - start;
}

function getString(
	obj: Record<string, unknown> | null,
	key: string,
): string | null {
	if (!obj) return null;
	const v = obj[key];
	return typeof v === "string" && v.length > 0 ? v : null;
}

function findFailureMessage(tasks: AsyncOperationTask[]): {
	taskInstance: string;
	message: string;
} | null {
	for (const t of tasks) {
		if (t.success === false) {
			const msg =
				getString(t.task_outcome, "message") ??
				getString(t.task_outcome, "error") ??
				"Task failed (no error message recorded)";
			return { taskInstance: t.task_instance, message: msg };
		}
	}
	return null;
}

function TaskStatus({ task }: { task: AsyncOperationTask }) {
	const state = taskState(task);
	if (state === "succeeded") {
		return (
			<span className="flex items-center gap-1 text-utility-green">
				<Check className="size-4" />
				Succeeded
			</span>
		);
	}
	if (state === "failed") {
		return (
			<span className="flex items-center gap-1 text-utility-red">
				<X className="size-4" />
				Failed
			</span>
		);
	}
	if (state === "pending") {
		return (
			<span className="flex items-center gap-1 text-text-secondary">
				<Clock className="size-4" />
				Pending
			</span>
		);
	}
	return (
		<span className="flex items-center gap-1 text-utility-blue">
			<Loader2 className="size-4 animate-spin" />
			Running
		</span>
	);
}

const STATUS_SORT_ORDER: Record<TaskState, number> = {
	failed: 0,
	running: 1,
	pending: 2,
	succeeded: 3,
};

function taskSortValue(
	task: AsyncOperationTask,
	column: string,
): string | number {
	switch (column) {
		case "status":
			return STATUS_SORT_ORDER[taskState(task)];
		case "started":
			return task.time_started ?? task.execution_time ?? "";
		case "done":
			return task.time_done ?? "";
		case "duration":
			return taskDurationMs(task) ?? 0;
		default: {
			const v = (task as unknown as Record<string, unknown>)[column];
			if (typeof v === "number") return v;
			if (typeof v === "boolean") return v ? 1 : 0;
			if (typeof v === "string") return v;
			return 0;
		}
	}
}

const TASK_COLUMNS: ColumnDef<AsyncOperationTask>[] = [
	{
		id: "status",
		header: "Status",
		sortable: true,
		maxSize: 140,
		cell: (t) => <TaskStatus task={t} />,
	},
	{
		id: "task_instance",
		header: "Task instance",
		sortable: true,
		maxSize: 400,
		cell: (t) => <span className="font-mono">{t.task_instance}</span>,
	},
	{
		id: "task_name",
		header: "Task name",
		sortable: true,
		maxSize: 220,
		cell: (t) => t.task_name,
	},
	{
		id: "attempt",
		header: "Attempt",
		sortable: true,
		maxSize: 100,
		cell: (t) => t.attempt ?? "—",
	},
	{
		id: "started",
		header: "Started",
		sortable: true,
		maxSize: 260,
		cell: (t) => t.time_started ?? t.execution_time ?? "—",
	},
	{
		id: "done",
		header: "Done",
		sortable: true,
		maxSize: 260,
		cell: (t) => t.time_done ?? "—",
	},
	{
		id: "duration",
		header: "Duration",
		sortable: true,
		maxSize: 140,
		cell: (t) => {
			const ms = taskDurationMs(t);
			return ms === null ? "—" : formatDuration(ms);
		},
	},
	{
		id: "execution_time",
		header: "Execution time",
		sortable: true,
		maxSize: 260,
		cell: (t) => t.execution_time ?? "—",
	},
	{
		id: "executed_by",
		header: "Executed by",
		sortable: true,
		maxSize: 220,
		cell: (t) => t.executed_by ?? "—",
	},
	{
		id: "picked_by",
		header: "Picked by",
		sortable: true,
		maxSize: 180,
		cell: (t) => t.picked_by ?? "—",
	},
	{
		id: "last_heartbeat",
		header: "Last heartbeat",
		sortable: true,
		maxSize: 260,
		cell: (t) => t.last_heartbeat ?? "—",
	},
	{
		id: "last_success",
		header: "Last success",
		sortable: true,
		maxSize: 260,
		cell: (t) => t.last_success ?? "—",
	},
	{
		id: "last_failure",
		header: "Last failure",
		sortable: true,
		maxSize: 260,
		cell: (t) => t.last_failure ?? "—",
	},
	{
		id: "consecutive_failures",
		header: "Consecutive failures",
		sortable: true,
		maxSize: 170,
		cell: (t) => t.consecutive_failures ?? "—",
	},
	{
		id: "priority",
		header: "Priority",
		sortable: true,
		maxSize: 100,
		cell: (t) => t.priority ?? "—",
	},
	{
		id: "version",
		header: "Version",
		sortable: true,
		maxSize: 100,
		cell: (t) => t.version ?? "—",
	},
];

export function AsyncOperationDetail({ operationId }: { operationId: string }) {
	const { data, isLoading, isFetching, refetch, error } =
		useAsyncOperationStatus(operationId);
	const cancel = useCancelAsyncOperation();
	const [terminateOpen, setTerminateOpen] = useState(false);
	const [sort, setSort] = useState<SortState>({
		column: "started",
		direction: "desc",
	});
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useLocalStorage<number>({
		key: PAGE_SIZE_STORAGE_KEY,
		getInitialValueInEffect: false,
		defaultValue: DEFAULT_PAGE_SIZE,
	});

	// Reset to the first page when switching to a different operation.
	const prevOperationId = useRef(operationId);
	if (prevOperationId.current !== operationId) {
		prevOperationId.current = operationId;
		setPage(1);
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				Loading...
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-3 text-text-secondary">
				<div>Failed to load operation</div>
				<Button variant="secondary" size="small" onClick={() => refetch()}>
					Retry
				</Button>
			</div>
		);
	}

	const status = data.status;
	const isActive = status === "in-progress";
	const tasks = data.tasks ?? [];
	const visibleTasks = tasks.filter((t) => t.task_name !== CANCEL_MARKER);
	const sortedTasks = sort
		? [...visibleTasks].sort((a, b) => {
				const dir = sort.direction === "asc" ? 1 : -1;
				const av = taskSortValue(a, sort.column);
				const bv = taskSortValue(b, sort.column);
				if (typeof av === "string" && typeof bv === "string") {
					return dir * av.localeCompare(bv);
				}
				return dir * ((av as number) - (bv as number));
			})
		: visibleTasks;
	const total = sortedTasks.length;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const safePage = Math.min(page, totalPages);
	const pagedTasks = sortedTasks.slice(
		(safePage - 1) * pageSize,
		safePage * pageSize,
	);
	const handleSortToggle = (column: string) => {
		setPage(1);
		setSort((prev) =>
			prev?.column === column
				? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
				: { column, direction: "asc" },
		);
	};
	const counts = aggregate(tasks);
	const taskName =
		tasks.find((t) => t.task_name !== CANCEL_MARKER)?.task_name ?? "—";
	const { startMs, startRaw, endMs, endRaw } = timeBounds(tasks);
	const createdLabel = startRaw ?? "—";
	const updatedLabel = endRaw ?? "—";
	const durationEnd = status === "in-progress" ? Date.now() : endMs;
	const durationLabel =
		startMs !== null && durationEnd !== null
			? formatDuration(durationEnd - startMs)
			: "—";
	const metrics: { label: string; value: string | number }[] = [
		{ label: "Duration", value: durationLabel },
		{ label: "Total", value: counts.total },
		{ label: "Succeeded", value: counts.succeeded },
		...(counts.failed > 0 ? [{ label: "Failed", value: counts.failed }] : []),
		...(counts.running > 0
			? [{ label: "Running", value: counts.running }]
			: []),
		...(counts.pending > 0
			? [{ label: "Pending", value: counts.pending }]
			: []),
		{ label: "Created", value: createdLabel },
		{ label: "Updated", value: updatedLabel },
	];
	const failure =
		status === "failed" || counts.failed > 0 ? findFailureMessage(tasks) : null;

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center gap-4 bg-bg-secondary flex-none h-10 border-b border-border-secondary px-4">
				<Button
					variant="ghost"
					size="small"
					className="px-0! hover:bg-bg-secondary!"
					disabled={isFetching}
					onClick={() => refetch()}
				>
					<RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
					Refresh
				</Button>
				{isActive ? (
					<Button
						variant="ghost"
						danger
						size="small"
						className="px-0! hover:bg-bg-secondary!"
						disabled={cancel.isPending}
						onClick={() => setTerminateOpen(true)}
					>
						<Ban className="size-4" />
						Terminate
					</Button>
				) : null}
			</div>
			<div className="flex flex-col px-4 py-3 border-b border-border-secondary">
				<StatusBadge status={status} />
				<h1
					className="mt-1.5 text-lg font-semibold text-text-primary truncate"
					title={taskName}
				>
					{taskName}
				</h1>
				<div className="mt-3 flex items-center gap-2 flex-wrap">
					{metrics.map((m) => (
						<Badge
							key={m.label}
							variant="outline"
							className="border-transparent gap-1.5 font-normal bg-neutral-100 text-neutral-600"
						>
							<span className="opacity-70">{m.label}</span>
							<span className="font-medium tabular-nums">{m.value}</span>
						</Badge>
					))}
				</div>
			</div>

			{failure ? (
				<Alert variant="critical" className="mx-4 mt-3">
					<AlertCircle />
					<AlertTitle>
						{status === "failed" ? "Operation failed" : "A task failed"}
					</AlertTitle>
					<AlertDescription className="break-words">
						{failure.message}
					</AlertDescription>
					<AlertDescription className="text-text-secondary text-xs font-mono break-all">
						{failure.taskInstance}
					</AlertDescription>
				</Alert>
			) : null}

			<div className="flex-1 overflow-auto [&_tbody_tr:last-child]:border-b [&_tbody_tr:last-child]:border-border-secondary">
				<DataTable<AsyncOperationTask>
					data={pagedTasks}
					columns={TASK_COLUMNS}
					rowKey={(t) => t.task_instance}
					resizable
					zebra={false}
					sort={sort}
					onSortToggle={handleSortToggle}
					tableId="async-operation-tasks"
					renderExpandedRow={(t) => (
						<div className="h-80 w-full">
							<ResizablePanelGroup direction="horizontal" className="size-full">
								<ResizablePanel
									defaultSize={50}
									minSize={20}
									className="flex flex-col overflow-hidden"
								>
									<div className="shrink-0 pl-7 pt-2 pb-1 text-sm text-text-secondary">
										Input
									</div>
									<div className="flex-1 min-h-0 px-3">
										<CodeEditor
											readOnly
											mode="json"
											currentValue={JSON.stringify(
												t.task_data ?? null,
												null,
												2,
											)}
										/>
									</div>
								</ResizablePanel>
								<ResizableHandle />
								<ResizablePanel
									defaultSize={50}
									minSize={20}
									className="flex flex-col overflow-hidden"
								>
									<div className="shrink-0 pl-7 pt-2 pb-1 text-sm text-text-secondary">
										Output
									</div>
									<div className="flex-1 min-h-0 px-3">
										<CodeEditor
											readOnly
											mode="json"
											currentValue={JSON.stringify(
												t.task_outcome ?? null,
												null,
												2,
											)}
										/>
									</div>
								</ResizablePanel>
							</ResizablePanelGroup>
						</div>
					)}
					emptyState={
						<div className="flex items-center justify-center h-full text-text-secondary">
							No tasks recorded for this operation
						</div>
					}
				/>
			</div>
			{total > 0 ? (
				<DataTableFooter
					total={total}
					currentPage={safePage}
					pageSize={pageSize}
					selectedCount={0}
					onPageChange={setPage}
					onPageSizeChange={(size) => {
						setPageSize(size);
						setPage(1);
					}}
				/>
			) : null}
			<ConfirmDialog
				open={terminateOpen}
				onOpenChange={setTerminateOpen}
				title="Terminate operation"
				description="Active tasks will be removed. This cannot be undone."
				confirmLabel="Terminate"
				danger
				onConfirm={() => cancel.mutate(operationId)}
			/>
		</div>
	);
}
