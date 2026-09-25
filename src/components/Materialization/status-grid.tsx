import * as HSComp from "@health-samurai/react-components";
import { Link } from "@tanstack/react-router";
import * as Lucide from "lucide-react";
import * as Humanize from "../../humanize";
import { DataTable } from "../data-table/data-table";
import type { ColumnDef } from "../data-table/types";
import type { MaterializationRow } from "./api";

const STATUS_CLASSES: Record<string, string> = {
	done: "border-transparent bg-utility-green/15 text-utility-green",
	error: "border-transparent bg-utility-red/15 text-utility-red",
	canceled: "border-transparent bg-utility-yellow/15 text-utility-yellow",
	"in-progress": "border-transparent bg-utility-blue/15 text-utility-blue",
};

function StatusBadge({ status }: { status?: string }) {
	if (!status)
		return <HSComp.Badge variant="outline">Never materialized</HSComp.Badge>;
	return (
		<HSComp.Badge variant="outline" className={STATUS_CLASSES[status] ?? ""}>
			{status}
		</HSComp.Badge>
	);
}

const materializationColumn: ColumnDef<MaterializationRow> = {
	id: "materialization",
	header: "Materialization",
	maxSize: 260,
	cell: (row) => (
		<Link
			to="/resource/$resourceType/edit/$id"
			params={{ resourceType: "AidboxMaterialization", id: row.id }}
			search={{ tab: "builder", mode: "json", builderTab: "form" }}
			className="text-text-link hover:underline"
			title={row.id}
		>
			{row.id}
		</Link>
	),
};

const objectColumns: ColumnDef<MaterializationRow>[] = [
	{
		id: "object",
		header: "Object",
		maxSize: 280,
		cell: (row) => (
			<span className="font-mono text-xs">{row.object || "—"}</span>
		),
	},
	{
		id: "objectType",
		header: "Type",
		maxSize: 160,
		cell: (row) => row.objectType,
	},
];

const stateColumns: ColumnDef<MaterializationRow>[] = [
	{
		id: "status",
		header: "Status",
		maxSize: 180,
		cell: (row) => <StatusBadge status={row.status} />,
	},
	{
		id: "targetVersion",
		header: "Ran for version",
		maxSize: 160,
		cell: (row) => row.targetVersion ?? "—",
	},
	{
		id: "sqlHash",
		header: "SQL hash",
		maxSize: 160,
		cell: (row) => (
			<span className="font-mono text-xs" title={row.sqlHash}>
				{row.sqlHash ? row.sqlHash.slice(0, 12) : "—"}
			</span>
		),
	},
	{
		id: "lastUpdated",
		header: "LastUpdated",
		defaultSize: 260,
		maxSize: 600,
		// Raw instant, as the resource browser and the rest of the UI show it.
		cell: (row) =>
			Humanize.humanizeValue("lastUpdated", row.lastUpdated, {}) ?? "—",
	},
];

/** One row per Materialization: which resources exist and where each stands. */
export const materializationColumns: ColumnDef<MaterializationRow>[] = [
	materializationColumn,
	...objectColumns,
	...stateColumns,
];

/** One row per run of a single Materialization; its identity is already known. */
export const runColumns: ColumnDef<MaterializationRow>[] = stateColumns;

export function MaterializationStatusGrid({
	rows,
	columns,
	loading,
	error,
	onRefresh,
	isRefreshing,
	emptyState,
	title,
	emptyLabel,
}: {
	rows: MaterializationRow[];
	columns: ColumnDef<MaterializationRow>[];
	/** Shown instead of the table; takes precedence over `emptyState`, which
	    would otherwise claim nothing exists when the search merely failed. */
	error?: unknown;
	loading?: boolean;
	onRefresh?: () => void;
	isRefreshing?: boolean;
	/** Shown instead of the table when there is nothing to list. */
	emptyState?: React.ReactNode;
	title?: string;
	emptyLabel?: string;
}) {
	return (
		<div className="flex flex-col h-full min-h-0">
			{(title || onRefresh) && (
				<div className="flex items-center justify-between bg-bg-secondary flex-none h-10 border-b px-4">
					<span className="typo-label text-text-secondary">{title}</span>
					{onRefresh && (
						<HSComp.Button
							variant="ghost"
							size="small"
							className="px-0!"
							disabled={isRefreshing}
							onClick={onRefresh}
						>
							<Lucide.RefreshCwIcon className="w-4 h-4" />
							Refresh
						</HSComp.Button>
					)}
				</div>
			)}
			<div className="flex-1 min-h-0 overflow-auto">
				{error ? (
					<div className="flex items-center justify-center h-full text-text-secondary">
						<div className="text-center px-6">
							<div className="text-lg mb-2">
								Could not load materializations
							</div>
							<div className="text-sm text-text-error-primary">
								{error instanceof Error ? error.message : String(error)}
							</div>
						</div>
					</div>
				) : !loading && rows.length === 0 && emptyState ? (
					emptyState
				) : (
					<DataTable<MaterializationRow>
						data={rows}
						columns={columns}
						rowKey={(row) => row.key}
						loading={loading}
						resizable
						tableId="materialization-statuses"
						emptyState={
							<div className="flex items-center justify-center h-full text-text-secondary">
								{emptyLabel ?? "Nothing to show"}
							</div>
						}
					/>
				)}
			</div>
		</div>
	);
}
