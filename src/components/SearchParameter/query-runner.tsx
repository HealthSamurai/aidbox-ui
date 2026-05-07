import type * as AidboxTypes from "@health-samurai/aidbox-client";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import * as React from "react";
import { format as formatSQL } from "sql-formatter";
import type { AidboxClientR5 } from "../../AidboxClient";
import { type Header, methodColors } from "../rest/active-tabs";
import { UrlAutocomplete } from "../rest/url-autocomplete";

// SP query runner is GET-only — testing a SearchParameter is always a search.
const METHOD = "GET" as const;
type ResponseTab = "body" | "headers" | "raw" | "explain";

type ExplainResponse = {
	query?: [string, ...unknown[]];
	"query-inline"?: [string];
	plan?: string;
};

function isSearchRequest(path: string): boolean {
	const pathWithoutQuery = (path || "/").split("?")[0] || "/";
	const normalized = pathWithoutQuery.replace(/\/+$/, "");
	const segments = normalized.split("/").filter(Boolean);
	if (segments.length === 0) return true;
	const lastSegment = segments[segments.length - 1] || "";
	// Resource-type segments start uppercase; instance ids start lowercase / are uuids.
	return /^[A-Z]/.test(lastSegment);
}

function formatSQLQuery(sql: string): string {
	try {
		return formatSQL(sql, {
			language: "postgresql",
			keywordCase: "upper",
			indentStyle: "tabularRight",
			linesBetweenQueries: 2,
			paramTypes: { custom: [{ regex: "\\{[a-zA-Z0-9_]+\\}" }] },
		});
	} catch {
		return sql;
	}
}

