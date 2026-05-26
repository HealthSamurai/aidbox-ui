import {
	Alert,
	AlertDescription,
	AlertTitle,
	Button,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@health-samurai/react-components";
import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import { useAsyncOperationStatus, useCancelAsyncOperation } from "./api";
import { StatusBadge } from "./status-badge";
import type { AsyncOperationStatus, AsyncOperationTask } from "./types";
import { formatDateTime } from "./utils";

function aggregate(tasks: AsyncOperationTask[]) {
	const total = tasks.length;
	const succeeded = tasks.filter((t) => t.success === true).length;
	const failed = tasks.filter((t) => t.success === false).length;
	const pending = total - succeeded - failed;
	return { total, succeeded, failed, pending };
}

const PROGRESS_BAR_COLOR: Record<AsyncOperationStatus, string> = {
	completed: "bg-utility-green",
	failed: "bg-utility-red",
	cancelled: "bg-utility-yellow",
	"in-progress": "bg-utility-blue",
};

function ProgressBar({
	status,
	counts,
}: {
	status: AsyncOperationStatus | "not-found";
	counts: { total: number; succeeded: number; failed: number };
}) {
	if (status === "not-found" || counts.total === 0) return null;
	const done = counts.succeeded + counts.failed;
	// Show 100% on terminal states regardless of recorded count — operations can
	// finish via cancel-marker without all chunks landing.
	const pct =
		status === "in-progress" ? Math.min(100, (done / counts.total) * 100) : 100;
	const color = PROGRESS_BAR_COLOR[status];
	return (
		<div className="h-2 rounded bg-bg-tertiary overflow-hidden">
			<div
				className={`h-full transition-[width] duration-300 ease-in-out ${color}`}
				style={{ width: `${pct}%` }}
			/>
		</div>
	);
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

function JsonBlock({ value }: { value: unknown }) {
	const text =
		value === null || value === undefined
			? "—"
			: JSON.stringify(value, null, 2);
	return (
		<pre className="text-xs bg-bg-secondary border border-border-secondary rounded p-2 overflow-auto max-h-72 whitespace-pre-wrap break-words">
			{text}
		</pre>
	);
}

export function AsyncOperationDetail({ operationId }: { operationId: string }) {
	const [tab, setTab] = useState("tasks");
	const { data, isLoading, refetch, isFetching, error } =
		useAsyncOperationStatus(operationId);
	const cancel = useCancelAsyncOperation();

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
	const tasks = data.tasks ?? [];
	const counts = aggregate(tasks);
	const isActive = status === "in-progress";
	const failure =
		status === "failed" || counts.failed > 0 ? findFailureMessage(tasks) : null;

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center gap-3 px-4 h-12 border-b border-border-secondary bg-bg-secondary">
				<Link
					to="/async-operations"
					className="text-text-link hover:underline flex items-center gap-1"
				>
					<ArrowLeft className="size-4" />
					Operations
				</Link>
				<span className="text-text-secondary">/</span>
				<span className="font-mono text-sm truncate" title={operationId}>
					{operationId}
				</span>
				<div className="ml-auto flex items-center gap-2">
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
					{isActive ? (
						<Button
							variant="secondary"
							danger
							size="small"
							disabled={cancel.isPending}
							onClick={() => {
								if (
									window.confirm(
										"Cancel this async operation? Active tasks will be removed.",
									)
								) {
									cancel.mutate(operationId);
								}
							}}
						>
							<XCircle className="size-4" />
							Cancel
						</Button>
					) : null}
				</div>
			</div>

			<div className="flex flex-col gap-3 px-4 py-3 border-b border-border-secondary">
				<div className="flex items-center gap-6">
					<div className="flex items-center gap-2">
						<span className="text-text-secondary text-sm">Status:</span>
						<StatusBadge status={status} />
					</div>
					<div className="text-sm text-text-secondary tabular-nums">
						{counts.succeeded}/{counts.total} succeeded
						{counts.failed > 0 ? (
							<span className="text-text-error-primary ml-2">
								{counts.failed} failed
							</span>
						) : null}
						{counts.pending > 0 ? (
							<span className="ml-2">{counts.pending} pending</span>
						) : null}
					</div>
				</div>
				<ProgressBar status={status} counts={counts} />
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

			<div className="flex-1 overflow-auto p-4">
				<Tabs value={tab} onValueChange={setTab}>
					<TabsList>
						<TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
						<TabsTrigger value="raw">Raw JSON</TabsTrigger>
					</TabsList>

					<TabsContent value="tasks" className="mt-3">
						{tasks.length === 0 ? (
							<div className="text-text-secondary text-sm py-6 text-center">
								No tasks recorded for this operation
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Task instance</TableHead>
										<TableHead>Task name</TableHead>
										<TableHead>Success</TableHead>
										<TableHead className="whitespace-nowrap">Started</TableHead>
										<TableHead className="whitespace-nowrap">Done</TableHead>
										<TableHead>Attempt</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{tasks.map((t) => (
										<TaskRow key={t.task_instance} task={t} />
									))}
								</TableBody>
							</Table>
						)}
					</TabsContent>

					<TabsContent value="raw" className="mt-3">
						<JsonBlock value={data} />
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}

function TaskRow({ task }: { task: AsyncOperationTask }) {
	const [expanded, setExpanded] = useState(false);
	const successLabel =
		task.success === true ? "yes" : task.success === false ? "no" : "—";
	const successClass =
		task.success === true
			? "text-utility-green"
			: task.success === false
				? "text-utility-red"
				: "text-text-secondary";

	return (
		<>
			<TableRow
				className="cursor-pointer"
				onClick={() => setExpanded((v) => !v)}
			>
				<TableCell className="font-mono text-xs max-w-0 truncate">
					{task.task_instance}
				</TableCell>
				<TableCell className="whitespace-nowrap text-xs">
					{task.task_name}
				</TableCell>
				<TableCell className={successClass}>{successLabel}</TableCell>
				<TableCell className="whitespace-nowrap text-text-secondary text-xs">
					{formatDateTime(task.time_started ?? task.execution_time)}
				</TableCell>
				<TableCell className="whitespace-nowrap text-text-secondary text-xs">
					{formatDateTime(task.time_done)}
				</TableCell>
				<TableCell className="text-text-secondary text-xs tabular-nums">
					{task.attempt ?? "—"}
				</TableCell>
			</TableRow>
			{expanded ? (
				<tr className="bg-bg-secondary">
					<td colSpan={6} className="p-3">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							<div>
								<div className="text-xs text-text-secondary mb-1">
									Input (task_data)
								</div>
								<JsonBlock value={task.task_data} />
							</div>
							<div>
								<div className="text-xs text-text-secondary mb-1">Outcome</div>
								<JsonBlock value={task.task_outcome} />
							</div>
						</div>
					</td>
				</tr>
			) : null}
		</>
	);
}
