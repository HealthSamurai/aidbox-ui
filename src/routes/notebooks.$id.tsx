import * as HSComp from "@health-samurai/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as yaml from "js-yaml";
import {
	Check,
	ChevronDown,
	Copy,
	Database,
	FileCode,
	FileDown,
	Globe,
	GlobeOff,
	Link2,
	Loader2,
	Pencil,
	Play,
	Share2,
	SquareTerminal,
	Table,
	Timer,
	Trash2,
	User,
	X,
} from "lucide-react";
import { Children, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAidboxClient } from "../AidboxClient";
import { ConfirmDialog } from "../components/confirm-dialog";
import { ResultContent } from "../components/db-console/result-content";
import { transformToQueryResultItems } from "../components/db-console/tables-view";
import { NotebookResourcePicker } from "../components/notebook-resource-picker";
import { HTTP_STATUS_CODES } from "../shared/const";
import { copyToClipboard } from "../utils/clipboard";
import { prettyEdn } from "../utils/edn";
import type { QueryResultItem } from "../webmcp/db-console-context";

type SavedRestResult = {
	status?: number;
	statusText?: string;
	headers?: Record<string, string>;
	body?: string;
};

export type Cell = {
	id?: string;
	type?: "rest" | "sql" | "markdown" | "rpc" | string;
	value?: string;
	result?: SavedRestResult | unknown;
};

