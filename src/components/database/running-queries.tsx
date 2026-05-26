import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	CodeEditor,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { Pause, Play, RefreshCw, Square, X } from "lucide-react";
import { useMemo, useState } from "react";
import { format as formatSQL } from "sql-formatter";
import {
	type ActiveQueryRow,
	useActiveQueries,
	useCancelQuery,
	useTerminateQuery,
} from "../../api/database";
import { DataTable } from "../data-table";
import type { ColumnDef, SortState } from "../data-table/types";

function formatDuration(seconds: number): string {
	if (seconds == null) return "—";
	if (seconds < 60) return `${seconds.toFixed(0)}s`;
	if (seconds < 3600)
		return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
	return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function truncate(s: string, n = 80) {
	const t = s.trim().replace(/\s+/g, " ");
	return t.length > n ? `${t.slice(0, n)}…` : t;
}

function tryFormatSql(q: string): string {
	try {
		return formatSQL(q, {
			language: "postgresql",
			indentStyle: "tabularRight",
		});
	} catch {
		return q;
	}
}

function compare(a: unknown, b: unknown): number {
	if (a == null && b == null) return 0;
	if (a == null) return 1;
	if (b == null) return -1;
	if (typeof a === "number" && typeof b === "number") return a - b;
	return String(a).localeCompare(String(b));
}

type PendingAction = { kind: "cancel" | "terminate"; pid: number };

export function RunningQueries() {
	const [paused, setPaused] = useState(false);
	const [sort, setSort] = useState<SortState>({
		column: "duration",
		direction: "desc",
	});
	const [openQuery, setOpenQuery] = useState<ActiveQueryRow | null>(null);
	const [pending, setPending] = useState<PendingAction | null>(null);

	const { data, isLoading, refetch, isFetching } = useActiveQueries(
		paused ? false : 5000,
	);
	const cancel = useCancelQuery();
	const terminate = useTerminateQuery();

	const sorted = useMemo(() => {
		const rows = data ?? [];
		if (!sort) return rows;
		const col = sort.column as keyof ActiveQueryRow;
		const dir = sort.direction === "asc" ? 1 : -1;
		return [...rows].sort(
			(a, b) => compare(a[col] as unknown, b[col] as unknown) * dir,
		);
	}, [data, sort]);

	const onSortToggle = (column: string) => {
		setSort((prev) => {
			if (prev?.column !== column) return { column, direction: "desc" };
			if (prev.direction === "desc") return { column, direction: "asc" };
			return null;
		});
	};

	const columns: ColumnDef<ActiveQueryRow>[] = [
		{
			id: "pid",
			header: "PID",
			sortable: true,
			width: "w-[80px]",
			className: "tabular-nums",
			cell: (r) => r.pid,
		},
		{
			id: "usename",
			header: "User",
			sortable: true,
			width: "w-[120px]",
			cell: (r) => r.usename ?? "—",
		},
		{
			id: "duration",
			header: "Duration",
			sortable: true,
			width: "w-[100px]",
			className: "text-right tabular-nums",
			cell: (r) => (
				<span
					className={
						r.duration > 30
							? "text-text-warning-primary"
							: "text-text-secondary"
					}
				>
					{formatDuration(r.duration)}
				</span>
			),
		},
		{
			id: "wait_event",
			header: "Wait",
			sortable: true,
			width: "w-[160px]",
			cell: (r) =>
				r.wait_event ? `${r.wait_event_type ?? ""}:${r.wait_event}` : "—",
		},
		{
			id: "application_name",
			header: "App",
			sortable: true,
			width: "w-[140px]",
			cell: (r) => (
				<span className="font-mono truncate">
					{r.application_name?.trim() || "—"}
				</span>
			),
		},
		{
			id: "query",
			header: "Query",
			cell: (r) => (
				<button
					type="button"
					onClick={() => setOpenQuery(r)}
					className="text-left font-mono typo-body-xs text-text-secondary hover:text-text-primary cursor-pointer truncate w-full"
					title="Click to view full query"
				>
					{truncate(r.query)}
				</button>
			),
		},
		{
			id: "actions",
			header: "",
			width: "w-[100px]",
			cell: (r) => (
				<div className="flex items-center gap-1 justify-end">
					<Tooltip delayDuration={0}>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="small"
								onClick={() => setPending({ kind: "cancel", pid: r.pid })}
							>
								<X className="size-3.5" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Cancel query</TooltipContent>
					</Tooltip>
					<Tooltip delayDuration={0}>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="small"
								onClick={() => setPending({ kind: "terminate", pid: r.pid })}
							>
								<Square className="size-3.5" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Terminate backend</TooltipContent>
					</Tooltip>
				</div>
			),
		},
	];

	const onConfirm = () => {
		if (!pending) return;
		if (pending.kind === "cancel") cancel.mutate(pending.pid);
		else terminate.mutate(pending.pid);
		setPending(null);
	};

	return (
		<div className="h-full flex flex-col">
			<div className="flex items-center gap-2 px-4 py-3 border-b border-border-secondary">
				<h1 className="typo-h4 text-text-primary">Running queries</h1>
				<span className="typo-body-xs text-text-tertiary">
					{sorted.length} active
				</span>
				<div className="flex-1" />
				<Button
					variant="secondary"
					size="small"
					onClick={() => setPaused((p) => !p)}
				>
					{paused ? (
						<Play className="size-3.5" />
					) : (
						<Pause className="size-3.5" />
					)}
					{paused ? "Resume" : "Pause"}
				</Button>
				<Button
					variant="secondary"
					size="small"
					onClick={() => refetch()}
					disabled={isFetching}
				>
					<RefreshCw
						className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
					/>
					Refresh
				</Button>
			</div>
			<div className="flex-1 overflow-auto">
				<DataTable
					data={sorted}
					columns={columns}
					rowKey={(r) => String(r.pid)}
					loading={isLoading}
					sort={sort}
					onSortToggle={onSortToggle}
					emptyState={
						<div className="flex items-center justify-center h-full text-text-secondary">
							No active queries.
						</div>
					}
				/>
			</div>

			<Dialog open={!!openQuery} onOpenChange={(o) => !o && setOpenQuery(null)}>
				<DialogContent className="max-w-4xl">
					<DialogHeader>
						<DialogTitle>Query (PID {openQuery?.pid})</DialogTitle>
					</DialogHeader>
					{openQuery && (
						<div className="h-[60vh] overflow-auto">
							<CodeEditor
								currentValue={tryFormatSql(openQuery.query)}
								mode="sql"
								readOnly
							/>
						</div>
					)}
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!pending}
				onOpenChange={(o) => !o && setPending(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{pending?.kind === "cancel"
								? "Cancel query?"
								: "Terminate backend?"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{pending?.kind === "cancel"
								? `pg_cancel_backend(${pending?.pid}). Asks the backend to stop the running statement.`
								: `pg_terminate_backend(${pending?.pid}). Kills the entire connection — clients will see "terminating connection".`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Dismiss</AlertDialogCancel>
						<AlertDialogAction onClick={onConfirm}>
							{pending?.kind === "cancel" ? "Cancel query" : "Terminate"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
