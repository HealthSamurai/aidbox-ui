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
	Skeleton,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { ChevronLeft, ChevronRight, Eye, Table2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format as formatSQL } from "sql-formatter";
import { useAidboxClient } from "../../AidboxClient";
import { useLocalStorage } from "../../hooks";
import type { SchemaMap } from "./utils";

// Types

type TableId = { schema: string; name: string };

type ColumnInfo = {
	column_name: string;
	data_type: string;
	udt_name: string;
	is_nullable: string;
};

type IndexInfo = {
	indexname: string;
	indexdef: string;
};

type TableDetails = {
	columns: ColumnInfo[];
	indexes: IndexInfo[];
	rowCount: number;
	tableSize: string;
	indexesSize: string;
};

// Styles

function cn(...inputs: (string | undefined | boolean | null)[]) {
	return inputs.filter(Boolean).join(" ");
}

const tableItem = cn(
	"flex",
	"items-center",
	"gap-2",
	"py-1.5",
	"px-2",
	"rounded",
	"cursor-pointer",
	"hover:bg-bg-secondary",
);

// Data fetching

export function psqlRequest(
	client: ReturnType<typeof useAidboxClient>,
	query: string,
) {
	return client
		.rawRequest({
			method: "POST",
			url: "/$psql",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query }),
		})
		.then(async (res) => {
			if (!res.response.ok) throw new Error(`HTTP ${res.response.status}`);
			const data = await res.response.json();
			const arr = Array.isArray(data) ? data : [data];
			return arr[0]?.result ?? [];
		});
}

export type { TableDetails };

export async function fetchTableDetails(
	client: ReturnType<typeof useAidboxClient>,
	schema: string,
	name: string,
): Promise<TableDetails> {
	const [columns, indexes, rowCountRows, sizeRows] = await Promise.all([
		psqlRequest(client, buildColumnsQuery(schema, name)),
		psqlRequest(client, buildIndexesQuery(schema, name)),
		psqlRequest(client, buildRowCountQuery(schema, name)),
		psqlRequest(client, buildSizeQuery(schema, name)),
	]);
	return {
		columns,
		indexes,
		rowCount: rowCountRows[0]?.row_count ?? -1,
		tableSize: sizeRows[0]?.table_size ?? "unknown",
		indexesSize: sizeRows[0]?.indexes_size ?? "unknown",
	};
}

