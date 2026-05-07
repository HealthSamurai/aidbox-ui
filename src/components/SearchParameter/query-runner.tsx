import type * as AidboxTypes from "@health-samurai/aidbox-client";
import * as HSComp from "@health-samurai/react-components";
import * as Lucide from "lucide-react";
import * as React from "react";
import type { AidboxClientR5 } from "../../AidboxClient";
import { type Header, methodColors } from "../rest/active-tabs";
import { UrlAutocomplete } from "../rest/url-autocomplete";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type ResponseTab = "body" | "headers" | "raw";

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

function buildDefaultPath(base?: string, code?: string): string {
	if (base && code) return `/fhir/${base}?${code}=`;
	if (base) return `/fhir/${base}`;
	return "/fhir/Patient";
}

async function executeRequest(
	method: Method,
	path: string,
	headers: Header[],
	body: string,
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
		const hasBody = method !== "GET" && method !== "DELETE";
		const response: AidboxTypes.ResponseWithMeta = await client.rawRequest({
			method,
			url: path || "/",
			headers: reqHeaders,
			...(hasBody && body ? { body } : {}),
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
	const defaultPath = React.useMemo(
		() => buildDefaultPath(base, code),
		[base, code],
	);

	const [method, setMethod] = React.useState<Method>("GET");
	const [path, setPath] = React.useState<string>(defaultPath);
	const [headers] = React.useState<Header[]>(DEFAULT_HEADERS);
	const [body] = React.useState<string>("");
	const [response, setResponse] = React.useState<ResponseData | null>(null);
	const [isLoading, setIsLoading] = React.useState(false);
	const [activeResponseTab, setActiveResponseTab] =
		React.useState<ResponseTab>("body");

	// Update default path when base/code change AND the user hasn't typed
	// something that diverges from a previous default.
	const lastDefaultRef = React.useRef(defaultPath);
	React.useEffect(() => {
		if (path === lastDefaultRef.current) {
			setPath(defaultPath);
		}
		lastDefaultRef.current = defaultPath;
	}, [defaultPath, path]);

	const send = React.useCallback(async () => {
		setIsLoading(true);
		try {
			const resp = await executeRequest(method, path, headers, body, client);
			setResponse(resp);
		} finally {
			setIsLoading(false);
		}
	}, [method, path, headers, body, client]);

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

	return (
		<div className="flex flex-col h-full">
			{/* Request line */}
			<div className="px-4 py-3 flex items-center border-b gap-2 shrink-0">
				<UrlAutocomplete
					path={path}
					method={method}
					onSelectSuggestion={(p) => setPath(p)}
					onSubmit={send}
				>
					<HSComp.RequestLineEditor
						placeholder="Enter URL"
						className="w-full"
						method={method}
						path={path}
						onMethodChange={(m) => setMethod(m as Method)}
						onPathChange={(e) => setPath(e.target.value)}
					/>
				</UrlAutocomplete>
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
						</HSComp.TabsList>
					</div>
					{response ? (
						<div className="flex items-center gap-3 typo-label-xs text-text-secondary">
							<span className={methodColors[method]}>{method}</span>
							<StatusBadge status={response.status} />
							<span>{response.duration}ms</span>
						</div>
					) : null}
				</div>
				{isLoading ? (
					<div className="flex items-center justify-center grow min-h-0 text-text-secondary bg-bg-secondary">
						Loading...
					</div>
				) : !response ? (
					<div className="flex items-center justify-center grow min-h-0 text-text-secondary">
						Send a request to see the response.
					</div>
				) : (
					<>
						<HSComp.TabsContent value="body" className="grow min-h-0">
							<HSComp.CodeEditor
								readOnly
								isReadOnlyTheme
								currentValue={responseBody}
								mode={response.mode}
							/>
						</HSComp.TabsContent>
						<HSComp.TabsContent value="headers" className="grow min-h-0">
							<HSComp.CodeEditor
								readOnly
								isReadOnlyTheme
								currentValue={formatHeaders(response.headers)}
								mode="json"
							/>
						</HSComp.TabsContent>
						<HSComp.TabsContent value="raw" className="grow min-h-0">
							<HSComp.CodeEditor
								readOnly
								isReadOnlyTheme
								currentValue={formatRaw(response)}
								mode={response.mode}
							/>
						</HSComp.TabsContent>
					</>
				)}
			</HSComp.Tabs>
		</div>
	);
};
