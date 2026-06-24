import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	CodeEditor,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@health-samurai/react-components";
import { EllipsisVertical } from "lucide-react";
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
	const [sort, setSort] = useState<SortState>({
		column: "duration",
		direction: "desc",
	});
	const [openQuery, setOpenQuery] = useState<ActiveQueryRow | null>(null);
	const [pending, setPending] = useState<PendingAction | null>(null);

	const { data, isLoading } = useActiveQueries(5000);
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
			id: "duration",
			header: "Duration",
			sortable: true,
			reverseIcon: true,
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
			id: "pid",
			header: "PID",
			sortable: true,
			reverseIcon: true,
			width: "w-[80px]",
			className: "text-right tabular-nums",
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
			grow: true,
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
			maxSize: 56,
			cell: (r) => (
				<div className="flex justify-end">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								aria-label="Query actions"
								className="size-7 flex items-center justify-center rounded hover:bg-bg-tertiary text-text-secondary"
							>
								<EllipsisVertical className="size-4" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								className="justify-start!"
								variant="destructive"
								onSelect={() => setPending({ kind: "cancel", pid: r.pid })}
							>
								Cancel
							</DropdownMenuItem>
							<DropdownMenuItem
								className="justify-start!"
								variant="destructive"
								onSelect={() => setPending({ kind: "terminate", pid: r.pid })}
							>
								Terminate
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
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
			<div className="flex-1 overflow-auto">
				<DataTable
					data={sorted}
					columns={columns}
					rowKey={(r) => String(r.pid)}
					loading={isLoading}
					resizable
					tableId="database-running-queries"
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
					</AlertDialogHeader>
					<AlertDialogDescription>
						{pending?.kind === "cancel"
							? `pg_cancel_backend(${pending?.pid}). Asks the backend to stop the running statement.`
							: `pg_terminate_backend(${pending?.pid}). Kills the entire connection — clients will see "terminating connection".`}
					</AlertDialogDescription>
					<AlertDialogFooter>
						<AlertDialogCancel>Dismiss</AlertDialogCancel>
						<AlertDialogAction variant="primary" danger onClick={onConfirm}>
							{pending?.kind === "cancel" ? "Cancel query" : "Terminate"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
