import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import * as yaml from "js-yaml";
import {
	Check,
	ChevronLeft,
	Copy,
	Globe,
	Loader2,
	Pencil,
	Play,
	Timer,
	User,
} from "lucide-react";
import { Children, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAidboxClient } from "../AidboxClient";
import { ResultContent } from "../components/db-console/result-content";
import { transformToQueryResultItems } from "../components/db-console/tables-view";
import { HTTP_STATUS_CODES } from "../shared/const";
import type { QueryResultItem } from "../webmcp/db-console-context";

type SavedRestResult = {
	status?: number;
	statusText?: string;
	headers?: Record<string, string>;
	body?: string;
};

type Cell = {
	id?: string;
	type?: "rest" | "sql" | "markdown" | "rpc" | string;
	value?: string;
	result?: SavedRestResult | unknown;
};

type Notebook = {
	id: string;
	resourceType?: string;
	name?: string;
	description?: string;
	cells?: Cell[];
	origin?: string;
	"publication-id"?: string;
	"edit-secret"?: string;
};

function useNotebook(id: string, path?: string) {
	const client = useAidboxClient();
	return useQuery<Notebook | null>({
		queryKey: ["notebook", id, path ?? null],
		queryFn: async () => {
			const body = path
				? {
						method: "aidbox.notebooks/open-repo-notebook",
						params: { "notebook-url": path },
					}
				: {
						method: "aidbox.notebooks/get-notebook-by-id",
						params: { notebook: { id } },
					};
			const resp = await client.rawRequest({
				method: "POST",
				url: `/rpc?_m=${body.method}`,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const json = (await resp.response.json()) as {
				result?: { notebook?: Notebook };
				error?: unknown;
			};
			return json.result?.notebook ?? null;
		},
	});
}

const ACRONYM_TAGS = new Set(["rest", "sql", "rpc"]);
function formatTag(s: string): string {
	const lower = s.toLowerCase();
	if (ACRONYM_TAGS.has(lower)) return lower.toUpperCase();
	return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const MD_COMPONENTS = {
	h1: ({ children }: { children?: React.ReactNode }) => (
		<h1 className="typo-page-header text-text-primary mt-2 mb-3">{children}</h1>
	),
	h2: ({ children }: { children?: React.ReactNode }) => (
		<h2 className="text-2xl font-semibold text-text-primary mt-4 mb-2">
			{children}
		</h2>
	),
	h3: ({ children }: { children?: React.ReactNode }) => (
		<h3 className="text-xl font-semibold text-text-primary mt-3 mb-2">
			{children}
		</h3>
	),
	p: ({ children }: { children?: React.ReactNode }) => (
		<p className="typo-body text-text-primary my-2">{children}</p>
	),
	ul: ({ children }: { children?: React.ReactNode }) => (
		<ul className="list-disc list-outside pl-5 my-2 space-y-1">{children}</ul>
	),
	ol: ({ children }: { children?: React.ReactNode }) => (
		<ol className="list-decimal list-outside pl-5 my-2 space-y-1">
			{children}
		</ol>
	),
	li: ({ children }: { children?: React.ReactNode }) => (
		<li className="typo-body text-text-primary">{children}</li>
	),
	a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
		<a
			href={href}
			className="text-text-info-primary hover:underline"
			target="_blank"
			rel="noopener noreferrer"
		>
			{children}
		</a>
	),
	blockquote: ({ children }: { children?: React.ReactNode }) => (
		<blockquote className="border-l-4 border-border-default pl-3 my-2 text-text-secondary">
			{children}
		</blockquote>
	),
	code: ({
		className,
		children,
	}: {
		className?: string;
		children?: React.ReactNode;
	}) => {
		const text = Children.toArray(children)
			.filter((c): c is string => typeof c === "string")
			.join("");
		const isBlock = className?.startsWith("language-") || text.includes("\n");
		return (
			<code
				className={
					isBlock
						? "block typo-code whitespace-pre"
						: "px-1 py-0.5 rounded bg-bg-tertiary text-[0.85em] font-mono text-text-primary"
				}
			>
				{children}
			</code>
		);
	},
	pre: ({ children }: { children?: React.ReactNode }) => (
		<pre className="-mx-3 my-2 p-3 mb-4 rounded-lg border border-border-default bg-bg-tertiary overflow-x-auto">
			{children}
		</pre>
	),
	hr: () => <hr className="my-4 border-border-default" />,
	strong: ({ children }: { children?: React.ReactNode }) => (
		<strong className="font-semibold">{children}</strong>
	),
	em: ({ children }: { children?: React.ReactNode }) => (
		<em className="italic">{children}</em>
	),
	table: ({ children }: { children?: React.ReactNode }) => (
		<table className="my-2 border-collapse border border-border-default text-left">
			{children}
		</table>
	),
	th: ({ children }: { children?: React.ReactNode }) => (
		<th className="border border-border-default px-2 py-1 bg-bg-tertiary font-semibold">
			{children}
		</th>
	),
	td: ({ children }: { children?: React.ReactNode }) => (
		<td className="border border-border-default px-2 py-1">{children}</td>
	),
};

function parseRawRequest(raw: string): {
	method: string;
	path: string;
	headers: Record<string, string>;
	body: string;
} {
	const [head = "", ...rest] = raw.split(/\r?\n\r?\n/);
	const body = rest.join("\n\n");
	const lines = head.split(/\r?\n/);
	const firstLine = lines[0]?.trim() ?? "";
	const m = firstLine.match(/^(\S+)\s+(.+)$/);
	const method = m ? (m[1] ?? "GET").toUpperCase() : "GET";
	const path = m ? (m[2] ?? "") : firstLine;
	const headers: Record<string, string> = {};
	for (let i = 1; i < lines.length; i++) {
		const line = (lines[i] ?? "").trim();
		if (!line) continue;
		const idx = line.indexOf(":");
		if (idx > 0) {
			const name = line.slice(0, idx).trim();
			const value = line.slice(idx + 1).trim();
			if (name) headers[name] = value;
		}
	}
	return { method, path, headers, body };
}

function parsePathQuery(path: string): { name: string; value: string }[] {
	const qIdx = path.indexOf("?");
	if (qIdx < 0) return [];
	const qs = path.slice(qIdx + 1);
	return qs
		.split("&")
		.filter(Boolean)
		.map((pair) => {
			const eq = pair.indexOf("=");
			const name = eq < 0 ? pair : pair.slice(0, eq);
			const value = eq < 0 ? "" : pair.slice(eq + 1);
			try {
				return {
					name: decodeURIComponent(name),
					value: decodeURIComponent(value),
				};
			} catch {
				return { name, value };
			}
		});
}

function KeyValueTable({
	rows,
	empty,
}: {
	rows: { name: string; value: string }[];
	empty: string;
}) {
	if (rows.length === 0) {
		return (
			<div className="px-4 py-3 typo-body-xs text-text-tertiary italic">
				{empty}
			</div>
		);
	}
	return (
		<table className="w-full typo-body-xs">
			<tbody>
				{rows.map((r, i) => (
					<tr
						key={`${r.name}-${i}`}
						className="border-b border-border-default last:border-b-0"
					>
						<td className="px-3 py-1.5 font-mono text-text-primary align-top w-[1%] whitespace-nowrap">
							{r.name}
						</td>
						<td className="px-3 py-1.5 font-mono text-text-secondary break-all">
							{r.value}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

type CellResponse = {
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body: string;
	duration?: number;
};

function savedRestToResponse(saved: unknown): CellResponse | null {
	if (!saved || typeof saved !== "object") return null;
	const s = saved as SavedRestResult;
	if (typeof s.status !== "number") return null;
	return {
		status: s.status,
		statusText: s.statusText ?? "",
		headers: s.headers ?? {},
		body: typeof s.body === "string" ? s.body : JSON.stringify(s.body ?? ""),
	};
}

function detectBodyMode(headers: Record<string, string>): "json" | "yaml" {
	const ct = headers["content-type"] ?? headers["Content-Type"] ?? "";
	return /yaml/i.test(ct) ? "yaml" : "json";
}

function formatBodyContent(body: string, mode: "json" | "yaml"): string {
	if (mode === "yaml") {
		try {
			return yaml.dump(yaml.load(body), {
				indent: 2,
				lineWidth: -1,
				noRefs: true,
			});
		} catch {
			return body;
		}
	}
	try {
		return JSON.stringify(JSON.parse(body), null, 2);
	} catch {
		return body;
	}
}

function ResponseStatus({ response }: { response: CellResponse }) {
	const messageColor =
		response.status >= 400 ? "text-critical-default" : "text-green-500";
	return (
		<span className="flex font-medium items-center text-text-secondary text-sm min-w-0 shrink">
			<span className="shrink-0">Status:</span>
			<span className={`ml-1 ${messageColor} truncate`}>
				{response.status}{" "}
				<span className="hidden sm:inline">
					{response.statusText || HTTP_STATUS_CODES[response.status]}
				</span>
			</span>
		</span>
	);
}

function RestCellView({ cell }: { cell: Cell }) {
	const [raw, setRaw] = useState(cell.value ?? "");
	const [response, setResponse] = useState<CellResponse | null>(
		savedRestToResponse(cell.result),
	);
	const [loading, setLoading] = useState(false);
	const [hasFreshResponse, setHasFreshResponse] = useState(false);
	const [tab, setTab] = useState<"body" | "headers">("body");
	const [reqTab, setReqTab] = useState<"params" | "headers" | "raw">("raw");
	const responseRef = useRef<HTMLDivElement | null>(null);
	const client = useAidboxClient();

	useEffect(() => {
		if (response && hasFreshResponse) {
			responseRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "nearest",
			});
		}
	}, [response, hasFreshResponse]);

	const send = async () => {
		setLoading(true);
		try {
			const { method, path, headers, body } = parseRawRequest(raw);
			const t0 = performance.now();
			const resp = await client.rawRequest({
				method: method as "GET",
				url: path,
				...(Object.keys(headers).length > 0 ? { headers } : {}),
				...(body ? { body } : {}),
			});
			const text = await resp.response.text();
			const duration = performance.now() - t0;
			const respHeaders: Record<string, string> = {};
			resp.response.headers.forEach((value, key) => {
				respHeaders[key] = value;
			});
			setResponse({
				status: resp.response.status,
				statusText: resp.response.statusText,
				headers: respHeaders,
				body: text,
				duration,
			});
			setHasFreshResponse(true);
		} finally {
			setLoading(false);
		}
	};

	const bodyMode = response ? detectBodyMode(response.headers) : "json";
	const content = response
		? tab === "headers"
			? JSON.stringify(response.headers, null, 2)
			: formatBodyContent(response.body, bodyMode)
		: "";
	const mode = tab === "headers" ? "json" : bodyMode;

	return (
		<div className="-mx-3 mt-4 mb-4 rounded-lg border border-border-default bg-bg-primary overflow-hidden">
			<HSComp.Tabs
				value={reqTab}
				onValueChange={(v) => setReqTab(v as "params" | "headers" | "raw")}
				className="flex flex-col"
			>
				<div className="flex items-center justify-between bg-bg-secondary pl-3 pr-4 border-b border-border-default h-10">
					<div className="flex items-center gap-3">
						<span className="text-sm font-medium text-text-secondary w-[70px] shrink-0">
							Request
						</span>
						<HSComp.TabsList>
							<HSComp.TabsTrigger value="raw">Raw</HSComp.TabsTrigger>
							<HSComp.TabsTrigger value="params">Params</HSComp.TabsTrigger>
							<HSComp.TabsTrigger value="headers">Headers</HSComp.TabsTrigger>
						</HSComp.TabsList>
					</div>
					<button
						type="button"
						disabled={loading}
						onClick={() => void send()}
						className="flex items-center gap-2 text-text-info-primary typo-body uppercase hover:text-text-info-secondary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
					>
						{loading ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Play className="size-4 fill-current" />
						)}
						{loading ? "Sending…" : "Send"}
					</button>
				</div>
				{reqTab === "raw" && (
					<div className="max-h-[400px] overflow-auto [&_.cm-content]:!pl-1.5">
						<HSComp.CodeEditor
							mode="http"
							defaultValue={raw}
							onChange={setRaw}
							lineNumbers={false}
							foldGutter={false}
						/>
					</div>
				)}
				{reqTab === "params" && (
					<KeyValueTable
						rows={parsePathQuery(parseRawRequest(raw).path)}
						empty="No query params."
					/>
				)}
				{reqTab === "headers" && (
					<KeyValueTable
						rows={Object.entries(parseRawRequest(raw).headers).map(
							([name, value]) => ({ name, value }),
						)}
						empty="No headers."
					/>
				)}
			</HSComp.Tabs>
			{response && (
				<HSComp.Tabs
					value={tab}
					onValueChange={(v) => setTab(v as "body" | "headers")}
					className="flex flex-col"
				>
					<div className="flex items-center justify-between bg-bg-secondary pl-3 pr-4 h-10 border-t border-b border-border-default">
						<div className="flex items-center gap-3">
							<span className="text-sm font-medium text-text-secondary w-[70px] shrink-0">
								Response
							</span>
							<HSComp.TabsList>
								<HSComp.TabsTrigger value="body">Body</HSComp.TabsTrigger>
								<HSComp.TabsTrigger value="headers">Headers</HSComp.TabsTrigger>
							</HSComp.TabsList>
						</div>
						<div className="flex items-center gap-3">
							<ResponseStatus response={response} />
							{response.duration !== undefined && (
								<span className="flex items-center text-text-secondary text-sm">
									<Timer className="size-4 mr-1" strokeWidth={1.5} />
									<span className="font-bold">
										{Math.round(response.duration)}
									</span>
									<span className="ml-1">ms</span>
								</span>
							)}
						</div>
					</div>
				</HSComp.Tabs>
			)}
			{response && (
				<div
					ref={responseRef}
					className="max-h-[400px] overflow-auto [&_.cm-content]:!pl-1.5"
				>
					<HSComp.CodeEditor
						key={`${tab}-${response.status}`}
						readOnly
						currentValue={content}
						mode={mode}
						lineNumbers={false}
						foldGutter={false}
					/>
				</div>
			)}
		</div>
	);
}

function normalizeMarkdown(s: string): string {
	// CommonMark requires a space after #/##/etc., but old notebooks often have
	// "##Heading" written without it. Insert a space so headings render.
	return s.replace(/^(#{1,6})(?=[^\s#])/gm, "$1 ");
}

function savedSqlToResults(saved: unknown): QueryResultItem[] | null {
	if (!saved) return null;
	if (Array.isArray(saved)) {
		const rows = saved as Record<string, unknown>[];
		return [
			{
				query: "",
				duration: 0,
				status: "success",
				result: rows,
				rows: rows.length,
			},
		];
	}
	if (typeof saved === "object") {
		const s = saved as {
			query?: string;
			duration?: number;
			status?: "success" | "error";
			result?: Array<
				| { type: "rset"; data: Record<string, unknown>[] }
				| { type: "count"; data: number }
			>;
			error?: string;
			position?: number;
		};
		if (s.status === "success" || s.status === "error") {
			return transformToQueryResultItems({
				query: s.query ?? "",
				duration: s.duration ?? 0,
				status: s.status,
				result: s.result,
				error: s.error,
				position: s.position,
			});
		}
	}
	return null;
}

function SqlCellView({ cell }: { cell: Cell }) {
	const [query, setQuery] = useState(cell.value ?? "");
	const [results, setResults] = useState<QueryResultItem[] | null>(() =>
		savedSqlToResults(cell.result),
	);
	const [error, setError] = useState<string | null>(null);
	const [duration, setDuration] = useState<number | undefined>();
	const [loading, setLoading] = useState(false);
	const client = useAidboxClient();

	const send = async () => {
		setLoading(true);
		setError(null);
		try {
			const t0 = performance.now();
			const resp = await fetch(`${client.getBaseUrl()}/$psql`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ query }),
			});
			const took = performance.now() - t0;
			setDuration(took);
			if (!resp.ok) {
				setError(`HTTP ${resp.status}: ${await resp.text()}`);
				setResults(null);
				return;
			}
			const items = transformToQueryResultItems(await resp.json());
			setResults(items);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
			setResults(null);
		} finally {
			setLoading(false);
		}
	};

	const hasResponse = results !== null || error !== null;

	return (
		<div className="-mx-3 mt-4 mb-4 rounded-lg border border-border-default bg-bg-primary overflow-hidden">
			<div className="flex items-center justify-between bg-bg-secondary pl-3 pr-4 border-b border-border-default h-10">
				<span className="text-sm font-medium text-text-secondary w-[70px] shrink-0">
					SQL
				</span>
				<button
					type="button"
					disabled={loading}
					onClick={() => void send()}
					className="flex items-center gap-2 text-text-info-primary typo-body uppercase hover:text-text-info-secondary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
				>
					{loading ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Play className="size-4 fill-current" />
					)}
					{loading ? "Sending…" : "Send"}
				</button>
			</div>
			<div className="max-h-[400px] overflow-auto [&_.cm-content]:!pl-1.5">
				<HSComp.CodeEditor
					mode="sql"
					defaultValue={query}
					onChange={setQuery}
					lineNumbers={false}
					foldGutter={false}
				/>
			</div>
			{hasResponse && (
				<>
					<div className="flex items-center justify-between bg-bg-secondary pl-3 pr-4 h-10 border-t border-b border-border-default">
						<span className="text-sm font-medium text-text-secondary shrink-0">
							Result
							{results
								? ` (${results.reduce((s, r) => s + (r.result?.length ?? 0), 0)})`
								: ""}
						</span>
						{duration !== undefined && (
							<span className="flex items-center text-text-secondary text-sm">
								<Timer className="size-4 mr-1" strokeWidth={1.5} />
								<span className="font-bold">{Math.round(duration)}</span>
								<span className="ml-1">ms</span>
							</span>
						)}
					</div>
					<div className="max-h-[400px] flex flex-col [&_table_th:first-child]:!pl-3 [&_table_td:first-child]:!pl-3">
						<ResultContent
							results={results}
							error={error}
							isLoading={false}
							onRun={() => void send()}
							onCancel={() => undefined}
						/>
					</div>
				</>
			)}
		</div>
	);
}

function CellView({ cell }: { cell: Cell }) {
	const type = cell.type ?? "rest";
	if (type === "rest") {
		return <RestCellView cell={cell} />;
	}
	if (type === "sql") {
		return <SqlCellView cell={cell} />;
	}
	if (type === "markdown") {
		return (
			<div className="text-text-primary">
				<ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
					{normalizeMarkdown(cell.value ?? "")}
				</ReactMarkdown>
			</div>
		);
	}
	return (
		<div className="-mx-3 mb-2 rounded-lg border border-border-default bg-bg-primary">
			<div className="flex items-center gap-2 px-3 py-2 border-b border-border-default">
				<span className="text-[11px] leading-4 text-text-info-primary">
					#{formatTag(type)}
				</span>
			</div>
			<pre className="px-3 py-2 whitespace-pre-wrap break-all typo-body-xs font-mono text-text-primary">
				{cell.value ?? ""}
			</pre>
		</div>
	);
}

function NotebookViewPage() {
	const { id } = Route.useParams();
	const { path } = Route.useSearch();
	const { data: notebook, isLoading } = useNotebook(id, path);

	const isCommunity = !!path || !!notebook?.origin;
	const canEdit = !isCommunity;

	return (
		<div className="h-full flex flex-col">
			<div className="flex-1 min-h-0 overflow-y-auto pb-[400px]">
				<div className="mx-auto max-w-[990px] px-8 py-8">
					{isLoading ? null : !notebook ? (
						<div className="typo-body text-text-tertiary italic">
							Notebook not found.
						</div>
					) : (
						<div className="flex flex-col">
							<div className="flex flex-col gap-1">
								<div
									className={`flex items-center gap-1.5 typo-label-tiny uppercase tracking-wide ${isCommunity ? "text-text-success-primary" : "text-text-warning-primary"}`}
								>
									{isCommunity ? (
										<Globe className="size-3.5" />
									) : (
										<User className="size-3.5" />
									)}
									<span>{isCommunity ? "Community" : "Personal"}</span>
								</div>
								<div className="flex items-start justify-between gap-3">
									<h1 className="typo-page-header text-text-primary first-letter:uppercase">
										{notebook.name ?? "(unnamed)"}
									</h1>
									{canEdit && (
										<Link to="/notebooks/$id/edit" params={{ id: notebook.id }}>
											<HSComp.Button variant="secondary">
												<Pencil className="size-4 text-text-info-primary" />
												Edit
											</HSComp.Button>
										</Link>
									)}
								</div>
								{notebook.description && (
									<p className="typo-body text-text-secondary">
										{notebook.description}
									</p>
								)}
							</div>
							{(notebook.cells ?? []).length > 0 && (
								<div className="flex flex-col mt-7">
									{(notebook.cells ?? []).map((cell, i) => (
										<CellView key={cell.id ?? `cell-${i}`} cell={cell} />
									))}
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

const validateSearch = (search: { path?: unknown }): { path?: string } => {
	if (typeof search.path === "string" && search.path.length > 0)
		return { path: search.path };
	return {};
};

export const Route = createFileRoute("/notebooks/$id")({
	staticData: { title: "Notebook" },
	loader: ({ params }) => ({ breadCrumb: params.id }),
	component: NotebookViewPage,
	validateSearch,
});