const ExplainView = ({
	client,
	path,
	headers,
	sendVersion,
}: {
	client: AidboxClientR5;
	path: string;
	headers: Header[];
	sendVersion: number;
}) => {
	// Re-run only when the user clicks Send (sendVersion bumps), not on every
	// keystroke in the URL input. Same gating as REST Console — see
	// `routes/rest.tsx` ExplainView's queryKey.
	const { isLoading, data, error } = useQuery({
		queryKey: ["sp-builder-explain", sendVersion],
		enabled: sendVersion > 0,
		queryFn: async (): Promise<ExplainResponse> => {
			const reqHeaders: Record<string, string> = {};
			for (const h of headers) {
				if ((h.enabled ?? true) && h.name) reqHeaders[h.name] = h.value;
			}
			reqHeaders.Accept = "application/json";
			const basePath = path || "/";
			const explainUrl = `${basePath}${basePath.includes("?") ? "&" : "?"}_explain=analyze`;
			const response = await client.rawRequest({
				method: METHOD,
				url: explainUrl,
				headers: reqHeaders,
			});
			return response.response.json();
		},
		retry: false,
		refetchOnWindowFocus: false,
	});

	if (sendVersion === 0) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary bg-bg-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">No request yet</div>
					<div className="text-sm">Send a request to see the query plan.</div>
				</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary bg-bg-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Loading...</div>
					<div className="text-sm">Running EXPLAIN ANALYZE</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary bg-bg-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Error running explain</div>
					<div className="text-sm text-text-danger">
						{error instanceof Error ? error.message : "Unknown error"}
					</div>
				</div>
			</div>
		);
	}

	if (!data) return null;

	const querySQL = data.query?.[0] ? formatSQLQuery(data.query[0]) : "";
	const queryParams = data.query?.slice(1) ?? [];
	const inlineSQL = data["query-inline"]?.[0]
		? formatSQLQuery(data["query-inline"][0])
		: "";
	const plan = data.plan ?? "";

	if (!querySQL && !inlineSQL && !plan) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary bg-bg-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Explain not available</div>
					<div className="text-sm">
						The explain operation is not supported for non-search requests.
					</div>
				</div>
			</div>
		);
	}

	const defaultSubTab = inlineSQL ? "query" : querySQL ? "statement" : "plan";

	return (
		<HSComp.Tabs
			variant="tertiary"
			defaultValue={defaultSubTab}
			className="flex flex-col grow min-h-0"
		>
			<div className="flex items-center bg-bg-secondary h-10 border-b shrink-0">
				<HSComp.TabsList className="py-0! border-b-0!">
					{inlineSQL ? (
						<HSComp.TabsTrigger value="query">Query</HSComp.TabsTrigger>
					) : null}
					{querySQL ? (
						<HSComp.TabsTrigger value="statement">Statement</HSComp.TabsTrigger>
					) : null}
					{plan ? (
						<HSComp.TabsTrigger value="plan">Execution Plan</HSComp.TabsTrigger>
					) : null}
				</HSComp.TabsList>
			</div>
			{inlineSQL ? (
				<HSComp.TabsContent value="query" className="grow min-h-0">
					<HSComp.CodeEditor
						readOnly
						isReadOnlyTheme
						currentValue={inlineSQL}
						mode="sql"
					/>
				</HSComp.TabsContent>
			) : null}
			{querySQL ? (
				<HSComp.TabsContent value="statement" className="grow min-h-0">
					{queryParams.length > 0 ? (
						<HSComp.ResizablePanelGroup direction="vertical">
							<HSComp.ResizablePanel minSize={20}>
								<HSComp.CodeEditor
									readOnly
									isReadOnlyTheme
									currentValue={querySQL}
									mode="sql"
								/>
							</HSComp.ResizablePanel>
							<HSComp.ResizableHandle />
							<HSComp.ResizablePanel defaultSize={30} minSize={10}>
								<div className="px-4 py-2 bg-bg-primary h-full overflow-auto">
									<div className="typo-body-xs text-text-secondary mb-1">
										Parameters:
									</div>
									<ol className="font-mono text-[12px] text-text-secondary list-decimal list-inside">
										{queryParams.map((param, i) => (
											<li key={`${i}-${String(param)}`}>{String(param)}</li>
										))}
									</ol>
								</div>
							</HSComp.ResizablePanel>
						</HSComp.ResizablePanelGroup>
					) : (
						<HSComp.CodeEditor
							readOnly
							isReadOnlyTheme
							currentValue={querySQL}
							mode="sql"
						/>
					)}
				</HSComp.TabsContent>
			) : null}
			{plan ? (
				<HSComp.TabsContent
					value="plan"
					className="grow min-h-0 overflow-auto bg-bg-primary"
				>
					<pre className="p-4 typo-code text-text-primary whitespace-pre">
						{plan}
					</pre>
				</HSComp.TabsContent>
			) : null}
		</HSComp.Tabs>
	);
};

interface ResponseData {
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body: string;
	duration: number;
	mode: "json" | "yaml";
}

const DEFAULT_HEADERS: Header[] = [
	{ id: "1", name: "Content-Type", value: "application/json", enabled: true },
	{ id: "2", name: "Accept", value: "application/json", enabled: true },
];

function buildPrefix(base?: string, code?: string): string | null {
	if (!base || !code) return null;
	return `/fhir/${base}?${code}=`;
}

async function executeRequest(
	path: string,
	headers: Header[],
	client: AidboxClientR5,
): Promise<ResponseData> {
	const reqHeaders: Record<string, string> = {};
	for (const h of headers) {
		if ((h.enabled ?? true) && h.name) reqHeaders[h.name] = h.value;
	}
	const acceptHeader = headers.find(
		(h) => h.name?.toLowerCase() === "accept" && (h.enabled ?? true),
	);
	const responseMode: "json" | "yaml" =
		acceptHeader?.value?.toLowerCase().trim() === "text/yaml" ? "yaml" : "json";

	try {
		const response: AidboxTypes.ResponseWithMeta = await client.rawRequest({
			method: METHOD,
			url: path || "/",
			headers: reqHeaders,
		});
		return {
			status: response.response.status,
			statusText: response.response.statusText,
			headers: response.responseHeaders,
			body: (await response.response.text()) as string,
			duration: response.duration,
			mode: responseMode,
		};
	} catch (error) {
		const cause = (error as AidboxTypes.ErrorResponse)?.responseWithMeta;
		if (!cause?.response) {
			return {
				status: 0,
				statusText: error instanceof Error ? error.message : "Unknown error",
				headers: {},
				body: "",
				duration: 0,
				mode: responseMode,
			};
		}
		const errorMode =
			cause.responseHeaders?.["content-type"]?.toLowerCase().trim() ===
			"text/yaml"
				? "yaml"
				: "json";
		return {
			status: cause.response.status,
			statusText: cause.response.statusText,
			headers: cause.responseHeaders ?? {},
			body: (await cause.response.text()) as string,
			duration: cause.duration,
			mode: errorMode,
		};
	}
}