function buildColumnsQuery(schema: string, table: string): string {
	const s = schema.replace(/'/g, "''");
	const t = table.replace(/'/g, "''");
	return `SELECT column_name, data_type, udt_name, is_nullable FROM information_schema.columns WHERE table_schema='${s}' AND table_name='${t}' ORDER BY ordinal_position`;
}

function buildIndexesQuery(schema: string, table: string): string {
	const s = schema.replace(/'/g, "''");
	const t = table.replace(/'/g, "''");
	return `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='${s}' AND tablename='${t}'`;
}

function buildRowCountQuery(schema: string, table: string): string {
	const s = schema.replace(/'/g, "''");
	const t = table.replace(/'/g, "''");
	return `SELECT reltuples::bigint as row_count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname='${t}' AND n.nspname='${s}'`;
}

function buildSizeQuery(schema: string, table: string): string {
	const s = schema.replace(/"/g, '""');
	const t = table.replace(/"/g, '""');
	return `SELECT pg_size_pretty(pg_table_size('"${s}"."${t}"')) AS table_size, pg_size_pretty(pg_indexes_size('"${s}"."${t}"')) AS indexes_size`;
}

function formatTableName(table: TableId): string {
	return table.schema === "public"
		? table.name
		: `${table.schema}.${table.name}`;
}

export function formatColumnType(col: ColumnInfo): string {
	if (col.data_type === "USER-DEFINED") return col.udt_name;
	if (col.data_type === "ARRAY") return `${col.udt_name.replace(/^_/, "")}[]`;
	return col.data_type;
}

export function extractIndexType(indexdef: string): string {
	const match = indexdef.match(/USING\s+(\w+)/i);
	return match?.[1] ?? "";
}

function formatIndexDef(indexdef: string): string {
	try {
		return formatSQL(indexdef, {
			language: "postgresql",
			indentStyle: "tabularRight",
		});
	} catch {
		return indexdef;
	}
}

function formatRowCount(count: number): string {
	if (count < 0) return "~0";
	if (count < 1000) return `~${count}`;
	if (count < 1_000_000) return `~${Math.round(count / 1000)}K`;
	return `~${(count / 1_000_000).toFixed(1)}M`;
}

// Tables list

function TablesListView({
	schemas,
	onSelect,
	isActive,
}: {
	schemas: SchemaMap;
	onSelect: (table: TableId) => void;
	isActive: boolean;
}) {
	const [search, setSearch] = useState("");
	const [expanded, setExpanded] = useLocalStorage<Record<string, boolean>>({
		key: "db-console-schema-expanded",
		defaultValue: {},
		getInitialValueInEffect: false,
	});
	const listRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isActive) {
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [isActive]);

	const allItems = useMemo(() => {
		const schemaKeys = Object.keys(schemas).sort((a, b) => {
			if (a === "public") return -1;
			if (b === "public") return 1;
			return a.localeCompare(b);
		});

		const items: {
			schema: string;
			name: string;
			type: "table" | "view";
			key: string;
		}[] = [];
		for (const schema of schemaKeys) {
			const entries = schemas[schema];
			if (!entries) continue;
			const sorted = [...entries].sort((a, b) => {
				const aSystem = a.name.startsWith("_");
				const bSystem = b.name.startsWith("_");
				if (aSystem !== bSystem) return aSystem ? 1 : -1;
				return a.name.localeCompare(b.name);
			});
			for (const entry of sorted) {
				items.push({
					schema,
					name: entry.name,
					type: entry.type,
					key: `${schema}.${entry.name}`,
				});
			}
		}
		return items;
	}, [schemas]);

	const filtered = useMemo(() => {
		if (!search) return allItems;
		const lower = search.toLowerCase();
		return allItems.filter((t) => t.key.toLowerCase().includes(lower));
	}, [allItems, search]);

	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		const list = listRef.current;
		if (!list) return;
		const buttons = Array.from(
			list.querySelectorAll<HTMLButtonElement>("button[data-table-item]"),
		);
		if (buttons.length === 0) return;
		const active = list.querySelector<HTMLButtonElement>(
			"button[data-table-item][data-active]",
		);

		if (e.key === "Enter") {
			if (active) active.click();
			return;
		}

		if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
		e.preventDefault();
		let idx = active ? buttons.indexOf(active) : -1;
		if (e.key === "ArrowDown") idx = Math.min(idx + 1, buttons.length - 1);
		else idx = Math.max(idx - 1, 0);
		if (active) {
			active.removeAttribute("data-active");
			active.classList.remove("bg-bg-secondary");
		}
		const next = buttons[idx];
		if (next) {
			next.setAttribute("data-active", "");
			next.classList.add("bg-bg-secondary");
			next.scrollIntoView({ block: "nearest" });
		}
	}, []);

	const handleSearchChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setSearch(e.target.value);
			if (listRef.current) listRef.current.scrollTop = 0;
		},
		[],
	);

	// Group filtered items by schema for display
	const groups = useMemo(() => {
		const map = new Map<string, typeof filtered>();
		for (const item of filtered) {
			let group = map.get(item.schema);
			if (!group) {
				group = [];
				map.set(item.schema, group);
			}
			group.push(item);
		}
		return map;
	}, [filtered]);

	return (
		<div className="h-full flex flex-col overflow-hidden">
			<div className="flex-none h-10 border-b px-3 flex items-center">
				<input
					ref={inputRef}
					value={search}
					onChange={handleSearchChange}
					onKeyDown={handleKeyDown}
					placeholder="Search tables..."
					className="w-full bg-transparent outline-none typo-body text-text-primary placeholder:text-text-tertiary"
				/>
			</div>
			<div ref={listRef} className="flex-1 min-h-0 overflow-auto pt-1">
				{filtered.length === 0 && (
					<div className="p-4 text-center typo-body-xs text-text-tertiary">
						No tables found.
					</div>
				)}
				{Array.from(groups).map(([schema, items]) => (
					<div key={schema} className="pl-1 pr-3">
						<button
							type="button"
							className="flex w-full items-center gap-1 pl-1 pt-3 pb-2 typo-label-xs text-text-tertiary uppercase cursor-pointer hover:text-text-secondary"
							onClick={() =>
								setExpanded((prev) => ({
									...prev,
									[schema]: !prev[schema],
								}))
							}
						>
							<ChevronRight
								className={`size-3 transition-transform duration-150 ${search || expanded[schema] ? "rotate-90" : ""}`}
							/>
							{schema}
						</button>
						{(search || expanded[schema]) &&
							items.map((item) => (
								<button
									type="button"
									key={item.key}
									data-table-item
									onClick={() =>
										onSelect({ schema: item.schema, name: item.name })
									}
									className={`${tableItem} w-full`}
								>
									{item.type === "view" ? (
										<Eye className="size-3.5 shrink-0 text-text-tertiary" />
									) : (
										<Table2 className="size-3.5 shrink-0 text-text-tertiary" />
									)}
									<span className="typo-code text-text-body truncate">
										{item.name}
									</span>
								</button>
							))}
					</div>
				))}
			</div>
		</div>
	);
}

// Index row

function IndexRow({
	index,
	onDrop,
}: {
	index: IndexInfo;
	onDrop: (indexname: string) => void;
}) {
	const [isAlertOpen, setIsAlertOpen] = useState(false);

	return (
		<>
			<Tooltip delayDuration={0}>
				<TooltipTrigger asChild>
					<div className="flex items-center justify-between px-4 py-1.5 border-b border-border-secondary last:border-b-0 group">
						<span className="typo-body-xs text-text-primary truncate">
							{index.indexname}
						</span>
						<div className="flex items-center gap-1 shrink-0 ml-2">
							<span className="typo-body-xs text-text-tertiary">
								{extractIndexType(index.indexdef)}
							</span>
							<Button
								variant="ghost"
								size="small"
								className="shrink-0 size-5! p-0! opacity-0 group-hover:opacity-100"
								onClick={(e) => {
									e.stopPropagation();
									setIsAlertOpen(true);
								}}
							>
								<X className="size-3 text-text-tertiary" />
							</Button>
						</div>
					</div>
				</TooltipTrigger>
				<TooltipContent
					side="right"
					align="start"
					sideOffset={12}
					className="max-w-none px-2 pt-1 pb-2 rounded text-text-primary bg-bg-primary border border-border-secondary"
				>
					<CodeEditor
						readOnly
						currentValue={formatIndexDef(index.indexdef)}
						mode="sql"
						foldGutter={false}
						lineNumbers={false}
					/>
				</TooltipContent>
			</Tooltip>
			<AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Drop index</AlertDialogTitle>
					</AlertDialogHeader>
					<AlertDialogDescription>
						Are you sure you want to drop index "{index.indexname}"? This action
						cannot be undone.
					</AlertDialogDescription>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => setIsAlertOpen(false)}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							variant="primary"
							danger
							onClick={() => {
								onDrop(index.indexname);
								setIsAlertOpen(false);
							}}
						>
							Drop index
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

// Table detail

function TableDetailView({
	table,
	onBack,
	onTableClick,
}: {
	table: TableId;
	onBack: () => void;
	onTableClick: (query: string) => void;
}) {
	const client = useAidboxClient();
	const [details, setDetails] = useState<TableDetails | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		setError(null);
		setDetails(null);

		fetchTableDetails(client, table.schema, table.name)
			.then((d) => {
				if (!cancelled) setDetails(d);
			})
			.catch((err) => {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : String(err));
				}
			});

		return () => {
			cancelled = true;
		};
	}, [client, table.schema, table.name]);

	const tableName = formatTableName(table);

	const handleDropIndex = useCallback(
		async (indexname: string) => {
			try {
				const escaped = indexname.replace(/'/g, "''");
				await psqlRequest(client, `DROP INDEX IF EXISTS "${escaped}"`);
				const d = await fetchTableDetails(client, table.schema, table.name);
				setDetails(d);
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			}
		},
		[client, table.schema, table.name],
	);

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center gap-1 h-10 px-2 border-b bg-bg-secondary shrink-0">
				<Button
					variant="ghost"
					size="small"
					onClick={onBack}
					className="shrink-0"
				>
					<ChevronLeft className="size-4" />
				</Button>
				<button
					type="button"
					className="typo-label text-text-primary truncate cursor-pointer hover:text-text-link"
					onClick={() => onTableClick(`select * from ${tableName}`)}
					title={`select * from ${tableName}`}
				>
					{tableName}
				</button>
			</div>

			{error && (
				<div className="p-4 text-center">
					<div className="typo-body-xs text-text-error-primary">{error}</div>
				</div>
			)}

			{!details && !error && (
				<div className="flex-1 min-h-0 overflow-auto">
					<DetailSection title="Columns">
						<div className="flex flex-col">
							{Array.from({ length: 5 }, (_, i) => (
								<div
									key={`sk${String(i)}`}
									className="flex items-center justify-between px-4 py-1.5 border-b border-border-secondary last:border-b-0"
								>
									<Skeleton className="h-3 w-24" />
									<Skeleton className="h-3 w-16" />
								</div>
							))}
						</div>
					</DetailSection>
					<DetailSection title="Indexes">
						<div className="flex flex-col">
							{Array.from({ length: 2 }, (_, i) => (
								<div
									key={`sk${String(i)}`}
									className="flex items-center justify-between px-4 py-1.5 border-b border-border-secondary last:border-b-0"
								>
									<Skeleton className="h-3 w-32" />
									<Skeleton className="h-3 w-12" />
								</div>
							))}
						</div>
					</DetailSection>
				</div>
			)}

			{details && (
				<div className="flex-1 min-h-0 overflow-auto">
					<DetailSection title="Rows">
						<div className="px-4 py-2">
							<span className="typo-body-xs text-text-primary">
								{formatRowCount(details.rowCount)}
							</span>
						</div>
					</DetailSection>

					<DetailSection title="Size">
						<div className="flex flex-col">
							<div className="flex items-center justify-between px-4 py-1.5 border-b border-border-secondary">
								<span className="typo-body-xs text-text-tertiary">
									Table data
								</span>
								<span className="typo-body-xs text-text-primary">
									{details.tableSize}
								</span>
							</div>
							<div className="flex items-center justify-between px-4 py-1.5">
								<span className="typo-body-xs text-text-tertiary">Indexes</span>
								<span className="typo-body-xs text-text-primary">
									{details.indexesSize}
								</span>
							</div>
						</div>
					</DetailSection>

					<DetailSection title="Columns">
						{details.columns.length > 0 ? (
							<div className="flex flex-col">
								{details.columns.map((col) => (
									<div
										key={col.column_name}
										className="flex items-center justify-between px-4 py-1.5 border-b border-border-secondary last:border-b-0"
									>
										<span className="typo-body-xs text-text-primary truncate">
											{col.column_name}
										</span>
										<span className="typo-body-xs text-text-tertiary shrink-0 ml-2">
											{formatColumnType(col)}
											{col.is_nullable === "YES" && ", null"}
										</span>
									</div>
								))}
							</div>
						) : (
							<div className="px-4 py-2 typo-body-xs text-text-disabled">
								No columns
							</div>
						)}
					</DetailSection>

					<DetailSection title="Indexes">
						{details.indexes.length > 0 ? (
							<div className="flex flex-col">
								{details.indexes.map((idx) => (
									<IndexRow
										key={idx.indexname}
										index={idx}
										onDrop={handleDropIndex}
									/>
								))}
							</div>
						) : (
							<div className="px-4 py-2 typo-body-xs text-text-disabled">
								No indexes
							</div>
						)}
					</DetailSection>
				</div>
			)}
		</div>
	);
}

