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
import { LIMIT_PRESETS } from "./utils";

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
				<span style={{ color: "#405CBF" }}>"{value}"</span>
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
}: {
	result: QueryResultItem;
	index: number;
	totalCount: number;
	isMaximized: boolean;
	onToggleMaximize: () => void;
}) {
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

	const rows = result.result ?? [];
	const columns = extractColumns(rows);

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
			) : (
				<div className="flex-1 overflow-auto min-h-0">
					<Table stickyHeader className="typo-code">
						<TableHeader>
							<TableRow>
								{columns.map((key) => (
									<TableHead
										key={key}
										className="px-6 hover:bg-transparent whitespace-nowrap"
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
									{columns.map((key) => (
										<TableCell key={key} className="px-6 align-top">
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

function LimitDropdown({
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
		<span className="flex items-center gap-1">
			Limit:
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="link"
						className="text-text-secondary bg-bg-tertiary rounded-full px-2 h-6"
					>
						<span className="typo-body">
							{rowLimit === null ? "No limit" : rowLimit}
						</span>
						<ChevronDown className="size-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
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
		</span>
	);
}

function ExportDropdown({ results }: { results: QueryResultItem[] }) {
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
				<Button variant="ghost" size="small">
					<Download className="w-3.5 h-3.5" />
					Export
					<ChevronDown className="w-3 h-3" />
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

function ResultFooter({
	results,
	rowLimit,
	onRowLimitChange,
	hasExplicitLimit,
}: {
	results: QueryResultItem[] | null;
	rowLimit: number | null;
	onRowLimitChange: (limit: number | null) => void;
	hasExplicitLimit: boolean;
}) {
	const totalRows = results
		? results.reduce((sum, r) => sum + (r.result?.length ?? 0), 0)
		: 0;
	const totalDuration = results
		? results.reduce((sum, r) => sum + r.duration, 0)
		: 0;
	const hasRows = totalRows > 0;

	if (!results) {
		if (hasExplicitLimit) return null;
		return (
			<div className="flex-none px-6 py-2 border-t text-xs text-text-tertiary bg-bg-secondary flex items-center justify-end">
				<LimitDropdown
					rowLimit={rowLimit}
					onRowLimitChange={onRowLimitChange}
				/>
			</div>
		);
	}

	return (
		<div className="flex-none px-6 py-2 border-t text-xs text-text-tertiary bg-bg-secondary flex items-center justify-between">
			<span>
				{totalRows} row · Time: {totalDuration}ms
			</span>
			<div className="flex items-center gap-3">
				{hasRows && <ExportDropdown results={results} />}
				{!hasExplicitLimit && (
					<LimitDropdown
						rowLimit={rowLimit}
						onRowLimitChange={onRowLimitChange}
					/>
				)}
			</div>
		</div>
	);
}

export function ResultContent({
	results,
	error,
	isLoading,
	onRun,
	onCancel,
	rowLimit,
	onRowLimitChange,
	hasExplicitLimit,
}: {
	results: QueryResultItem[] | null;
	error: string | null;
	isLoading: boolean;
	onRun: () => void;
	onCancel: () => void;
	rowLimit: number | null;
	onRowLimitChange: (limit: number | null) => void;
	hasExplicitLimit: boolean;
}) {
	const [maximizedIndex, setMaximizedIndex] = useState<number | null>(null);

	if (isLoading) {
		return (
			<>
				<div className="flex flex-col items-center justify-center flex-1 gap-3 text-text-secondary">
					<div className="flex items-center">
						<Loader2 className="animate-spin mr-2" size={16} />
						Executing query…
					</div>
					<Button variant="secondary" size="small" onClick={onCancel}>
						Cancel
					</Button>
				</div>
				{!hasExplicitLimit && (
					<ResultFooter
						results={null}
						rowLimit={rowLimit}
						onRowLimitChange={onRowLimitChange}
						hasExplicitLimit={hasExplicitLimit}
					/>
				)}
			</>
		);
	}

	if (error) {
		return (
			<>
				<div className="flex-1 min-h-0 overflow-auto p-6">
					<pre className="text-sm text-text-error-primary whitespace-pre-wrap font-mono">
						{error}
					</pre>
				</div>
				{!hasExplicitLimit && (
					<ResultFooter
						results={null}
						rowLimit={rowLimit}
						onRowLimitChange={onRowLimitChange}
						hasExplicitLimit={hasExplicitLimit}
					/>
				)}
			</>
		);
	}

	if (!results) {
		return (
			<>
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
				{!hasExplicitLimit && (
					<ResultFooter
						results={null}
						rowLimit={rowLimit}
						onRowLimitChange={onRowLimitChange}
						hasExplicitLimit={hasExplicitLimit}
					/>
				)}
			</>
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
					/>
				</div>
				<ResultFooter
					results={results}
					rowLimit={rowLimit}
					onRowLimitChange={onRowLimitChange}
					hasExplicitLimit={hasExplicitLimit}
				/>
			</div>
		);
	}

	if (results.length === 1) {
		return (
			<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
				<div className="flex-1 min-h-0">
					<QueryResult
						result={results[0]!}
						index={0}
						totalCount={1}
						isMaximized={false}
						onToggleMaximize={() => {}}
					/>
				</div>
				<ResultFooter
					results={results}
					rowLimit={rowLimit}
					onRowLimitChange={onRowLimitChange}
					hasExplicitLimit={hasExplicitLimit}
				/>
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
								/>
							</ResizablePanel>
						);
						if (index === 0) return [panel];
						return [<ResizableHandle key={`handle-${key}`} />, panel];
					})}
				</ResizablePanelGroup>
			</div>
			<ResultFooter
				results={results}
				rowLimit={rowLimit}
				onRowLimitChange={onRowLimitChange}
				hasExplicitLimit={hasExplicitLimit}
			/>
		</div>
	);
}
