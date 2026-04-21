import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import {
	Check,
	ChevronDown,
	Download,
	Loader2,
	Maximize2,
	Minimize2,
} from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import type { QueryResultItem } from "../../webmcp/db-console-context";
import { LIMIT_PRESETS, TIMEOUT_PRESETS } from "./utils";

// ── JSON highlighting ──

function tryParseJson(value: string): string | null {
	try {
		const parsed = JSON.parse(value);
		if (typeof parsed === "object" && parsed !== null) {
			return JSON.stringify(parsed, null, 2);
		}
	} catch {
		/* not JSON */
	}
	return null;
}

const JSON_TOKEN_RE =
	/("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

const JSON_COLORS = {
	key: "#EA4A35",
	string: "#405CBF",
	keyword: "#569cd6",
	number: "#00A984",
};

function highlightJson(json: string): React.ReactNode[] {
	const parts: React.ReactNode[] = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null = null;

	while (true) {
		match = JSON_TOKEN_RE.exec(json);
		if (!match) break;

		if (match.index > lastIndex) {
			parts.push(json.slice(lastIndex, match.index));
		}

		let color: string;
		if (match[1]) color = JSON_COLORS.key;
		else if (match[2]) color = JSON_COLORS.string;
		else if (match[3]) color = JSON_COLORS.keyword;
		else color = JSON_COLORS.number;

		parts.push(
			<span key={match.index} style={{ color }}>
				{match[0]}
			</span>,
		);
		lastIndex = match.index + match[0].length;
	}

	if (lastIndex < json.length) {
		parts.push(json.slice(lastIndex));
	}

	return parts;
}

// ── Cell rendering ──

function JsonCellEditor({ json }: { json: string }) {
	return (
		<pre className="typo-code m-0 whitespace-pre">{highlightJson(json)}</pre>
	);
}

const CellValue = ({ value }: { value: unknown }) => {
	if (value === null || value === undefined) {
		return (
			<div className="sticky top-10 typo-code">
				<span style={{ color: "#569cd6" }}>null</span>
			</div>
		);
	}
	if (typeof value === "object") {
		return <JsonCellEditor json={JSON.stringify(value, null, 2)} />;
	}
	if (typeof value === "string") {
		const json = tryParseJson(value);
		if (json !== null) {
			return <JsonCellEditor json={json} />;
		}
		return (
			<div className="sticky top-10 typo-code">
				<span style={{ color: "#405CBF" }}>{value}</span>
			</div>
		);
	}
	if (typeof value === "boolean") {
		return (
			<div className="sticky top-10 typo-code">
				<span style={{ color: "#569cd6" }}>{String(value)}</span>
			</div>
		);
	}
	if (typeof value === "number") {
		return (
			<div className="sticky top-10 typo-code">
				<span style={{ color: "#00A984" }}>{value}</span>
			</div>
		);
	}
	return (
		<div className="sticky top-10 typo-code">
			<span className="text-text-primary">{String(value)}</span>
		</div>
	);
};

// ── Data export utilities ──

const extractColumns = (data: Record<string, unknown>[]): string[] => {
	const allKeys = new Set<string>();
	for (const row of data) {
		for (const key of Object.keys(row)) allKeys.add(key);
	}
	return Array.from(allKeys);
};

function cellToString(value: unknown): string {
	if (value === null || value === undefined) return "null";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
}

function resultsToMarkdown(
	columns: string[],
	rows: Record<string, unknown>[],
): string {
	const header = `| ${columns.join(" | ")} |`;
	const separator = `| ${columns.map(() => "---").join(" | ")} |`;
	const body = rows
		.map(
			(row) =>
				`| ${columns.map((col) => cellToString(row[col]).replace(/\|/g, "\\|")).join(" | ")} |`,
		)
		.join("\n");
	return `${header}\n${separator}\n${body}`;
}

function resultsToCSV(
	columns: string[],
	rows: Record<string, unknown>[],
): string {
	const escapeCSV = (val: unknown) => {
		const str =
			val === null || val === undefined
				? ""
				: typeof val === "object"
					? JSON.stringify(val)
					: String(val);
		if (str.includes(",") || str.includes('"') || str.includes("\n")) {
			return `"${str.replace(/"/g, '""')}"`;
		}
		return str;
	};
	const header = columns.map((c) => escapeCSV(c)).join(",");
	const body = rows
		.map((row) => columns.map((col) => escapeCSV(row[col])).join(","))
		.join("\n");
	return `${header}\n${body}`;
}

function downloadFile(content: string, filename: string, mimeType: string) {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

// ── Components ──

function QueryResultHeader({
	index,
	isMaximized,
	onToggleMaximize,
}: {
	index: number;
	isMaximized: boolean;
	onToggleMaximize: () => void;
}) {
	return (
		<div className="flex-none flex items-center justify-between px-4 py-1 border-b bg-bg-secondary">
			<span className="text-xs text-text-tertiary">Query {index + 1}</span>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button variant="ghost" size="small" onClick={onToggleMaximize}>
						{isMaximized ? (
							<Minimize2 className="w-3.5 h-3.5" />
						) : (
							<Maximize2 className="w-3.5 h-3.5" />
						)}
					</Button>
				</TooltipTrigger>
				<TooltipContent>{isMaximized ? "Minimize" : "Maximize"}</TooltipContent>
			</Tooltip>
		</div>
	);
}

function QueryResult({
	result,
	index,
	totalCount,
	isMaximized,
	onToggleMaximize,
	viewMode = "table",
}: {
	result: QueryResultItem;
	index: number;
	totalCount: number;
	isMaximized: boolean;
	onToggleMaximize: () => void;
	viewMode?: "table" | "list";
}) {
	const rows = result.result ?? [];
	const columns = extractColumns(rows);

	if (result.error) {
		return (
			<div className="flex flex-col h-full">
				{totalCount > 1 && (
					<QueryResultHeader
						index={index}
						isMaximized={isMaximized}
						onToggleMaximize={onToggleMaximize}
					/>
				)}
				<div className="p-6">
					<pre className="text-sm text-text-error-primary whitespace-pre-wrap font-mono">
						{result.error}
					</pre>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full min-h-0 overflow-hidden">
			{totalCount > 1 && (
				<QueryResultHeader
					index={index}
					isMaximized={isMaximized}
					onToggleMaximize={onToggleMaximize}
				/>
			)}
			{rows.length === 0 ? (
				<div className="flex items-center justify-center h-full text-text-secondary bg-bg-secondary">
					<div className="text-center">
						<div className="text-lg mb-2">No results</div>
						<div className="text-sm">Query returned no rows</div>
					</div>
				</div>
			) : viewMode === "list" ? (
				<div className="flex-1 overflow-auto min-h-0 divide-y divide-border-secondary">
					{rows.map((row, rowIdx) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: result rows lack stable unique identifiers
							key={rowIdx}
							className="grid gap-x-4 px-6 py-3"
							style={{ gridTemplateColumns: "max-content 1fr" }}
						>
							{columns.map((key) => (
								<div key={key} className="contents">
									<div className="py-1 px-2 text-right text-text-secondary typo-label text-sm whitespace-nowrap">
										{key}
									</div>
									<div className="py-1 px-2 min-w-0">
										<CellValue value={row[key]} />
									</div>
								</div>
							))}
						</div>
					))}
				</div>
			) : (
				<div className="flex-1 overflow-auto min-h-0">
					<Table stickyHeader className="typo-code w-auto min-w-full">
						<TableHeader>
							<TableRow>
								{columns.map((key, colIdx) => (
									<TableHead
										key={key}
										className={`px-6 hover:bg-transparent whitespace-nowrap ${colIdx === 0 ? "pl-5.5" : ""} ${colIdx === columns.length - 1 ? "w-full" : ""}`}
									>
										{key}
									</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody className="[&_tr]:hover:bg-transparent">
							{rows.map((row, rowIdx) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: result rows lack stable unique identifiers
								<TableRow key={rowIdx}>
									{columns.map((key, colIdx) => (
										<TableCell
											key={key}
											className={`px-6 align-top ${colIdx === 0 ? "pl-5.5" : ""}`}
										>
											<CellValue value={row[key]} />
										</TableCell>
									))}
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}

export function LimitDropdown({
	rowLimit,
	onRowLimitChange,
}: {
	rowLimit: number | null;
	onRowLimitChange: (limit: number | null) => void;
}) {
	const limitOptions = useMemo(() => {
		const opts = LIMIT_PRESETS.map((n) => ({
			value: String(n),
			label: String(n),
		}));
		if (rowLimit !== null && !LIMIT_PRESETS.includes(rowLimit)) {
			opts.push({ value: String(rowLimit), label: String(rowLimit) });
			opts.sort((a, b) => Number(a.value) - Number(b.value));
		}
		opts.push({ value: "none", label: "No limit" });
		return opts;
	}, [rowLimit]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="link"
					className="text-text-secondary bg-bg-tertiary rounded-full px-2.5 h-6"
				>
					<span className="text-text-tertiary uppercase">Limit</span>
					<span className="text-text-secondary">
						{rowLimit === null ? "No limit" : rowLimit}
					</span>
					<ChevronDown className="size-3 text-text-tertiary" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				{limitOptions.map((option) => (
					<DropdownMenuItem
						key={option.value}
						onSelect={() =>
							onRowLimitChange(
								option.value === "none" ? null : Number(option.value),
							)
						}
					>
						{option.label}
						{String(rowLimit ?? "none") === option.value && (
							<Check className="ml-auto size-4" />
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function TimeoutDropdown({
	timeoutSec,
	onTimeoutChange,
}: {
	timeoutSec: number | null;
	onTimeoutChange: (timeout: number | null) => void;
}) {
	const currentLabel = useMemo(() => {
		const preset = TIMEOUT_PRESETS.find((p) => p.value === timeoutSec);
		if (preset) return preset.label;
		return timeoutSec === null ? "No timeout" : `${timeoutSec}s`;
	}, [timeoutSec]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="link"
					className="text-text-secondary bg-bg-tertiary rounded-full px-2.5 h-6"
				>
					<span className="text-text-tertiary uppercase">Timeout</span>
					<span className="text-text-secondary">{currentLabel}</span>
					<ChevronDown className="size-3 text-text-tertiary" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				{TIMEOUT_PRESETS.map((option) => (
					<DropdownMenuItem
						key={option.label}
						onSelect={() => onTimeoutChange(option.value)}
					>
						{option.label}
						{option.value === timeoutSec && (
							<Check className="ml-auto size-4" />
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function AutocommitToggle({
	autocommit,
	onAutocommitChange,
}: {
	autocommit: boolean;
	onAutocommitChange: (next: boolean) => void;
}) {
	return (
		<Tooltip delayDuration={300}>
			<TooltipTrigger asChild>
				<Button
					variant="link"
					className={`rounded-full px-2.5 h-6 ${
						autocommit
							? "text-text-link bg-bg-tertiary"
							: "text-text-secondary bg-bg-tertiary"
					}`}
					onClick={() => onAutocommitChange(!autocommit)}
				>
					<span className="text-text-tertiary uppercase">Tx</span>
					<span>{autocommit ? "Autocommit" : "Transaction"}</span>
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">
				{autocommit
					? "Each statement commits immediately. Required for VACUUM, CREATE INDEX CONCURRENTLY."
					: "Wrap the whole script in a single transaction."}
			</TooltipContent>
		</Tooltip>
	);
}

export function ReadOnlyToggle({
	readOnly,
	onReadOnlyChange,
}: {
	readOnly: boolean;
	onReadOnlyChange: (next: boolean) => void;
}) {
	return (
		<Tooltip delayDuration={300}>
			<TooltipTrigger asChild>
				<Button
					variant="link"
					className={`rounded-full px-2.5 h-6 ${
						readOnly
							? "text-text-link bg-bg-tertiary"
							: "text-text-secondary bg-bg-tertiary"
					}`}
					onClick={() => onReadOnlyChange(!readOnly)}
				>
					<span className="text-text-tertiary uppercase">RO</span>
					<span>{readOnly ? "Read-only" : "Read-write"}</span>
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">
				{readOnly
					? "Writes and DDL rejected by the server."
					: "Statements can modify data and schema."}
			</TooltipContent>
		</Tooltip>
	);
}

export function ExportDropdown({
	results,
	disabled,
}: {
	results: QueryResultItem[];
	disabled?: boolean;
}) {
	const exportResult = useCallback(
		(resultItems: QueryResultItem[], format: "markdown" | "json" | "csv") => {
			const parts = resultItems.map((r) => {
				const rows = r.result ?? [];
				const columns = extractColumns(rows);
				switch (format) {
					case "markdown":
						return resultsToMarkdown(columns, rows);
					case "json":
						return JSON.stringify(rows, null, 2);
					case "csv":
						return resultsToCSV(columns, rows);
				}
			});

			if (format === "csv") {
				const combined = parts.join("\n\n");
				downloadFile(combined, "export.csv", "text/csv;charset=utf-8;");
			} else {
				const separator = format === "markdown" ? "\n\n" : "\n";
				navigator.clipboard.writeText(parts.join(separator));
			}
		},
		[],
	);

	const validResults = results.filter(
		(r) => !r.error && (r.result?.length ?? 0) > 0,
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="small" disabled={disabled}>
					<Download className="w-3.5 h-3.5" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{validResults.length > 1 &&
					validResults.map((r) => {
						const rows = r.result ?? [];
						const columns = extractColumns(rows);
						return (
							<DropdownMenu key={`query-${results.indexOf(r)}`}>
								<DropdownMenuTrigger className="w-full px-2 py-1.5 text-sm hover:bg-bg-secondary flex items-center justify-between cursor-pointer rounded-sm">
									Query {results.indexOf(r) + 1}
									<ChevronDown className="w-3 h-3 -rotate-90" />
								</DropdownMenuTrigger>
								<DropdownMenuContent side="left">
									<DropdownMenuItem
										onClick={() =>
											navigator.clipboard.writeText(
												resultsToMarkdown(columns, rows),
											)
										}
									>
										Copy as Markdown
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() =>
											navigator.clipboard.writeText(
												JSON.stringify(rows, null, 2),
											)
										}
									>
										Copy as JSON
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() =>
											downloadFile(
												resultsToCSV(columns, rows),
												"export.csv",
												"text/csv;charset=utf-8;",
											)
										}
									>
										Download CSV
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						);
					})}
				{validResults.length > 1 && (
					<>
						<div className="h-px bg-border-primary my-1" />
						<DropdownMenuItem
							onClick={() => exportResult(validResults, "markdown")}
						>
							Copy all as Markdown
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => exportResult(validResults, "json")}
						>
							Copy all as JSON
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => exportResult(validResults, "csv")}>
							Download all as CSV
						</DropdownMenuItem>
					</>
				)}
				{validResults.length === 1 && (
					<>
						<DropdownMenuItem
							onClick={() => exportResult(validResults, "markdown")}
						>
							Copy as Markdown
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={() => exportResult(validResults, "json")}
						>
							Copy as JSON
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => exportResult(validResults, "csv")}>
							Download CSV
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function ResultContent({
	results,
	error,
	isLoading,
	onRun,
	onCancel,
	viewMode = "table",
}: {
	results: QueryResultItem[] | null;
	error: string | null;
	isLoading: boolean;
	onRun: () => void;
	onCancel: () => void;
	viewMode?: "table" | "list";
}) {
	const [maximizedIndex, setMaximizedIndex] = useState<number | null>(null);

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center flex-1 gap-3 text-text-secondary">
				<div className="flex items-center">
					<Loader2 className="animate-spin mr-2" size={16} />
					Executing query…
				</div>
				<Button variant="secondary" size="small" onClick={onCancel}>
					Cancel
				</Button>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex-1 min-h-0 overflow-auto p-6">
				<pre className="text-sm text-text-error-primary whitespace-pre-wrap font-mono">
					{error}
				</pre>
			</div>
		);
	}

	if (!results) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary bg-bg-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">No results yet</div>
					<div className="text-sm">
						Click{" "}
						<button
							type="button"
							className="text-text-link hover:underline cursor-pointer"
							onClick={() => onRun()}
						>
							Run
						</button>{" "}
						to execute a query
					</div>
				</div>
			</div>
		);
	}

	if (maximizedIndex !== null && results[maximizedIndex]) {
		return (
			<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
				<div className="flex-1 min-h-0">
					<QueryResult
						result={results[maximizedIndex]}
						index={maximizedIndex}
						totalCount={results.length}
						isMaximized
						onToggleMaximize={() => setMaximizedIndex(null)}
						viewMode={viewMode}
					/>
				</div>
			</div>
		);
	}

	if (results.length === 1) {
		const singleResult = results[0];
		if (!singleResult) return null;
		return (
			<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
				<div className="flex-1 min-h-0">
					<QueryResult
						result={singleResult}
						index={0}
						totalCount={1}
						isMaximized={false}
						onToggleMaximize={() => {}}
						viewMode={viewMode}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
			<div className="flex-1 min-h-0">
				<ResizablePanelGroup direction="vertical">
					{results.flatMap((result, index) => {
						const key = `${result.query}-${index}`;
						const panel = (
							<ResizablePanel key={`panel-${key}`} minSize={10}>
								<QueryResult
									result={result}
									index={index}
									totalCount={results.length}
									isMaximized={false}
									onToggleMaximize={() => setMaximizedIndex(index)}
									viewMode={viewMode}
								/>
							</ResizablePanel>
						);
						if (index === 0) return [panel];
						return [<ResizableHandle key={`handle-${key}`} />, panel];
					})}
				</ResizablePanelGroup>
			</div>
		</div>
	);
}
