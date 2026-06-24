import {
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Skeleton,
} from "@health-samurai/react-components";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { type PgTableRow, usePgTables } from "../../api/database";
import { createFuzzySearch } from "../../utils/fuzzy-search";
import { DataTable } from "../data-table";
import type { ColumnDef, SortState } from "../data-table/types";
import { EM_DASH, formatMinAgo, formatRows } from "./format";

// `public` always sorts first (the FHIR resource tables); other schemas
// (`aidbox_stat`, custom workspaces) follow alphabetically.
function compareSchema(a: string, b: string): number {
	if (a === b) return 0;
	if (a === "public") return -1;
	if (b === "public") return 1;
	return a.localeCompare(b);
}

function compare(a: unknown, b: unknown): number {
	if (a == null && b == null) return 0;
	if (a == null) return 1;
	if (b == null) return -1;
	if (typeof a === "number" && typeof b === "number") return a - b;
	return String(a).localeCompare(String(b));
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
	const [activeSchema, setActiveSchema] = useState<string | null>(null);

	// Load every table once; filtering happens client-side (fuzzy), so typing
	// doesn't round-trip to the server.
	const { data, isLoading } = usePgTables({
		limit: 5000,
		allSchemas: true,
	});

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

	const columns: ColumnDef<PgTableRow>[] = [
		{
			id: "table_schema",
			header: "Schema",
			sortable: true,
			minSize: 100,
			maxSize: 200,
			className: "font-mono",
			cell: (r) => r.table_schema,
		},
		{
			id: "table_name",
			header: "Table",
			sortable: true,
			minSize: 200,
			maxSize: 500,
			cell: (r) => (
				<Link
					to="/database/schema/$schema/$table"
					params={{ schema: r.table_schema, table: r.table_name }}
					className="font-mono text-text-link hover:underline"
				>
					{r.table_name}
				</Link>
			),
		},
		{
			id: "num_rows",
			header: "Rows",
			sortable: true,
			width: "w-[100px]",
			className: "text-right tabular-nums",
			reverseIcon: true,
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
			reverseIcon: true,
			cell: (r) => r.total,
		},
		{
			id: "index_size",
			header: "Index",
			headerTooltip: "Index storage size",
			sortable: true,
			width: "w-[100px]",
			className: "text-right tabular-nums",
			reverseIcon: true,
			cell: (r) => r.index,
		},
		{
			id: "index_part",
			header: "Index %",
			headerTooltip: "Index share of the table's total disk footprint.",
			sortable: true,
			width: "w-[90px]",
			className: "text-right tabular-nums",
			reverseIcon: true,
			cell: (r) => (r.index_part == null ? EM_DASH : `${r.index_part}%`),
		},
		{
			id: "toast_size",
			header: "Toast",
			headerTooltip:
				"TOAST = PG out-of-line storage for oversized field values.",
			sortable: true,
			width: "w-[100px]",
			className: "text-right tabular-nums",
			reverseIcon: true,
			cell: (r) => r.toast,
		},
		{
			id: "toast_part",
			header: "Toast %",
			headerTooltip: "TOAST share of the table's total disk footprint.",
			sortable: true,
			width: "w-[80px]",
			className: "text-right tabular-nums",
			reverseIcon: true,
			cell: (r) => (r.toast_part == null ? EM_DASH : `${r.toast_part}%`),
		},
		{
			id: "last_autovacuum",
			header: "Auto-vacuum",
			headerTooltip: "Time since last autovacuum.",
			sortable: true,
			width: "w-[120px]",
			cell: (r) => formatMinAgo(r.last_autovacuum),
		},
		{
			id: "last_vacuum",
			header: "Vacuum",
			headerTooltip: "Time since last manual VACUUM.",
			sortable: true,
			width: "w-[100px]",
			cell: (r) => formatMinAgo(r.last_vacuum),
		},
		{
			id: "last_autoanalyze",
			header: "Auto-analyze",
			headerTooltip: "Time since last autoanalyze.",
			sortable: true,
			width: "w-[120px]",
			cell: (r) => formatMinAgo(r.last_autoanalyze),
		},
		{
			id: "last_analyze",
			header: "Analyze",
			headerTooltip: "Time since last manual ANALYZE.",
			sortable: true,
			width: "w-[100px]",
			cell: (r) => formatMinAgo(r.last_analyze),
		},
	];

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
			<div className="px-4 py-3 border-b border-border-secondary">
				<div className="flex">
					<Select value={currentTab} onValueChange={setActiveSchema}>
						<SelectTrigger className="w-[150px] shrink-0 rounded-r-none border-r-0">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL_TAB}>All</SelectItem>
							{grouped.map(({ schema }) => (
								<SelectItem key={schema} value={schema}>
									{schema}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Input
						className="rounded-l-none"
						placeholder="Search tables"
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
					/>
				</div>
			</div>
			<div className="flex-1 overflow-auto">
				{isLoading ? (
					<div className="p-4 space-y-2">
						<Skeleton className="h-6 w-full" />
						<Skeleton className="h-6 w-full" />
						<Skeleton className="h-6 w-full" />
					</div>
				) : (
					<DataTable<PgTableRow>
						data={activeRows}
						columns={columns}
						rowKey={(r) => tableKey(r)}
						resizable
						zebra
						sort={sort}
						onSortToggle={onSortToggle}
						tableId="database-schema-tables"
						emptyState={
							<div className="flex items-center justify-center py-8 text-text-secondary">
								No tables found.
							</div>
						}
					/>
				)}
			</div>
		</div>
	);
}
