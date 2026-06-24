import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Badge,
	Button,
	CodeEditor,
} from "@health-samurai/react-components";
import { type ReactNode, useState } from "react";
import {
	type PgIndexRow,
	type PgTableRow,
	type TableRef,
	useAnalyzeTable,
	usePgTable,
	useReindexTable,
	useVacuumTable,
} from "../../api/database";
import { DataTable } from "../data-table";
import type { ColumnDef } from "../data-table/types";
import { EM_DASH, formatMinAgo, formatRows, tryFormatSql } from "./format";

type ActionKind = "vacuum" | "analyze" | "reindex";

function buildMetrics(t: PgTableRow): { label: string; value: ReactNode }[] {
	const m: { label: string; value: ReactNode }[] = [];
	if (t.num_rows != null && t.num_rows >= 0)
		m.push({ label: "Rows", value: formatRows(t.num_rows) });
	if (t.total) m.push({ label: "Total size", value: t.total });
	if (t.index) m.push({ label: "Index size", value: t.index });
	if (t.index_part != null)
		m.push({ label: "Index %", value: `${t.index_part}%` });
	if (t.toast) m.push({ label: "Toast size", value: t.toast });
	if (t.toast_part != null)
		m.push({ label: "Toast %", value: `${t.toast_part}%` });
	if (t.last_autovacuum != null)
		m.push({ label: "Auto-vacuum", value: formatMinAgo(t.last_autovacuum) });
	if (t.last_vacuum != null)
		m.push({ label: "Vacuum", value: formatMinAgo(t.last_vacuum) });
	if (t.last_autoanalyze != null)
		m.push({ label: "Auto-analyze", value: formatMinAgo(t.last_autoanalyze) });
	if (t.last_analyze != null)
		m.push({ label: "Analyze", value: formatMinAgo(t.last_analyze) });
	return m;
}

function MetaBadge({ label, value }: { label: string; value: ReactNode }) {
	return (
		<Badge
			variant="outline"
			className="border-transparent gap-1.5 font-normal bg-neutral-100 text-neutral-600"
		>
			<span className="opacity-70">{label}</span>
			<span className="font-medium tabular-nums">{value}</span>
		</Badge>
	);
}

const INDEX_COLUMNS: ColumnDef<PgIndexRow>[] = [
	{
		id: "index_name",
		header: "Name",
		minSize: 200,
		maxSize: 600,
		cell: (r) => <span className="font-mono">{r.index_name}</span>,
	},
	{
		id: "index_type",
		header: "Type",
		maxSize: 120,
		cell: (r) => r.index_type ?? EM_DASH,
	},
	{
		id: "index_size",
		header: "Size",
		maxSize: 120,
		className: "text-right tabular-nums",
		cell: (r) => r.index_size,
	},
	{
		id: "unique",
		header: "Unique",
		maxSize: 100,
		cell: (r) => (r.unique === "Y" ? "yes" : "no"),
	},
	{
		id: "number_of_scans",
		header: "Scans",
		maxSize: 120,
		className: "text-right tabular-nums",
		cell: (r) => r.number_of_scans?.toLocaleString() ?? EM_DASH,
	},
	{
		id: "tuples_read",
		header: "Reads",
		maxSize: 120,
		className: "text-right tabular-nums",
		cell: (r) => r.tuples_read?.toLocaleString() ?? EM_DASH,
	},
];

export function TableDetail({
	schema,
	table,
}: {
	schema: string;
	table: string;
}) {
	const { data, isLoading } = usePgTable({ schema, table });
	const vacuum = useVacuumTable();
	const analyze = useAnalyzeTable();
	const reindex = useReindexTable();
	const [pending, setPending] = useState<ActionKind | null>(null);

	const actionTitle =
		pending === "vacuum"
			? "Vacuum table?"
			: pending === "analyze"
				? "Analyze table?"
				: "Reindex table?";

	const actionDesc = () => {
		const t = `"${schema}"."${table}"`;
		if (pending === "reindex")
			return `REINDEX TABLE ${t}. Rebuilds all indexes — locks the table for writes.`;
		if (pending === "vacuum")
			return `VACUUM ${t}. Reclaims dead-tuple space. Runs concurrently with reads/writes.`;
		return `ANALYZE ${t}. Refreshes planner stats.`;
	};

	const onConfirm = () => {
		if (!pending) return;
		const ref: TableRef = { schema, table };
		if (pending === "vacuum") vacuum.mutate(ref);
		else if (pending === "analyze") analyze.mutate(ref);
		else reindex.mutate(ref);
		setPending(null);
	};

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center gap-1 bg-bg-secondary flex-none h-10 border-b border-border-secondary px-4">
				<Button
					variant="ghost"
					size="small"
					className="px-2! hover:bg-bg-tertiary!"
					onClick={() => setPending("vacuum")}
				>
					Vacuum
				</Button>
				<Button
					variant="ghost"
					size="small"
					className="px-2! hover:bg-bg-tertiary!"
					onClick={() => setPending("analyze")}
				>
					Analyze
				</Button>
				<Button
					variant="ghost"
					size="small"
					className="px-2! hover:bg-bg-tertiary!"
					onClick={() => setPending("reindex")}
				>
					Reindex
				</Button>
			</div>

			<div className="flex flex-col px-4 py-3 border-b border-border-secondary">
				<h1
					className="text-lg font-semibold font-mono truncate"
					title={`${schema}.${table}`}
				>
					<span className="text-text-secondary">{schema}</span>
					<span className="text-text-tertiary">.</span>
					<span className="text-text-primary">{table}</span>
				</h1>
				{data && (
					<div className="mt-3 flex items-center gap-2 flex-wrap">
						{buildMetrics(data.table).map((m) => (
							<MetaBadge key={m.label} label={m.label} value={m.value} />
						))}
						{(data.table.options ?? []).map((opt) => (
							<MetaBadge key={opt} label="Option" value={opt} />
						))}
					</div>
				)}
			</div>

			<div className="flex-1 overflow-auto [&_tbody_tr:last-child]:border-b [&_tbody_tr:last-child]:border-border-secondary">
				{isLoading ? (
					<div className="flex items-center justify-center h-full text-text-secondary">
						Loading...
					</div>
				) : !data ? (
					<div className="flex items-center justify-center h-full text-text-secondary">
						Table not found.
					</div>
				) : (
					<div className="py-4">
						<div className="typo-label-xs text-text-tertiary uppercase mb-2 px-4">
							Indexes
						</div>
						{data.indexes.length === 0 ? (
							<div className="px-4 typo-body-sm text-text-secondary">
								No indexes.
							</div>
						) : (
							<DataTable<PgIndexRow>
								data={data.indexes}
								columns={INDEX_COLUMNS}
								rowKey={(r) => r.index_name}
								resizable
								zebra={false}
								tableId="table-indexes"
								renderExpandedRow={(idx) =>
									idx.index_def ? (
										<div className="h-64 border-t border-border-secondary">
											<CodeEditor
												readOnly
												mode="sql"
												currentValue={tryFormatSql(idx.index_def)}
											/>
										</div>
									) : (
										<div className="px-7 py-3 typo-body-sm text-text-secondary">
											No definition available.
										</div>
									)
								}
							/>
						)}
					</div>
				)}
			</div>

			<AlertDialog
				open={!!pending}
				onOpenChange={(o) => !o && setPending(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{actionTitle}</AlertDialogTitle>
					</AlertDialogHeader>
					<AlertDialogDescription>{actionDesc()}</AlertDialogDescription>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction variant="primary" onClick={onConfirm}>
							Run
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
