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
	Input,
	Skeleton,
} from "@health-samurai/react-components";
import { ChevronDown, ChevronRight, Database, RefreshCw } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
	type PgTableRow,
	type TableRef,
	useAnalyzeTable,
	usePgTable,
	usePgTables,
	useReindexTable,
	useVacuumTable,
} from "../../api/database";
import { createFuzzySearch } from "../../utils/fuzzy-search";
import type { ColumnDef, SortState } from "../data-table/types";

// Schemas worth surfacing — pg_catalog/information_schema/pgagent are filtered
// out server-side. `public` always sorts first (the FHIR resource tables);
// other schemas (`aidbox_stat`, custom workspaces) follow alphabetically.
function compareSchema(a: string, b: string): number {
	if (a === b) return 0;
	if (a === "public") return -1;
	if (b === "public") return 1;
	return a.localeCompare(b);
}

function formatRows(n: number): string {
	if (n == null) return "—";
	const v = Math.round(n);
	if (v < 1000) return String(v);
	if (v < 1_000_000) return `${(v / 1000).toFixed(1)}k`;
	if (v < 1_000_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
	return `${(v / 1_000_000_000).toFixed(1)}B`;
}

function formatMinAgo(min: number | null): string {
	if (min == null) return "—";
	if (min < 60) return `${min}m ago`;
	if (min < 24 * 60) return `${Math.floor(min / 60)}h ago`;
	return `${Math.floor(min / (24 * 60))}d ago`;
}

function compare(a: unknown, b: unknown): number {
	if (a == null && b == null) return 0;
	if (a == null) return 1;
	if (b == null) return -1;
	if (typeof a === "number" && typeof b === "number") return a - b;
	return String(a).localeCompare(String(b));
}

type PendingAction = {
	kind: "vacuum" | "analyze" | "reindex";
} & TableRef;

function TableDetails({
	ref,
	onAction,
}: {
	ref: TableRef;
	onAction: (kind: PendingAction["kind"], ref: TableRef) => void;
}) {
	const { data, isLoading } = usePgTable(ref);
	if (isLoading) {
		return (
			<div className="space-y-2 p-4">
				<Skeleton className="h-4 w-1/3" />
				<Skeleton className="h-4 w-1/2" />
				<Skeleton className="h-4 w-1/4" />
			</div>
		);
	}
	if (!data) return null;
	const t = data.table;
	return (
		<div className="p-4 bg-bg-secondary border-l-2 border-border-link">
			<div className="flex items-center gap-2 mb-4">
				<Button
					variant="secondary"
					size="small"
					onClick={() => onAction("vacuum", ref)}
				>
					Vacuum
				</Button>
				<Button
					variant="secondary"
					size="small"
					onClick={() => onAction("analyze", ref)}
				>
					Analyze
				</Button>
				<Button
					variant="secondary"
					size="small"
					onClick={() => onAction("reindex", ref)}
				>
					Reindex
				</Button>
			</div>
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
				<Stat label="Options" value={(t.options ?? []).join(", ") || "—"} />
			</div>
			{data.indexes.length > 0 && (
				<div>
					<div className="typo-label-sm text-text-primary mb-2">
						Indexes ({data.indexes.length})
					</div>
					<div className="border border-border-secondary rounded bg-bg-primary overflow-hidden">
						<table className="w-full typo-body-xs">
							<thead className="bg-bg-secondary">
								<tr className="text-left text-text-secondary">
									<th className="px-3 py-1.5 font-medium">Name</th>
									<th className="px-3 py-1.5 font-medium">Size</th>
									<th className="px-3 py-1.5 font-medium">Unique</th>
									<th className="px-3 py-1.5 font-medium text-right">Scans</th>
									<th className="px-3 py-1.5 font-medium text-right">Reads</th>
								</tr>
							</thead>
							<tbody>
								{data.indexes.map((idx) => (
									<tr
										key={idx.index_name}
										className="border-t border-border-secondary"
									>
										<td className="px-3 py-1.5 font-mono">{idx.index_name}</td>
										<td className="px-3 py-1.5">{idx.index_size}</td>
										<td className="px-3 py-1.5">
											{idx.unique === "Y" ? "yes" : "no"}
										</td>
										<td className="px-3 py-1.5 text-right tabular-nums">
											{idx.number_of_scans?.toLocaleString() ?? "—"}
										</td>
										<td className="px-3 py-1.5 text-right tabular-nums">
											{idx.tuples_read?.toLocaleString() ?? "—"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<div className="typo-label-xs text-text-tertiary uppercase">{label}</div>
			<div className="typo-body-sm text-text-primary tabular-nums">{value}</div>
		</div>
	);
}

function tableKey(r: { table_schema: string; table_name: string }): string {
	return `${r.table_schema}.${r.table_name}`;
}

export function SchemaExplorer() {
	const [filter, setFilter] = useState("");
	const [sort, setSort] = useState<SortState>({
		column: "total_size",
		direction: "desc",
	});
	const [expandedTable, setExpandedTable] = useState<string | null>(null);
	const [collapsedSchemas, setCollapsedSchemas] = useState<Set<string>>(
		new Set(),
	);
	const [pending, setPending] = useState<PendingAction | null>(null);

	// Load every table once; filtering happens client-side (fuzzy), so typing
	// doesn't round-trip to the server.
	const { data, isLoading, refetch, isFetching } = usePgTables({
		limit: 5000,
		allSchemas: true,
	});
	const vacuum = useVacuumTable();
	const analyze = useAnalyzeTable();
	const reindex = useReindexTable();

	const fuzzySearch = useMemo(
		() =>
			data
				? createFuzzySearch(data, {
						keys: [
							{ name: "table_name", weight: 2 },
							{ name: "table_schema", weight: 1 },
						],
						minMatchCharLength: 2,
						threshold: 0.2,
					})
				: () => [],
		[data],
	);

	const filtering = filter.trim().length > 0;

	const grouped = useMemo(() => {
		const rows = filtering ? fuzzySearch(filter) : (data ?? []);
		const bySchema = new Map<string, PgTableRow[]>();
		for (const row of rows) {
			const list = bySchema.get(row.table_schema) ?? [];
			list.push(row);
			bySchema.set(row.table_schema, list);
		}
		const schemas = [...bySchema.keys()].sort(compareSchema);
		const dir = sort?.direction === "asc" ? 1 : -1;
		const col = sort?.column as keyof PgTableRow | undefined;
		for (const s of schemas) {
			const list = bySchema.get(s);
			if (!list) continue;
			if (col) {
				list.sort(
					(a, b) => compare(a[col] as unknown, b[col] as unknown) * dir,
				);
			}
		}
		return schemas.map((schema) => ({
			schema,
			rows: bySchema.get(schema) ?? [],
		}));
	}, [data, filtering, fuzzySearch, filter, sort]);

	// First load: start with every schema collapsed.
	const initialized = useMemo(() => (data?.length ?? 0) > 0, [data]);
	useEffect(() => {
		if (!initialized || collapsedSchemas.size > 0) return;
		const all = new Set<string>();
		for (const row of data ?? []) all.add(row.table_schema);
		setCollapsedSchemas(all);
	}, [initialized, data, collapsedSchemas.size]);

	const toggleSchema = (schema: string) => {
		setCollapsedSchemas((prev) => {
			const next = new Set(prev);
			if (next.has(schema)) next.delete(schema);
			else next.add(schema);
			return next;
		});
	};

	const onSortToggle = (column: string) => {
		setSort((prev) => {
			if (prev?.column !== column) return { column, direction: "desc" };
			if (prev.direction === "desc") return { column, direction: "asc" };
			return null;
		});
	};

	const onAction = (kind: PendingAction["kind"], ref: TableRef) => {
		setPending({ kind, ...ref });
	};

	const columns: ColumnDef<PgTableRow>[] = [
		{
			id: "expand",
			header: "",
			width: "w-[32px]",
			cell: (r) =>
				expandedTable === tableKey(r) ? (
					<ChevronDown className="size-4 text-text-tertiary" />
				) : (
					<ChevronRight className="size-4 text-text-tertiary" />
				),
		},
		{
			id: "table_name",
			header: "Table",
			sortable: true,
			cell: (r) => <span className="font-mono">{r.table_name}</span>,
		},
		{
			id: "num_rows",
			header: "Rows",
			sortable: true,
			width: "w-[100px]",
			className: "text-right tabular-nums",
			cell: (r) => formatRows(r.num_rows),
		},
		{
			id: "total_size",
			header: "Total size",
			sortable: true,
			width: "w-[120px]",
			className: "text-right tabular-nums",
			cell: (r) => r.total,
		},
		{
			id: "index_size",
			header: "Index",
			headerTooltip: "Index storage size and share of total",
			sortable: true,
			width: "w-[120px]",
			className: "text-right tabular-nums",
			cell: (r) => `${r.index} (${r.index_part}%)`,
		},
		{
			id: "toast_size",
			header: "Toast",
			headerTooltip:
				"TOAST = PG out-of-line storage for oversized field values. Size and share of total.",
			sortable: true,
			width: "w-[110px]",
			className: "text-right tabular-nums",
			cell: (r) => `${r.toast} (${r.toast_part}%)`,
		},
		{
			id: "last_autovacuum",
			header: "Auto-vacuum",
			headerTooltip:
				"Time since last autovacuum (PG background worker reclaims dead-tuple space).",
			sortable: true,
			width: "w-[120px]",
			cell: (r) => formatMinAgo(r.last_autovacuum),
		},
		{
			id: "last_vacuum",
			header: "Vacuum",
			headerTooltip:
				"Time since last manual VACUUM. Reclaims dead-tuple space.",
			sortable: true,
			width: "w-[100px]",
			cell: (r) => formatMinAgo(r.last_vacuum),
		},
		{
			id: "last_autoanalyze",
			header: "Auto-analyze",
			headerTooltip:
				"Time since last autoanalyze (background ANALYZE; refreshes planner stats).",
			sortable: true,
			width: "w-[120px]",
			cell: (r) => formatMinAgo(r.last_autoanalyze),
		},
		{
			id: "last_analyze",
			header: "Analyze",
			headerTooltip: "Time since last manual ANALYZE. Refreshes planner stats.",
			sortable: true,
			width: "w-[100px]",
			cell: (r) => formatMinAgo(r.last_analyze),
		},
	];

	const actionTitle = (k: PendingAction["kind"] | undefined) =>
		k === "vacuum"
			? "Vacuum table?"
			: k === "analyze"
				? "Analyze table?"
				: "Reindex table?";

	const actionDesc = (p: PendingAction | null) => {
		if (!p) return "";
		const t = `"${p.schema}"."${p.table}"`;
		if (p.kind === "reindex")
			return `REINDEX TABLE ${t}. Rebuilds all indexes — locks the table for writes.`;
		if (p.kind === "vacuum")
			return `VACUUM ${t}. Reclaims dead-tuple space. Runs concurrently with reads/writes.`;
		return `ANALYZE ${t}. Refreshes planner stats.`;
	};

	const onConfirm = () => {
		if (!pending) return;
		const { kind, schema, table } = pending;
		const ref: TableRef = { schema, table };
		if (kind === "vacuum") vacuum.mutate(ref);
		else if (kind === "analyze") analyze.mutate(ref);
		else reindex.mutate(ref);
		setPending(null);
	};

	const colCount = columns.length;

	return (
		<div className="h-full flex flex-col">
			<div className="flex items-center gap-2 px-4 py-3 border-b border-border-secondary">
				<Input
					placeholder="Search"
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
					className="flex-1"
				/>
				<Button
					variant="primary"
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
				{isLoading ? (
					<div className="p-4 space-y-2">
						<Skeleton className="h-6 w-full" />
						<Skeleton className="h-6 w-full" />
						<Skeleton className="h-6 w-full" />
					</div>
				) : (
					<table className="w-full typo-code">
						<tbody>
							{grouped.map(({ schema, rows }) => {
								// While filtering, force every matching schema open so
								// results are visible without manual expansion.
								const collapsed = !filtering && collapsedSchemas.has(schema);
								return (
									<Fragment key={schema}>
										<tr
											className="bg-bg-secondary cursor-pointer hover:bg-bg-tertiary border-t border-border-secondary"
											onClick={() => toggleSchema(schema)}
										>
											<td colSpan={colCount} className="px-3 py-2">
												<div className="flex items-center gap-2">
													{collapsed ? (
														<ChevronRight className="size-4 text-text-tertiary" />
													) : (
														<ChevronDown className="size-4 text-text-tertiary" />
													)}
													<Database className="size-3.5 text-text-tertiary" />
													<span className="typo-label-sm font-semibold text-text-primary">
														{schema}
													</span>
													<span className="typo-body-xs text-text-tertiary">
														{rows.length}{" "}
														{rows.length === 1 ? "table" : "tables"}
													</span>
												</div>
											</td>
										</tr>
										{!collapsed && (
											<tr className="border-b border-border-secondary text-left text-text-secondary bg-bg-primary">
												{columns.map((c) => (
													<td
														key={c.id}
														title={
															typeof c.headerTooltip === "string"
																? c.headerTooltip
																: undefined
														}
														className={`px-3 py-2 typo-label-xs font-medium uppercase tracking-wide ${c.width ?? ""} ${c.className ?? ""} ${c.sortable ? "cursor-pointer select-none" : ""}`}
														onClick={
															c.sortable ? () => onSortToggle(c.id) : undefined
														}
													>
														{c.header}
														{c.sortable && sort?.column === c.id && (
															<span className="ml-1 text-text-tertiary">
																{sort.direction === "asc" ? "▲" : "▼"}
															</span>
														)}
													</td>
												))}
											</tr>
										)}
										{!collapsed &&
											rows.map((row, i) => {
												const key = tableKey(row);
												const isExpanded = expandedTable === key;
												return (
													<Fragment key={key}>
														<tr
															className={`border-b border-border-secondary cursor-pointer hover:bg-bg-secondary ${
																i % 2 === 1 ? "bg-bg-secondary/30" : ""
															}`}
															onClick={() =>
																setExpandedTable((cur) =>
																	cur === key ? null : key,
																)
															}
														>
															{columns.map((c) => (
																<td
																	key={c.id}
																	className={`px-3 py-1.5 ${c.className ?? ""}`}
																>
																	{c.cell(row)}
																</td>
															))}
														</tr>
														{isExpanded && (
															<tr>
																<td colSpan={colCount} className="p-0">
																	<TableDetails
																		ref={{
																			schema: row.table_schema,
																			table: row.table_name,
																		}}
																		onAction={onAction}
																	/>
																</td>
															</tr>
														)}
													</Fragment>
												);
											})}
									</Fragment>
								);
							})}
							{grouped.length === 0 && (
								<tr>
									<td
										colSpan={colCount}
										className="text-center py-8 text-text-secondary"
									>
										No tables found.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				)}
			</div>
			<AlertDialog
				open={!!pending}
				onOpenChange={(o) => !o && setPending(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{actionTitle(pending?.kind)}</AlertDialogTitle>
					</AlertDialogHeader>
					<AlertDialogDescription>{actionDesc(pending)}</AlertDialogDescription>
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