export type Notebook = {
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

export const MD_COMPONENTS = {
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
		<div className="my-2 rounded-lg border border-border-default overflow-hidden">
			<HSComp.Table zebra>{children}</HSComp.Table>
		</div>
	),
	thead: ({ children }: { children?: React.ReactNode }) => (
		<HSComp.TableHeader>{children}</HSComp.TableHeader>
	),
	tbody: ({ children }: { children?: React.ReactNode }) => (
		<HSComp.TableBody>{children}</HSComp.TableBody>
	),
	tr: ({ children }: { children?: React.ReactNode }) => (
		<HSComp.TableRow>{children}</HSComp.TableRow>
	),
	th: ({ children }: { children?: React.ReactNode }) => (
		<HSComp.TableHead>{children}</HSComp.TableHead>
	),
	td: ({ children }: { children?: React.ReactNode }) => (
		<HSComp.TableCell>{children}</HSComp.TableCell>
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

type BodyMode = "json" | "yaml" | "edn";

function detectBodyMode(headers: Record<string, string>): BodyMode {
	const ct = headers["content-type"] ?? headers["Content-Type"] ?? "";
	if (/edn/i.test(ct)) return "edn";
	if (/yaml/i.test(ct)) return "yaml";
	return "json";
}

function formatBodyContent(body: string, mode: BodyMode): string {
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
	if (mode === "edn") {
		try {
			return prettyEdn(body);
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

export function RestCellView({
	cell,
	onValueChange,
	onResultChange,
	readOnly,
}: {
	cell: Cell;
	onValueChange?: (value: string) => void;
	onResultChange?: (result: unknown) => void;
	readOnly?: boolean;
}) {
	const isReadOnly = readOnly ?? !onValueChange;
	const [raw, setRaw] = useState(cell.value ?? "");
	const [response, setResponse] = useState<CellResponse | null>(
		savedRestToResponse(cell.result),
	);
	const [loading, setLoading] = useState(false);
	const [hasFreshResponse, setHasFreshResponse] = useState(false);
	const [tab, setTab] = useState<"body" | "headers">("body");
	const responseRef = useRef<HTMLDivElement | null>(null);
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	const updateRaw = (v: string) => {
		setRaw(v);
		onValueChange?.(v);
	};

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
		const t0 = performance.now();
		try {
			const { method, path, headers, body } = parseRawRequest(raw);
			let respObj: { response: Response };
			try {
				respObj = await client.rawRequest({
					method: method as "GET",
					url: path,
					...(Object.keys(headers).length > 0 ? { headers } : {}),
					...(body ? { body } : {}),
				});
			} catch (e) {
				if (e && typeof e === "object" && "response" in e) {
					respObj = e as { response: Response };
				} else {
					const next: CellResponse = {
						status: 0,
						statusText: e instanceof Error ? e.message : String(e),
						headers: {},
						body: e instanceof Error ? e.message : String(e),
						duration: performance.now() - t0,
					};
					setResponse(next);
					setHasFreshResponse(true);
					onResultChange?.(next);
					return;
				}
			}
			const text = await respObj.response.text();
			const duration = performance.now() - t0;
			const respHeaders: Record<string, string> = {};
			respObj.response.headers.forEach((value, key) => {
				respHeaders[key] = value;
			});
			const next: CellResponse = {
				status: respObj.response.status,
				statusText: respObj.response.statusText,
				headers: respHeaders,
				body: text,
				duration,
			};
			setResponse(next);
			setHasFreshResponse(true);
			onResultChange?.(next);
		} finally {
			setLoading(false);
			// A REST call may create/update a ViewDefinition or SQLQuery that
			// other cells reference, so refresh those lookups.
			void queryClient.invalidateQueries({
				queryKey: ["view-definition-by-url"],
			});
			void queryClient.invalidateQueries({
				queryKey: ["sqlquery-library-by-url"],
			});
		}
	};

	const clearResponse = () => {
		setResponse(null);
		setHasFreshResponse(false);
		onResultChange?.(null);
	};

	const bodyMode = response ? detectBodyMode(response.headers) : "json";
	const content = response
		? tab === "headers"
			? JSON.stringify(response.headers, null, 2)
			: formatBodyContent(response.body, bodyMode)
		: "";
	const mode = tab === "headers" ? "json" : bodyMode;

	return (
		<div className="group/cell -mx-3 mt-4 mb-4 rounded-lg border border-border-default bg-bg-primary overflow-hidden">
			<div className="flex items-center justify-between bg-bg-secondary pl-3 pr-4 border-b border-border-default h-10">
				<span className="text-sm font-medium text-text-secondary w-[70px] shrink-0 flex items-center gap-1.5">
					<SquareTerminal className="size-4" />
					REST
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
					Send
				</button>
			</div>
			<div className="max-h-[400px] overflow-auto [&_.cm-content]:!pl-1.5">
				<HSComp.CodeEditor
					mode="http"
					defaultValue={raw}
					onChange={updateRaw}
					readOnly={isReadOnly}
					lineNumbers={false}
					foldGutter={false}
				/>
			</div>
			{response && (
				<HSComp.Tabs
					value={tab}
					onValueChange={(v) => setTab(v as "body" | "headers")}
					className="flex flex-col"
				>
					<div className="flex items-center justify-between bg-bg-secondary pl-3 pr-4 h-10 border-t border-b border-border-default">
						<div className="flex items-center gap-3">
							<span className="text-sm font-medium text-text-secondary w-[70px] shrink-0">
								Response:
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
							{onResultChange && (
								<button
									type="button"
									onClick={clearResponse}
									aria-label="Clear response"
									className="inline-flex items-center justify-center size-6 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary cursor-pointer"
								>
									<X className="size-4" />
								</button>
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
					{mode === "edn" ? (
						<pre className="px-3 py-2 typo-code whitespace-pre text-text-primary">
							{content}
						</pre>
					) : (
						<HSComp.CodeEditor
							key={`${tab}-${response.status}`}
							readOnly
							currentValue={content}
							mode={mode}
							lineNumbers={false}
							foldGutter={false}
						/>
					)}
				</div>
			)}
		</div>
	);
}

export function normalizeMarkdown(s: string): string {
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

export function SqlCellView({
	cell,
	onValueChange,
	onResultChange,
	readOnly,
}: {
	cell: Cell;
	onValueChange?: (value: string) => void;
	onResultChange?: (result: unknown) => void;
	readOnly?: boolean;
}) {
	const isReadOnly = readOnly ?? !onValueChange;
	const [query, setQuery] = useState(cell.value ?? "");
	const [results, setResults] = useState<QueryResultItem[] | null>(() =>
		savedSqlToResults(cell.result),
	);
	const [error, setError] = useState<string | null>(null);
	const [duration, setDuration] = useState<number | undefined>();
	const [loading, setLoading] = useState(false);
	const client = useAidboxClient();

	const updateQuery = (v: string) => {
		setQuery(v);
		onValueChange?.(v);
	};

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
				const message = `HTTP ${resp.status}: ${await resp.text()}`;
				setError(message);
				setResults(null);
				onResultChange?.({ status: "error", error: message, query });
				return;
			}
			const raw = await resp.json();
			const items = transformToQueryResultItems(raw);
			setResults(items);
			onResultChange?.(raw);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			setError(message);
			setResults(null);
			onResultChange?.({ status: "error", error: message, query });
		} finally {
			setLoading(false);
		}
	};

	const hasResponse = results !== null || error !== null;

	return (
		<div className="group/cell -mx-3 mt-4 mb-4 rounded-lg border border-border-default bg-bg-primary overflow-hidden">
			<div className="flex items-center justify-between bg-bg-secondary pl-3 pr-4 border-b border-border-default h-10">
				<span className="text-sm font-medium text-text-secondary w-[70px] shrink-0 flex items-center gap-1.5">
					<Database className="size-4" />
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
					onChange={updateQuery}
					readOnly={isReadOnly}
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
						<div className="flex items-center gap-3">
							{duration !== undefined && (
								<span className="flex items-center text-text-secondary text-sm">
									<Timer className="size-4 mr-1" strokeWidth={1.5} />
									<span className="font-bold">{Math.round(duration)}</span>
									<span className="ml-1">ms</span>
								</span>
							)}
							{onResultChange && (
								<button
									type="button"
									onClick={() => {
										setResults(null);
										setError(null);
										setDuration(undefined);
										onResultChange(null);
									}}
									aria-label="Clear result"
									className="inline-flex items-center justify-center size-6 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary cursor-pointer"
								>
									<X className="size-4" />
								</button>
							)}
						</div>
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

type ViewDefinitionResource = {
	id: string;
	url?: string;
	name?: string;
	title?: string;
	description?: string;
	resource?: string;
};

type ViewRunResult =
	| { ok: true; rows: Record<string, unknown>[] }
	| { ok: false; error: string };

// A notebook cell references a resource either by canonical url or, when the
// resource has no url, by a relative "ResourceType/id" reference.
function refToId(
	type: "ViewDefinition" | "Library",
	ref: string,
): string | null {
	if (!ref || ref.includes("://")) return null;
	const m = ref.match(/^(\w+)\/(.+)$/);
	return m && m[1] === type && m[2] ? m[2] : null;
}

function useViewDefinitionByUrl(ref: string | null) {
	const client = useAidboxClient();
	return useQuery<ViewDefinitionResource | null>({
		queryKey: ["view-definition-by-url", ref],
		enabled: !!ref,
		staleTime: 60_000,
		queryFn: async () => {
			const id = refToId("ViewDefinition", ref ?? "");
			if (id) {
				try {
					const resp = await client.rawRequest({
						method: "GET",
						url: `/fhir/ViewDefinition/${encodeURIComponent(id)}`,
					});
					return (await resp.response.json()) as ViewDefinitionResource;
				} catch {
					return null;
				}
			}
			const resp = await client.rawRequest({
				method: "GET",
				url: `/fhir/ViewDefinition?url=${encodeURIComponent(ref ?? "")}&_count=1`,
			});
			const json = (await resp.response.json()) as {
				entry?: { resource: ViewDefinitionResource }[];
			};
			return json.entry?.[0]?.resource ?? null;
		},
	});
}

export function ViewDefinitionCellView({
	cell,
	onValueChange,
	onResultChange,
	readOnly,
}: {
	cell: Cell;
	onValueChange?: (value: string) => void;
	onResultChange?: (result: unknown) => void;
	readOnly?: boolean;
}) {
	const client = useAidboxClient();
	const isReadOnly = readOnly ?? !onValueChange;
	const editable = !isReadOnly;
	const url = cell.value ?? "";
	const { data: vd, isLoading: vdLoading } = useViewDefinitionByUrl(
		url ? url : null,
	);
	const initial = (cell.result as ViewRunResult | null) ?? null;
	const [result, setResult] = useState<ViewRunResult | null>(initial);
	const [loading, setLoading] = useState(false);

	const run = async () => {
		if (!vd?.id) return;
		setLoading(true);
		try {
			const resp = await client.rawRequest({
				method: "POST",
				url: `/fhir/ViewDefinition/${vd.id}/$run`,
				headers: {
					"Content-Type": "application/json",
					Accept: "application/fhir+json",
				},
				body: JSON.stringify({
					resourceType: "Parameters",
					parameter: [
						{ name: "_format", valueCode: "json" },
						{ name: "_limit", valueInteger: 1000 },
						{ name: "_page", valueInteger: 1 },
					],
				}),
			});
			const text = await resp.response.text();
			let next: ViewRunResult;
			try {
				const body = JSON.parse(text) as {
					data?: string;
					issue?: { diagnostics?: string }[];
				};
				if (body?.data) {
					const decoded = atob(body.data);
					const rows = JSON.parse(decoded) as Record<string, unknown>[];
					next = { ok: true, rows };
				} else {
					next = {
						ok: false,
						error:
							body.issue?.map((i) => i.diagnostics).join("\n") ??
							"Empty response",
					};
				}
			} catch {
				next = { ok: false, error: text };
			}
			setResult(next);
			onResultChange?.(next);
		} finally {
			setLoading(false);
		}
	};

	const clear = () => {
		setResult(null);
		onResultChange?.(null);
	};

	const label = vd?.title ?? vd?.name ?? vd?.id ?? "(unknown view)";
	const columns =
		result?.ok && result.rows.length > 0
			? Array.from(new Set(result.rows.flatMap((r) => Object.keys(r))))
			: [];

	return (
		<div className="group/cell -mx-3 mt-4 mb-4 rounded-lg border border-border-default bg-bg-primary overflow-hidden">
			<div className="flex items-center justify-between bg-bg-secondary pl-3 pr-4 border-b border-border-default h-10 gap-3">
				<div className="flex items-center gap-3 min-w-0">
					<span className="text-sm font-medium text-text-secondary w-[140px] shrink-0 flex items-center gap-1.5">
						<Table className="size-4" />
						ViewDefinition
					</span>
					{editable && (
						<NotebookResourcePicker
							value=""
							onChange={(v) => onValueChange?.(v)}
							kinds={["ViewDefinition"]}
							placeholder={url ? "Change…" : "Select view…"}
							className={url ? "max-w-[200px]" : "max-w-[500px]"}
						/>
					)}
				</div>
				<button
					type="button"
					disabled={loading || !vd?.id}
					onClick={() => void run()}
					className="flex items-center gap-2 text-text-info-primary typo-body uppercase hover:text-text-info-secondary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
				>
					{loading ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Play className="size-4 fill-current" />
					)}
					{loading ? "Running…" : "Run"}
				</button>
			</div>
			{url && (
				<div className="px-3 py-2 border-b border-border-default flex flex-col gap-0.5">
					{vdLoading ? (
						<HSComp.Skeleton className="h-4 w-40 rounded" />
					) : vd?.id ? (
						<Link
							to="/resource/$resourceType/edit/$id"
							params={{ resourceType: "ViewDefinition", id: vd.id }}
							search={{ tab: "edit", mode: "json", builderTab: "form" }}
							className="typo-body text-text-info-primary hover:underline truncate"
						>
							{label}
						</Link>
					) : (
						<span className="typo-body-xs text-text-tertiary truncate">
							Not found: {url}
						</span>
					)}
					{vd?.description && (
						<span className="typo-body-xs text-text-secondary">
							{vd.description}
						</span>
					)}
				</div>
			)}
			{result && (
				<>
					<div className="flex items-center justify-between bg-bg-secondary pl-3 pr-4 h-10 border-b border-border-default">
						<span className="text-sm font-medium text-text-secondary">
							Result
							{result.ok ? ` (${result.rows.length})` : " — error"}
						</span>
						{onResultChange && (
							<button
								type="button"
								onClick={clear}
								aria-label="Clear result"
								className="inline-flex items-center justify-center size-6 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary cursor-pointer"
							>
								<X className="size-4" />
							</button>
						)}
					</div>
					{result.ok ? (
						result.rows.length === 0 ? (
							<div className="px-3 py-3 typo-body-xs text-text-tertiary italic">
								No rows.
							</div>
						) : (
							<div className="max-h-[400px] overflow-auto">
								<HSComp.Table zebra stickyHeader className="typo-code">
									<HSComp.TableHeader>
										<HSComp.TableRow>
											{columns.map((c) => (
												<HSComp.TableHead key={c}>{c}</HSComp.TableHead>
											))}
										</HSComp.TableRow>
									</HSComp.TableHeader>
									<HSComp.TableBody>
										{result.rows.map((row, i) => (
											<HSComp.TableRow
												// biome-ignore lint/suspicious/noArrayIndexKey: result rows are positional
												key={`row-${i}`}
											>
												{columns.map((c) => (
													<HSComp.TableCell key={c}>
														{formatCellValue(row[c])}
													</HSComp.TableCell>
												))}
											</HSComp.TableRow>
										))}
									</HSComp.TableBody>
								</HSComp.Table>
							</div>
						)
					) : (
						<pre className="px-3 py-2 typo-code whitespace-pre-wrap text-critical-default">
							{result.error}
						</pre>
					)}
				</>
			)}
		</div>
	);
}

function formatCellValue(v: unknown): string {
	if (v === null || v === undefined) return "";
	if (typeof v === "object") return JSON.stringify(v);
	return String(v);
}

type LibraryParameter = {
	name?: string;
	type?: string;
	use?: string;
	min?: number;
	max?: string;
};

type LibraryResource = {
	id: string;
	url?: string;
	name?: string;
	title?: string;
	description?: string;
	parameter?: LibraryParameter[];
};

type SqlQueryRunResult =
	| { ok: true; columns: string[]; rows: unknown[][] }
	| { ok: false; error: string };

function useLibraryByUrl(ref: string | null) {
	const client = useAidboxClient();
	return useQuery<LibraryResource | null>({
		queryKey: ["sqlquery-library-by-url", ref],
		enabled: !!ref,
		staleTime: 60_000,
		queryFn: async () => {
			const id = refToId("Library", ref ?? "");
			if (id) {
				try {
					const resp = await client.rawRequest({
						method: "GET",
						url: `/fhir/Library/${encodeURIComponent(id)}`,
					});
					return (await resp.response.json()) as LibraryResource;
				} catch {
					return null;
				}
			}
			const resp = await client.rawRequest({
				method: "GET",
				url: `/fhir/Library?url=${encodeURIComponent(ref ?? "")}&_count=1`,
			});
			const json = (await resp.response.json()) as {
				entry?: { resource: LibraryResource }[];
			};
			return json.entry?.[0]?.resource ?? null;
		},
	});
}

function buildParamValue(
	value: string,
	type: string | undefined,
): Record<string, unknown> {
	const t = (type ?? "string").toLowerCase();
	if (t === "integer" || t === "positiveint" || t === "unsignedint") {
		const n = Number.parseInt(value, 10);
		return { valueInteger: Number.isFinite(n) ? n : 0 };
	}
	if (t === "decimal") {
		const n = Number.parseFloat(value);
		return { valueDecimal: Number.isFinite(n) ? n : 0 };
	}
	if (t === "boolean") return { valueBoolean: value === "true" };
	if (t === "code") return { valueCode: value };
	return { valueString: value };
}

type ParamPart = { name?: string; [k: string]: unknown };
type ParamsResp = {
	parameter?: { name?: string; part?: ParamPart[] }[];
	issue?: { diagnostics?: string }[];
};

function getPartValue(part: ParamPart): unknown {
	for (const key of Object.keys(part)) {
		if (key.startsWith("value")) return part[key];
	}
	return null;
}

function parseSqlQueryResponse(body: ParamsResp): SqlQueryRunResult {
	if (body.issue?.length)
		return {
			ok: false,
			error: body.issue.map((i) => i.diagnostics).join("\n"),
		};
	const rowParams = (body.parameter ?? []).filter((p) => p.name === "row");
	const columns: string[] = [];
	const seen = new Set<string>();
	for (const rp of rowParams) {
		for (const part of rp.part ?? []) {
			if (part.name && !seen.has(part.name)) {
				seen.add(part.name);
				columns.push(part.name);
			}
		}
	}
	const rows = rowParams.map((rp) => {
		const byName = new Map<string, unknown>();
		for (const part of rp.part ?? []) {
			if (part.name) byName.set(part.name, getPartValue(part));
		}
		return columns.map((c) => byName.get(c) ?? null);
	});
	return { ok: true, columns, rows };
}

function parseSqlQueryCellValue(raw: string): {
	url: string;
	params: Record<string, string>;
} {
	const trimmed = (raw ?? "").trim();
	if (!trimmed) return { url: "", params: {} };
	if (trimmed.startsWith("{")) {
		try {
			const obj = JSON.parse(trimmed) as {
				url?: string;
				params?: Record<string, string>;
			};
			return { url: obj.url ?? "", params: obj.params ?? {} };
		} catch {
			return { url: trimmed, params: {} };
		}
	}
	return { url: trimmed, params: {} };
}

function stringifySqlQueryCellValue(
	url: string,
	params: Record<string, string>,
): string {
	const nonEmpty: Record<string, string> = {};
	for (const [k, v] of Object.entries(params)) {
		if (v !== "") nonEmpty[k] = v;
	}
	if (Object.keys(nonEmpty).length === 0) return url;
	return JSON.stringify({ url, params: nonEmpty });
}

export function SqlQueryCellView({
	cell,
	onValueChange,
	onResultChange,
	readOnly,
}: {
	cell: Cell;
	onValueChange?: (value: string) => void;
	onResultChange?: (result: unknown) => void;
	readOnly?: boolean;
}) {
	const client = useAidboxClient();
	const isReadOnly = readOnly ?? !onValueChange;
	const editable = !isReadOnly;
	const parsed = parseSqlQueryCellValue(cell.value ?? "");
	const url = parsed.url;
	const { data: lib, isLoading: libLoading } = useLibraryByUrl(
		url ? url : null,
	);
	const inputParams = (lib?.parameter ?? []).filter(
		(p) => (p.use ?? "in") === "in" && p.name,
	);
	const [paramValues, setParamValues] = useState<Record<string, string>>(
		parsed.params,
	);
	const initial = (cell.result as SqlQueryRunResult | null) ?? null;
	const [result, setResult] = useState<SqlQueryRunResult | null>(initial);
	const [loading, setLoading] = useState(false);

	const run = async () => {
		if (!lib?.id) return;
		setLoading(true);
		try {
			const parameterEntries: Record<string, unknown>[] = [
				{ name: "_format", valueCode: "fhir" },
			];
			const filled = inputParams
				.filter((p) => p.name && paramValues[p.name])
				.map((p) => ({
					name: p.name,
					...buildParamValue(paramValues[p.name ?? ""] ?? "", p.type),
				}));
			if (filled.length > 0) {
				parameterEntries.push({
					name: "parameters",
					resource: { resourceType: "Parameters", parameter: filled },
				});
			}
			const resp = await client.rawRequest({
				method: "POST",
				url: `/fhir/Library/${lib.id}/$sqlquery-run`,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					resourceType: "Parameters",
					parameter: parameterEntries,
				}),
			});
			const text = await resp.response.text();
			let next: SqlQueryRunResult;
			try {
				const body = JSON.parse(text) as ParamsResp;
				next = parseSqlQueryResponse(body);
			} catch {
				next = { ok: false, error: text };
			}
			setResult(next);
			onResultChange?.(next);
		} finally {
			setLoading(false);
		}
	};

	const clear = () => {
		setResult(null);
		onResultChange?.(null);
	};

	const label = lib?.title ?? lib?.name ?? lib?.id ?? "(unknown query)";

	return (
		<div className="group/cell -mx-3 mt-4 mb-4 rounded-lg border border-border-default bg-bg-primary overflow-hidden">
			<div className="flex items-center justify-between bg-bg-secondary pl-3 pr-4 border-b border-border-default h-10 gap-3">
				<div className="flex items-center gap-3 min-w-0">
					<span className="text-sm font-medium text-text-secondary w-[140px] shrink-0 flex items-center gap-1.5">
						<FileCode className="size-4" />
						SQLQuery
					</span>
					{editable && (
						<NotebookResourcePicker
							value=""
							onChange={(v) => {
								setParamValues({});
								onValueChange?.(v);
							}}
							kinds={["SQLQuery"]}
							placeholder={url ? "Change…" : "Select query…"}
							className={url ? "max-w-[200px]" : "max-w-[500px]"}
						/>
					)}
				</div>
				<button
					type="button"
					disabled={loading || !lib?.id}
					onClick={() => void run()}
					className="flex items-center gap-2 text-text-info-primary typo-body uppercase hover:text-text-info-secondary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
				>
					{loading ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Play className="size-4 fill-current" />
					)}
					{loading ? "Running…" : "Run"}
				</button>
			</div>
			{url && (
				<div className="px-3 py-2 border-b border-border-default flex flex-col gap-0.5">
					{libLoading ? (
						<HSComp.Skeleton className="h-4 w-40 rounded" />
					) : lib?.id ? (
						<Link
							to="/resource/$resourceType/edit/$id"
							params={{ resourceType: "Library", id: lib.id }}
							search={{ tab: "edit", mode: "json", builderTab: "form" }}
							className="typo-body text-text-info-primary hover:underline truncate"
						>
							{label}
						</Link>
					) : (
						<span className="typo-body-xs text-text-tertiary truncate">
							Not found: {url}
						</span>
					)}
					{lib?.description && (
						<span className="typo-body-xs text-text-secondary">
							{lib.description}
						</span>
					)}
				</div>
			)}
			{inputParams.length > 0 && (
				<div className="px-3 pt-2 pb-4 border-b border-border-default flex flex-col gap-1.5">
					<span className="typo-label-tiny uppercase tracking-wide text-text-tertiary">
						Parameters
					</span>
					{inputParams.map((p) => {
						const key = p.name ?? "";
						return (
							<div key={key} className="flex flex-col gap-0.5">
								<label
									htmlFor={`sqlq-${key}`}
									className="typo-label-tiny uppercase tracking-wide text-text-tertiary"
								>
									{key}
								</label>
								<input
									id={`sqlq-${key}`}
									value={paramValues[key] ?? ""}
									disabled={isReadOnly}
									onChange={(e) => {
										const next = {
											...paramValues,
											[key]: e.target.value,
										};
										setParamValues(next);
										onValueChange?.(stringifySqlQueryCellValue(url, next));
									}}
									placeholder={p.type ?? "string"}
									className="w-full px-2 py-1 typo-code border border-border-default rounded text-text-primary bg-bg-primary outline-none focus:border-border-info-primary"
								/>
							</div>
						);
					})}
				</div>
			)}
			{result && (
				<>
					<div className="flex items-center justify-between bg-bg-secondary pl-3 pr-4 h-10 border-b border-border-default">
						<span className="text-sm font-medium text-text-secondary">
							Result
							{result.ok ? ` (${result.rows.length})` : " — error"}
						</span>
						{onResultChange && (
							<button
								type="button"
								onClick={clear}
								aria-label="Clear result"
								className="inline-flex items-center justify-center size-6 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary cursor-pointer"
							>
								<X className="size-4" />
							</button>
						)}
					</div>
					{result.ok ? (
						result.rows.length === 0 ? (
							<div className="px-3 py-3 typo-body-xs text-text-tertiary italic">
								No rows.
							</div>
						) : (
							<div className="max-h-[400px] overflow-auto">
								<HSComp.Table zebra stickyHeader className="typo-code">
									<HSComp.TableHeader>
										<HSComp.TableRow>
											{result.columns.map((c) => (
												<HSComp.TableHead key={c}>{c}</HSComp.TableHead>
											))}
										</HSComp.TableRow>
									</HSComp.TableHeader>
									<HSComp.TableBody>
										{result.rows.map((row, i) => (
											<HSComp.TableRow
												// biome-ignore lint/suspicious/noArrayIndexKey: result rows are positional
												key={`row-${i}`}
											>
												{row.map((cellVal, j) => (
													<HSComp.TableCell
														// biome-ignore lint/suspicious/noArrayIndexKey: column order matches schema
														key={`${i}-${j}`}
													>
														{formatCellValue(cellVal)}
													</HSComp.TableCell>
												))}
											</HSComp.TableRow>
										))}
									</HSComp.TableBody>
								</HSComp.Table>
							</div>
						)
					) : (
						<pre className="px-3 py-2 typo-code whitespace-pre-wrap text-critical-default">
							{result.error}
						</pre>
					)}
				</>
			)}
		</div>
	);
}

export function CellView({ cell }: { cell: Cell }) {
	const type = cell.type ?? "rest";
	if (type === "rest" || type === "rpc") {
		return <RestCellView cell={cell} readOnly />;
	}
	if (type === "sql") {
		return <SqlCellView cell={cell} readOnly />;
	}
	if (type === "view-definition") {
		return <ViewDefinitionCellView cell={cell} readOnly />;
	}
	if (type === "sql-query") {
		return <SqlQueryCellView cell={cell} readOnly />;
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

function notebookForExport(notebook: Notebook): Record<string, unknown> {
	const cleaned: Record<string, unknown> = {
		...(notebook as unknown as Record<string, unknown>),
	};
	delete cleaned["edit-secret"];
	delete cleaned["publication-id"];
	delete cleaned.origin;
	delete cleaned.source;
	const tags = cleaned.tags as { type?: string; value?: unknown[] } | undefined;
	if (tags && Array.isArray(tags.value)) {
		cleaned.tags = {
			...tags,
			value: tags.value.filter(
				(v) => typeof v !== "string" || v.toLowerCase() !== "community",
			),
		};
	}
	return cleaned;
}

function notebookForCopy(notebook: Notebook): Record<string, unknown> {
	const cleaned = notebookForExport(notebook);
	delete cleaned.id;
	delete cleaned.meta;
	// The community view delivers tags as a plain array (["Community"]);
	// notebookForExport only strips the {value:[]} shape, so handle the array here.
	const tags = cleaned.tags;
	if (Array.isArray(tags)) {
		const filtered = tags.filter(
			(v) => typeof v !== "string" || v.toLowerCase() !== "community",
		);
		if (filtered.length > 0) cleaned.tags = filtered;
		else delete cleaned.tags;
	}
	const trimmed = notebook.name?.trim();
	const base = trimmed && trimmed.length > 0 ? trimmed : "Untitled notebook";
	cleaned.name = base.startsWith("Copy of ") ? base : `Copy of ${base}`;
	return cleaned;
}

function collectDocumentCss(): string {
	const rules: string[] = [];
	for (const sheet of Array.from(document.styleSheets)) {
		try {
			for (const rule of Array.from(sheet.cssRules)) {
				rules.push(rule.cssText);
			}
		} catch {
			// cross-origin sheet — skip
		}
	}
	return rules.join("\n");
}

function downloadNotebookHtml(notebook: Notebook): void {
	const root = document.getElementById("nb-container");
	const wrapper = root?.parentElement;
	if (!root || !wrapper) throw new Error("nb-container not found");
	const clone = wrapper.cloneNode(true) as HTMLElement;
	clone
		.querySelectorAll<HTMLElement>("[data-export-skip]")
		.forEach((el) => el.remove());
	const css = collectDocumentCss();
	const data = encodeURIComponent(JSON.stringify(notebook));
	const title = notebook.name ?? "notebook";
	const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head>
<body><data value="${data}"></data>${clone.outerHTML}</body>
</html>`;
	const blob = new Blob([html], { type: "text/html" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${title}.html`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

function ShareButton({ notebook }: { notebook: Notebook }) {
	const client = useAidboxClient();
	const [copied, setCopied] = useState(false);
	const linkMut = useMutation<string, Error>({
		mutationFn: async () => {
			const body = {
				method: "aidbox.notebooks/export-notebook",
				params: { notebook: notebookForExport(notebook) },
			};
			const resp = await client.rawRequest({
				method: "POST",
				url: `/rpc?_m=${body.method}`,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const json = (await resp.response.json()) as {
				result?: { notebook?: { "import-url"?: string } };
				error?: { message?: string };
			};
			const url = json.result?.notebook?.["import-url"];
			if (!url) throw new Error(json.error?.message ?? "No import-url");
			await copyToClipboard(url);
			return url;
		},
		onSuccess: () => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		},
	});
	const shareAsFile = () => {
		void client
			.rawRequest({
				method: "POST",
				url: "/rpc?_m=aidbox.notebooks/export-notebook-by-file",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					method: "aidbox.notebooks/export-notebook-by-file",
					params: {},
				}),
			})
			.catch(() => undefined);
		downloadNotebookHtml(notebook);
	};
	const Icon = linkMut.isPending ? Loader2 : copied ? Check : Share2;
	return (
		<HSComp.DropdownMenu>
			<HSComp.DropdownMenuTrigger asChild>
				<HSComp.Button
					variant="ghost"
					size="small"
					className="px-0!"
					disabled={linkMut.isPending}
				>
					<Icon
						className={
							linkMut.isPending
								? "size-4 animate-spin"
								: copied
									? "size-4 text-text-success-primary"
									: "size-4"
						}
					/>
					{copied ? "Copied" : "Share"}
					<ChevronDown className="size-3.5" />
				</HSComp.Button>
			</HSComp.DropdownMenuTrigger>
			<HSComp.DropdownMenuContent align="end">
				<HSComp.DropdownMenuItem onClick={() => linkMut.mutate()}>
					<Link2 className="size-4 text-text-info-primary" />
					As link
				</HSComp.DropdownMenuItem>
				<HSComp.DropdownMenuItem onClick={shareAsFile}>
					<FileDown className="size-4 text-text-info-primary" />
					As file
				</HSComp.DropdownMenuItem>
			</HSComp.DropdownMenuContent>
		</HSComp.DropdownMenu>
	);
}

function CopyNotebookButton({ notebook }: { notebook: Notebook }) {
	const client = useAidboxClient();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const mut = useMutation<{ id: string }, Error>({
		mutationFn: async () => {
			const body = {
				method: "aidbox.notebooks/save-notebook",
				params: { notebook: notebookForCopy(notebook) },
			};
			const resp = await client.rawRequest({
				method: "POST",
				url: `/rpc?_m=${body.method}`,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const json = (await resp.response.json()) as {
				result?: { notebook?: { id?: string } };
				error?: { message?: string };
			};
			const id = json.result?.notebook?.id;
			if (!id) throw new Error(json.error?.message ?? "Copy failed");
			return { id };
		},
		onSuccess: ({ id }) => {
			void queryClient.invalidateQueries({ queryKey: ["notebooks-list"] });
			HSComp.toast.success("Copied to your notebooks");
			void navigate({ to: "/notebooks/$id/edit", params: { id } });
		},
		onError: (e) => HSComp.toast.error(e.message),
	});
	return (
		<HSComp.Button
			variant="ghost"
			size="small"
			className="px-0! text-text-link"
			disabled={mut.isPending}
			onClick={() => mut.mutate()}
		>
			{mut.isPending ? (
				<Loader2 className="size-4 animate-spin" />
			) : (
				<Copy className="size-4" />
			)}
			Save a copy
		</HSComp.Button>
	);
}

function DeleteNotebookButton({ notebook }: { notebook: Notebook }) {
	const client = useAidboxClient();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const mut = useMutation<void, Error>({
		mutationFn: async () => {
			if (notebook["publication-id"]) {
				try {
					await client.rawRequest({
						method: "POST",
						url: "/rpc?_m=aidbox.notebooks/delete-published-notebook",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							method: "aidbox.notebooks/delete-published-notebook",
							params: { notebook },
						}),
					});
				} catch {
					// best-effort: continue with local delete even if unpublish failed
				}
			}
			const resp = await fetch(
				`${client.getBaseUrl()}/Notebook/${notebook.id}`,
				{
					method: "DELETE",
					credentials: "include",
				},
			);
			if (!resp.ok && resp.status !== 404)
				throw new Error(`Delete failed: ${resp.status}`);
		},
		onSuccess: () => {
			void navigate({ to: "/notebooks" });
		},
	});
	return (
		<>
			<HSComp.Button
				variant="ghost"
				size="small"
				className="px-0!"
				disabled={mut.isPending}
				onClick={() => setOpen(true)}
			>
				{mut.isPending ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<Trash2 className="size-4" />
				)}
				Delete
			</HSComp.Button>
			<ConfirmDialog
				open={open}
				onOpenChange={setOpen}
				title="Delete notebook"
				description="This will permanently remove the notebook. This cannot be undone."
				confirmLabel="Delete"
				danger
				onConfirm={() => mut.mutate()}
			/>
		</>
	);
}

function PublishButtons({
	notebook,
	queryKey,
}: {
	notebook: Notebook;
	queryKey: readonly unknown[];
}) {
	const client = useAidboxClient();
	const queryClient = useQueryClient();
	const [publishOpen, setPublishOpen] = useState(false);
	const [unpublishOpen, setUnpublishOpen] = useState(false);

	const isPublished = !!notebook["publication-id"];

	const publishMut = useMutation<Notebook, Error>({
		mutationFn: async () => {
			const body = {
				method: "aidbox.notebooks/publish-notebook",
				params: { notebook },
			};
			const resp = await client.rawRequest({
				method: "POST",
				url: `/rpc?_m=${body.method}`,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const json = (await resp.response.json()) as {
				result?: { notebook?: Notebook };
				error?: { message?: string };
			};
			const saved = json.result?.notebook;
			if (!saved) throw new Error(json.error?.message ?? "publish failed");
			return saved;
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey });
		},
	});

	const unpublishMut = useMutation<void, Error>({
		mutationFn: async () => {
			const delResp = await client.rawRequest({
				method: "POST",
				url: "/rpc?_m=aidbox.notebooks/delete-published-notebook",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					method: "aidbox.notebooks/delete-published-notebook",
					params: { notebook },
				}),
			});
			const delJson = (await delResp.response.json()) as {
				error?: { message?: string };
			};
			if (delJson.error)
				throw new Error(delJson.error.message ?? "unpublish failed");
			const cleaned: Record<string, unknown> = {
				...(notebook as unknown as Record<string, unknown>),
			};
			delete cleaned["publication-id"];
			delete cleaned["edit-secret"];
			delete cleaned.origin;
			await client.rawRequest({
				method: "POST",
				url: "/rpc?_m=aidbox.notebooks/save-notebook",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					method: "aidbox.notebooks/save-notebook",
					params: { notebook: cleaned },
				}),
			});
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey });
		},
	});

	const publishDisabled = !notebook.name?.trim() || publishMut.isPending;

	return (
		<>
			{isPublished ? (
				<HSComp.Button
					variant="ghost"
					size="small"
					className="px-0!"
					disabled={unpublishMut.isPending}
					onClick={() => setUnpublishOpen(true)}
				>
					{unpublishMut.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<GlobeOff className="size-4" />
					)}
					Unpublish
				</HSComp.Button>
			) : (
				<HSComp.Button
					variant="ghost"
					size="small"
					className="px-0!"
					disabled={publishDisabled}
					onClick={() => setPublishOpen(true)}
				>
					{publishMut.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Globe className="size-4" />
					)}
					Publish
				</HSComp.Button>
			)}
			<ConfirmDialog
				open={publishOpen}
				onOpenChange={setPublishOpen}
				title="Publish notebook?"
				description="The notebook will become available to all Aidbox users through a shareable link."
				confirmLabel="Publish"
				onConfirm={() => publishMut.mutate()}
			/>
			<ConfirmDialog
				open={unpublishOpen}
				onOpenChange={setUnpublishOpen}
				title="Unpublish notebook?"
				description="Other Aidbox users will no longer be able to access this notebook."
				confirmLabel="Unpublish"
				danger
				onConfirm={() => unpublishMut.mutate()}
			/>
		</>
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
			{notebook && (
				<div
					className="flex items-center bg-bg-secondary flex-none h-10 border-b border-border-default"
					data-export-skip
				>
					<div className="mx-auto max-w-[990px] w-full flex items-center gap-4 px-8">
						{canEdit ? (
							<>
								<Link to="/notebooks/$id/edit" params={{ id: notebook.id }}>
									<HSComp.Button
										variant="ghost"
										size="small"
										className="px-0! text-text-link"
									>
										<Pencil className="size-4" />
										Edit
									</HSComp.Button>
								</Link>
								<PublishButtons
									notebook={notebook}
									queryKey={["notebook", id, path ?? null]}
								/>
								<DeleteNotebookButton notebook={notebook} />
								<ShareButton notebook={notebook} />
							</>
						) : (
							<>
								<CopyNotebookButton notebook={notebook} />
								<ShareButton notebook={notebook} />
							</>
						)}
					</div>
				</div>
			)}
			<div className="flex-1 min-h-0 overflow-y-auto pb-[400px]">
				<div className="mx-auto max-w-[990px] px-8 py-8">
					{isLoading ? null : !notebook ? (
						<div className="typo-body text-text-tertiary italic">
							Notebook not found.
						</div>
					) : (
						<div id="nb-container" className="flex flex-col">
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
								<h1 className="typo-page-header text-text-primary">
									{notebook.name ?? "(unnamed)"}
								</h1>
								<p className="typo-body text-text-secondary">
									{notebook.description || " "}
								</p>
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
