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
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
	Input,
	Skeleton,
	Tabs,
	TabsList,
	TabsTrigger,
} from "@health-samurai/react-components";
import {
	ArrowDown,
	ArrowUp,
	ChevronDown,
	ChevronRight,
	Search,
} from "lucide-react";
import { Fragment, type ReactNode, useEffect, useMemo, useState } from "react";
import { format as formatSQL } from "sql-formatter";
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

// `public` always sorts first (the FHIR resource tables); other schemas
// (`aidbox_stat`, custom workspaces) follow alphabetically.
function compareSchema(a: string, b: string): number {
	if (a === b) return 0;
	if (a === "public") return -1;
	if (b === "public") return 1;
	return a.localeCompare(b);
}

// Dim placeholder for missing values — pg's `reltuples` returns -1 for
// never-analyzed tables, `last_(auto)vacuum` is null until pg first runs.
const EM_DASH = <span className="text-text-tertiary">—</span>;

function formatRows(n: number): ReactNode {
	if (n == null || n < 0) return EM_DASH;
	const v = Math.round(n);
	if (v < 1000) return String(v);
	if (v < 1_000_000) return `${(v / 1000).toFixed(1)}k`;
	if (v < 1_000_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
	return `${(v / 1_000_000_000).toFixed(1)}B`;
}

function formatMinAgo(min: number | null): ReactNode {
	if (min == null) return EM_DASH;
	if (min < 60) return `${min}m ago`;
	if (min < 24 * 60) return `${Math.floor(min / 60)}h ago`;
	return `${Math.floor(min / (24 * 60))}d ago`;
}

function tryFormatSql(sql: string): string {
	try {
		// `expressionWidth` is sql-formatter's wrap target: long expressions
		// split onto new lines once they exceed this character count. 80 fits
		// the 640px HoverCard width comfortably in `typo-code`.
		const formatted = formatSQL(sql, {
			language: "postgresql",
			expressionWidth: 80,
		});
		// sql-formatter keeps the `CREATE INDEX <name> ON <table> USING <am>
		// (<cols>)` preamble on a single line — easily 100+ chars for hashed
		// FHIR index names. Break before `ON` / `USING` so the popover doesn't
		// scroll horizontally for the common case.
		return formatted.replace(
			/^(CREATE(?:\s+UNIQUE)?\s+INDEX\s+\S+)\s+ON\s+(\S+)\s+USING\s+/im,
			"$1\n  ON $2\n  USING ",
		);
	} catch {
		return sql;
	}
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
		<div className="py-4 pl-3 pr-4 bg-bg-secondary">
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
					<div className="typo-label-xs text-text-tertiary uppercase mb-2">
						Indexes ({data.indexes.length})
					</div>
					<div className="border border-border-secondary rounded bg-bg-primary overflow-hidden">
						{/* table-fixed + colgroup keeps column widths consistent across
						    different tables — auto layout would otherwise reflow widths
						    based on per-table index-name length. */}
						<table className="w-full table-fixed typo-body-sm">
							<colgroup>
								<col />
								<col className="w-[80px]" />
								<col className="w-[120px]" />
								<col className="w-[80px]" />
								<col className="w-[100px]" />
								<col className="w-[100px]" />
							</colgroup>
							<thead className="bg-bg-secondary">
								<tr className="text-left text-text-secondary">
									<th className="px-3 py-1.5">Name</th>
									<th className="px-3 py-1.5">Type</th>
									<th className="px-3 py-1.5 text-right">Size</th>
									<th className="px-3 py-1.5">Unique</th>
									<th className="px-3 py-1.5 text-right">Scans</th>
									<th className="px-3 py-1.5 text-right">Reads</th>
								</tr>
							</thead>
							<tbody>
								{data.indexes.map((idx) => (
									<tr
										key={idx.index_name}
										className="border-t border-border-secondary"
									>
										<td className="px-3 py-1.5 font-mono truncate">
											{idx.index_def ? (
												<HoverCard openDelay={200} closeDelay={100}>
													<HoverCardTrigger asChild>
														<span className="cursor-help">
															{idx.index_name}
														</span>
													</HoverCardTrigger>
													<HoverCardContent
														side="bottom"
														align="start"
														sideOffset={4}
														className="w-[640px] p-0 overflow-hidden"
													>
														<CodeEditor
															readOnly
															currentValue={tryFormatSql(idx.index_def)}
															mode="sql"
															foldGutter={false}
															lineNumbers={false}
														/>
													</HoverCardContent>
												</HoverCard>
											) : (
												idx.index_name
											)}
										</td>
										<td className="px-3 py-1.5">{idx.index_type ?? EM_DASH}</td>
										<td className="px-3 py-1.5 text-right tabular-nums">
											{idx.index_size}
										</td>
										<td className="px-3 py-1.5">
											{idx.unique === "Y" ? "yes" : "no"}
										</td>
										<td className="px-3 py-1.5 text-right tabular-nums">
											{idx.number_of_scans?.toLocaleString() ?? EM_DASH}
										</td>
										<td className="px-3 py-1.5 text-right tabular-nums">
											{idx.tuples_read?.toLocaleString() ?? EM_DASH}
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
	// Label is flush to the section indent (matching the "Indexes (N)" header
	// above); the value is shifted by 13px (indexes-table outer border + td
	// px-3) so it lines up with the index-name column.
	return (
		<div>
			<div className="typo-label-xs text-text-tertiary uppercase">{label}</div>
			<div className="typo-body-sm text-text-primary tabular-nums pl-[13px]">
				{value}
			</div>
		</div>
	);
}

function tableKey(r: { table_schema: string; table_name: string }): string {
	return `${r.table_schema}.${r.table_name}`;
}

// Sentinel for the "All" tab — collapses every schema into one flat list.
const ALL_TAB = "__all__";

export function SchemaExplorer() {
	const [filter, setFilter] = useState("");
	const [sort, setSort] = useState<SortState>({
		column: "total_size",
		direction: "desc",
	});
	const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
	const [activeSchema, setActiveSchema] = useState<string | null>(null);
	const [pending, setPending] = useState<PendingAction | null>(null);

	// Load every table once; filtering happens client-side (fuzzy), so typing
	// doesn't round-trip to the server.
	const { data, isLoading } = usePgTables({
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
		// Tabs (schema list) always come from the unfiltered data so they stay
		// visible during a search; only the per-schema row list narrows down.
		const allSchemas = new Set<string>();
		for (const row of data ?? []) allSchemas.add(row.table_schema);
		const rows = filtering ? fuzzySearch(filter) : (data ?? []);
		const bySchema = new Map<string, PgTableRow[]>();
		for (const row of rows) {
			const list = bySchema.get(row.table_schema) ?? [];
			list.push(row);
			bySchema.set(row.table_schema, list);
		}
		const schemas = [...allSchemas].sort(compareSchema);
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

	// "All" is the default tab on first load. We never auto-switch away from
	// the user's selected tab mid-search even if it has zero matches — the
	// empty pane is the honest answer.
	useEffect(() => {
		if (grouped.length === 0 || activeSchema !== null) return;
		setActiveSchema(ALL_TAB);
	}, [grouped, activeSchema]);

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
				expandedTables.has(tableKey(r)) ? (
					<ChevronDown className="size-4 text-text-tertiary" />
				) : (
					<ChevronRight className="size-4 text-text-tertiary" />
				),
		},
		{
			id: "table_name",
			header: "Table",
			sortable: true,
			cell: (r) => (
				<span className="font-mono">
					<span className="font-[550]">{r.table_schema}</span>
					<span className="text-text-tertiary">.</span>
					{r.table_name}
				</span>
			),
		},
		{
			id: "num_rows",
			header: "Rows",
			sortable: true,
			width: "w-[100px]",
			className: "text-right tabular-nums",
			// Show the full count on hover — the displayed value is abbreviated
			// (`73.6k` vs `73,631`) and pg's `reltuples` is an estimate, but the
			// exact estimate is still more useful than the rounded display.
			cell: (r) =>
				r.num_rows == null || r.num_rows < 0 ? (
					formatRows(r.num_rows)
				) : (
					<span title={`${Math.round(r.num_rows).toLocaleString()} rows`}>
						{formatRows(r.num_rows)}
					</span>
				),
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
	// Tabs `value` falls back to "All" before the effect populates
	// `activeSchema`; mirror that here so the first render shows rows.
	const currentTab = activeSchema ?? ALL_TAB;
	const allRows = useMemo(() => {
		const flat = grouped.flatMap((g) => g.rows);
		const dir = sort?.direction === "asc" ? 1 : -1;
		const col = sort?.column as keyof PgTableRow | undefined;
		if (!col) return flat;
		return [...flat].sort(
			(a, b) => compare(a[col] as unknown, b[col] as unknown) * dir,
		);
	}, [grouped, sort]);
	const activeRows =
		currentTab === ALL_TAB
			? allRows
			: (grouped.find((g) => g.schema === currentTab)?.rows ?? []);

	return (
		<div className="h-full flex flex-col">
			<div className="flex items-center gap-2 px-4 py-3 border-b border-border-secondary">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-tertiary pointer-events-none" />
					<Input
						placeholder="Search"
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
						className="pl-9"
					/>
				</div>
			</div>
			{grouped.length > 0 && (
				<Tabs
					value={currentTab}
					onValueChange={(v) => {
						setActiveSchema(v);
						setExpandedTables(new Set());
					}}
					// HSComp's Tabs base style is `h-full flex-col`; inside our flex-col
					// wrapper that grabs all remaining height and squeezes the table
					// below to zero. Pin the tab row to its content height.
					className="h-auto! flex-none! border-b border-border-secondary"
				>
					{/* Indent the trigger row so the first tab's text lines up with
					    the table-name column text below. */}
					<TabsList className="pl-10">
						<TabsTrigger value={ALL_TAB}>
							All
							<span className="ml-1.5 inline-block min-w-[5ch] text-left typo-body-xs text-text-tertiary">
								({allRows.length})
							</span>
						</TabsTrigger>
						{grouped.map(({ schema, rows }) => (
							<TabsTrigger key={schema} value={schema}>
								{schema}
								<span className="ml-1.5 inline-block min-w-[5ch] text-left typo-body-xs text-text-tertiary">
									({rows.length})
								</span>
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			)}
			<div className="flex-1 overflow-auto">
				{isLoading ? (
					<div className="p-4 space-y-2">
						<Skeleton className="h-6 w-full" />
						<Skeleton className="h-6 w-full" />
						<Skeleton className="h-6 w-full" />
					</div>
				) : (
					// `border-separate` keeps the sticky thead's `border-b` painted —
					// with the default collapse mode the bottom border merges with
					// the next row and gets clipped under the sticky offset.
					<table className="w-full typo-code border-separate border-spacing-0">
						<thead className="sticky top-0 bg-bg-primary z-10">
							<tr className="text-left text-text-secondary">
								{columns.map((c) => (
									<th
										key={c.id}
										title={
											typeof c.headerTooltip === "string"
												? c.headerTooltip
												: undefined
										}
										// `border-b` on a sticky `<tr>` doesn't always paint in
										// Chrome (the row's border gets clipped by the sticky
										// box). Put it on each `<th>` instead so the line is
										// visible across the whole header.
										className={`px-3 py-2 whitespace-nowrap typo-label-xs font-medium uppercase tracking-wide border-b border-border-secondary ${c.width ?? ""} ${c.className ?? ""} ${c.sortable ? "cursor-pointer select-none" : ""}`}
										onClick={c.sortable ? () => onSortToggle(c.id) : undefined}
									>
										<span className="inline-flex items-center gap-1">
											{c.header}
											{c.sortable &&
												sort?.column === c.id &&
												(sort.direction === "asc" ? (
													<ArrowUp className="size-3 text-text-tertiary" />
												) : (
													<ArrowDown className="size-3 text-text-tertiary" />
												))}
										</span>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{activeRows.map((row) => {
								const key = tableKey(row);
								const isExpanded = expandedTables.has(key);
								return (
									<Fragment key={key}>
										<tr
											className="h-[38px] border-b border-border-secondary cursor-pointer hover:bg-bg-secondary"
											onClick={() =>
												setExpandedTables((prev) => {
													const next = new Set(prev);
													if (next.has(key)) next.delete(key);
													else next.add(key);
													return next;
												})
											}
										>
											{columns.map((c) => (
												<td
													key={c.id}
													className={`px-3 whitespace-nowrap ${c.className ?? ""}`}
												>
													{c.cell(row)}
												</td>
											))}
										</tr>
										{isExpanded && (
											<tr className="bg-bg-secondary">
												{/* Skip the expand column so the details panel
													starts at the Table column boundary; an extra
													pl-3 inside the panel lines its content up with
													the table-name text (matching the cell's px-3). */}
												<td className="p-0" />
												<td colSpan={colCount - 1} className="p-0">
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
							{activeRows.length === 0 && (
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