function DetailSection({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<div className="border-b border-border-secondary">
			<div className="px-4 h-6 bg-bg-tertiary border-b border-border-secondary flex items-center">
				<span className="typo-label-xs text-text-tertiary uppercase">
					{title}
				</span>
			</div>
			{children}
		</div>
	);
}

// Main component

export function SqlTablesCommand({
	schemas,
	onTableClick,
	isActive,
}: {
	schemas: SchemaMap;
	onTableClick: (query: string) => void;
	isActive: boolean;
}) {
	const [selectedTable, setSelectedTable] = useLocalStorage<TableId | null>({
		key: "db-console-selected-table",
		defaultValue: null,
		getInitialValueInEffect: false,
	});

	useEffect(() => {
		if (!isActive) setSelectedTable(null);
	}, [isActive, setSelectedTable]);

	const handleBack = useCallback(
		() => setSelectedTable(null),
		[setSelectedTable],
	);

	if (Object.keys(schemas).length === 0) {
		return (
			<div className="h-full flex flex-col overflow-hidden">
				<div className="flex-none h-10 border-b px-3 flex items-center">
					<input
						disabled
						placeholder="Search tables..."
						className="w-full bg-transparent outline-none typo-body text-text-primary placeholder:text-text-tertiary"
					/>
				</div>
				<div className="flex flex-col pt-1 pl-1 pr-3">
					<div className="px-1 py-1">
						<Skeleton className="h-3 w-12" />
					</div>
					{Array.from({ length: 25 }, (_, i) => (
						<div
							key={`sk${String(i)}`}
							className="flex items-center gap-2 py-1.5 px-2"
						>
							<Skeleton className="size-3.5 shrink-0 rounded" />
							<Skeleton
								className="h-3.5 rounded"
								style={{ width: `${45 + ((i * 37) % 40)}%` }}
							/>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (selectedTable) {
		return (
			<TableDetailView
				table={selectedTable}
				onBack={handleBack}
				onTableClick={onTableClick}
			/>
		);
	}

	return (
		<TablesListView
			schemas={schemas}
			onSelect={setSelectedTable}
			isActive={isActive}
		/>
	);
}
