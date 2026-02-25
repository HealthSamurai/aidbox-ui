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
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { ChevronLeft, Loader2, TableIcon, X } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { format as formatSQL } from "sql-formatter";
import { useAidboxClient } from "../../AidboxClient";
import { useLocalStorage } from "../../hooks";

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
};

// Styles

function cn(...inputs: (string | undefined | boolean | null)[]) {
	return inputs.filter(Boolean).join(" ");
}

const commandContainer = cn(
	"h-full",
	"flex",
	"flex-col",
	"overflow-hidden",
	"[&_[cmdk-input-wrapper]]:flex-none",
);
const commandList = cn("flex-1", "min-h-0", "max-h-none!", "p-0");

const tableItem = cn(
	"flex",
	"items-center",
	"gap-2",
	"my-1",
	"py-2",
	"cursor-pointer",
	"hover:bg-bg-secondary",
	"data-[selected=true]:bg-bg-secondary",
);

// Data fetching

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

function psqlRequest(
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

function formatTableName(table: TableId): string {
	return table.schema === "public"
		? table.name
		: `${table.schema}.${table.name}`;
}

function formatColumnType(col: ColumnInfo): string {
	if (col.data_type === "USER-DEFINED") return col.udt_name;
	if (col.data_type === "ARRAY") return `${col.udt_name.replace(/^_/, "")}[]`;
	return col.data_type;
}

function extractIndexType(indexdef: string): string {
	const match = indexdef.match(/USING\s+(\w+)/i);
	return match?.[1] ?? "";
}

function formatIndexDef(indexdef: string): string {
	try {
		return formatSQL(indexdef, { language: "postgresql" });
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
}: {
	schemas: Record<string, string[]>;
	onSelect: (table: TableId) => void;
}) {
	const listRef = useRef<HTMLDivElement>(null);

	const resetScroll = useCallback(() => {
		requestAnimationFrame(() => {
			if (listRef.current) listRef.current.scrollTop = 0;
		});
	}, []);

	const schemaKeys = Object.keys(schemas).sort((a, b) => {
		if (a === "public") return -1;
		if (b === "public") return 1;
		return a.localeCompare(b);
	});

	const sortTables = (tables: string[]) =>
		[...tables].sort((a, b) => {
			const aSystem = a.startsWith("_");
			const bSystem = b.startsWith("_");
			if (aSystem !== bSystem) return aSystem ? 1 : -1;
			return a.localeCompare(b);
		});

	return (
		<Command
			className={commandContainer}
			filter={(value, search) => (value.includes(search.toLowerCase()) ? 1 : 0)}
		>
			<CommandInput
				placeholder="Search tables..."
				onValueChange={resetScroll}
			/>
			<CommandList ref={listRef} className={commandList}>
				<CommandEmpty>No tables found.</CommandEmpty>
				{schemaKeys.map((schema) => {
					const tables = schemas[schema];
					if (!tables || tables.length === 0) return null;
					const sorted = sortTables(tables);

					return (
						<CommandGroup key={schema} heading={schema}>
							{sorted.map((table) => (
								<CommandItem
									key={`${schema}.${table}`}
									value={`${schema}.${table}`}
									onSelect={() => onSelect({ schema, name: table })}
									className={tableItem}
								>
									<TableIcon className="size-3.5 text-text-tertiary shrink-0" />
									<span className="typo-body-xs leading-4! text-text-secondary truncate">
										{table}
									</span>
								</CommandItem>
							))}
						</CommandGroup>
					);
				})}
			</CommandList>
		</Command>
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
				<TooltipContent side="right" className="max-w-md p-0">
					<pre className="typo-body-xs font-mono whitespace-pre-wrap p-2">
						{formatIndexDef(index.indexdef)}
					</pre>
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
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		setError(null);
		setDetails(null);

		Promise.all([
			psqlRequest(client, buildColumnsQuery(table.schema, table.name)),
			psqlRequest(client, buildIndexesQuery(table.schema, table.name)),
			psqlRequest(client, buildRowCountQuery(table.schema, table.name)),
		])
			.then(([columns, indexes, rowCountRows]) => {
				if (cancelled) return;
				setDetails({
					columns,
					indexes,
					rowCount: rowCountRows[0]?.row_count ?? -1,
				});
			})
			.catch((err) => {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : String(err));
				}
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
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
				// Refresh details
				const [columns, indexes, rowCountRows] = await Promise.all([
					psqlRequest(client, buildColumnsQuery(table.schema, table.name)),
					psqlRequest(client, buildIndexesQuery(table.schema, table.name)),
					psqlRequest(client, buildRowCountQuery(table.schema, table.name)),
				]);
				setDetails({
					columns,
					indexes,
					rowCount: rowCountRows[0]?.row_count ?? -1,
				});
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

			{isLoading && (
				<div className="flex items-center justify-center flex-1 text-text-secondary gap-2">
					<Loader2 className="animate-spin size-4" />
					<span className="typo-body-xs">Loading...</span>
				</div>
			)}

			{error && (
				<div className="p-4 text-center">
					<div className="typo-body-xs text-text-error-primary">{error}</div>
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
				<span className="typo-label-xs text-text-tertiary">{title}</span>
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
	schemas: Record<string, string[]>;
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
			<div className="flex items-center justify-center h-full">
				<div className="flex items-center gap-2 text-text-secondary">
					<Loader2 className="animate-spin size-4" />
					<span className="typo-body-xs">Loading tables...</span>
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

	return <TablesListView schemas={schemas} onSelect={setSelectedTable} />;
}