const StatusBadge = ({ status }: { status: number }) => {
	const color =
		status >= 200 && status < 300
			? "text-utility-green"
			: status >= 300 && status < 400
				? "text-utility-blue"
				: status >= 400
					? "text-utility-red"
					: "text-text-secondary";
	return <span className={`typo-label-xs ${color}`}>{status || "—"}</span>;
};

const tryFormat = (body: string, mode: "json" | "yaml"): string => {
	if (mode !== "json") return body;
	try {
		return JSON.stringify(JSON.parse(body), null, 2);
	} catch {
		return body;
	}
};

const formatHeaders = (headers: Record<string, string>): string =>
	Object.entries(headers)
		.map(([k, v]) => `${k}: ${v}`)
		.join("\n");

const formatRaw = (response: ResponseData): string => {
	const statusLine = `HTTP/1.1 ${response.status} ${response.statusText}`;
	const headerLines = formatHeaders(response.headers);
	const body = tryFormat(response.body, response.mode);
	return `${statusLine}\n${headerLines}\n\n${body}`;
};

export const QueryRunner = ({
	client,
	base,
	code,
}: {
	client: AidboxClientR5;
	base?: string;
	code?: string;
}) => {
	// Lock the SP prefix into the GET box so the user can only fill in the
	// value after `=`. Falls back to a free-form URL input until both `base`
	// and `code` are set.
	const prefix = React.useMemo(() => buildPrefix(base, code), [base, code]);

	const [value, setValue] = React.useState<string>("");
	const [freePath, setFreePath] = React.useState<string>("/fhir/Patient");
	const [headers] = React.useState<Header[]>(DEFAULT_HEADERS);
	const [response, setResponse] = React.useState<ResponseData | null>(null);
	const [isLoading, setIsLoading] = React.useState(false);
	const [sendVersion, setSendVersion] = React.useState(0);
	const [activeResponseTab, setActiveResponseTab] =
		React.useState<ResponseTab>("body");

	const path = prefix ? `${prefix}${value}` : freePath;

	const send = React.useCallback(async () => {
		setIsLoading(true);
		setSendVersion((v) => v + 1);
		try {
			const resp = await executeRequest(path, headers, client);
			setResponse(resp);
		} finally {
			setIsLoading(false);
		}
	}, [path, headers, client]);

	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				void send();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [send]);

	const responseBody = response ? tryFormat(response.body, response.mode) : "";
	const explainEnabled = isSearchRequest(path);

	return (
		<div className="flex flex-col h-full">
			{/* Request line */}
			<div className="px-4 py-3 flex items-center border-b gap-2 shrink-0">
				{prefix ? (
					<div className="flex w-full">
						<div
							role="img"
							aria-label={`${METHOD} ${prefix}`}
							className="flex h-9 items-center px-3 py-2 border border-r-0 border-border-primary rounded-md rounded-r-none typo-label gap-2 select-none shrink-0"
						>
							<span className="text-utility-green">{METHOD}</span>
							<span className="text-text-secondary typo-code">{prefix}</span>
						</div>
						<HSComp.Input
							className="rounded-l-none"
							placeholder="value"
							value={value}
							onChange={(e) => setValue(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									void send();
								}
							}}
						/>
					</div>
				) : (
					<UrlAutocomplete
						path={freePath}
						method={METHOD}
						onSelectSuggestion={(p) => setFreePath(p)}
						onSubmit={send}
					>
						<div className="flex w-full">
							<span
								className="flex h-9 items-center justify-start px-3 py-2 border border-r-0 border-border-primary rounded-md rounded-r-none typo-label w-26 text-utility-green select-none shrink-0"
								aria-hidden
							>
								{METHOD}
							</span>
							<HSComp.Input
								className="rounded-l-none"
								placeholder="Set the SP's base and code, or enter a URL here"
								value={freePath}
								onChange={(e) => setFreePath(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										void send();
									}
								}}
							/>
						</div>
					</UrlAutocomplete>
				)}
				<HSComp.Tooltip delayDuration={600}>
					<HSComp.TooltipTrigger asChild>
						<HSComp.Button
							variant="primary"
							onClick={send}
							disabled={isLoading}
						>
							<Lucide.PlayIcon size={14} />
							Send
						</HSComp.Button>
					</HSComp.TooltipTrigger>
					<HSComp.TooltipContent>
						Send request (Ctrl+Enter / ⌘+Enter)
					</HSComp.TooltipContent>
				</HSComp.Tooltip>
			</div>

			{/* Response panel — REST-Console-style */}
			<HSComp.Tabs
				value={activeResponseTab}
				onValueChange={(v) => setActiveResponseTab(v as ResponseTab)}
				className="flex flex-col grow min-h-0"
			>
				<div className="flex items-center justify-between bg-bg-secondary px-4 border-b h-10 shrink-0">
					<div className="flex items-center">
						<span className="typo-label text-text-secondary pr-3">
							Response:
						</span>
						<HSComp.TabsList>
							<HSComp.TabsTrigger value="body">Body</HSComp.TabsTrigger>
							<HSComp.TabsTrigger value="headers">Headers</HSComp.TabsTrigger>
							<HSComp.TabsTrigger value="raw">Raw</HSComp.TabsTrigger>
							{explainEnabled ? (
								<HSComp.TabsTrigger value="explain">Explain</HSComp.TabsTrigger>
							) : null}
						</HSComp.TabsList>
					</div>
					{response && activeResponseTab !== "explain" ? (
						<div className="flex items-center gap-3 typo-label-xs text-text-secondary">
							<span className={methodColors[METHOD]}>{METHOD}</span>
							<StatusBadge status={response.status} />
							<span>{response.duration}ms</span>
						</div>
					) : null}
				</div>
				<HSComp.TabsContent value="body" className="grow min-h-0">
					{isLoading ? (
						<div className="flex items-center justify-center h-full text-text-secondary bg-bg-secondary">
							Loading...
						</div>
					) : !response ? (
						<div className="flex items-center justify-center h-full text-text-secondary">
							Send a request to see the response.
						</div>
					) : (
						<HSComp.CodeEditor
							readOnly
							isReadOnlyTheme
							currentValue={responseBody}
							mode={response.mode}
						/>
					)}
				</HSComp.TabsContent>
				<HSComp.TabsContent value="headers" className="grow min-h-0">
					{response ? (
						<HSComp.CodeEditor
							readOnly
							isReadOnlyTheme
							currentValue={formatHeaders(response.headers)}
							mode="json"
						/>
					) : (
						<div className="flex items-center justify-center h-full text-text-secondary">
							Send a request to see headers.
						</div>
					)}
				</HSComp.TabsContent>
				<HSComp.TabsContent value="raw" className="grow min-h-0">
					{response ? (
						<HSComp.CodeEditor
							readOnly
							isReadOnlyTheme
							currentValue={formatRaw(response)}
							mode={response.mode}
						/>
					) : (
						<div className="flex items-center justify-center h-full text-text-secondary">
							Send a request to see the raw response.
						</div>
					)}
				</HSComp.TabsContent>
				{explainEnabled ? (
					<HSComp.TabsContent value="explain" className="grow min-h-0">
						<ExplainView
							client={client}
							path={path}
							headers={headers}
							sendVersion={sendVersion}
						/>
					</HSComp.TabsContent>
				) : null}
			</HSComp.Tabs>
		</div>
	);
};
