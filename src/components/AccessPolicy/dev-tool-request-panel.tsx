import type * as AidboxTypes from "@health-samurai/aidbox-client";
import * as HSComp from "@health-samurai/react-components";
import * as yaml from "js-yaml";
import * as Lucide from "lucide-react";
import React from "react";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import { useLocalStorage } from "../../hooks";
import { parseHttpRequest } from "../../utils";
import type { Header } from "../rest/active-tabs";
import HeadersEditor from "../rest/headers-editor";
import ParamsEditor from "../rest/params-editor";
import { UrlAutocomplete } from "../rest/url-autocomplete";
import { CodeEditorMenubar } from "../ViewDefinition/code-editor-menubar";
import { AccessPolicyContext } from "./page";

// ── Types ──────────────────────────────────────────────────────────────

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface DebugPolicy {
	id: string;
	"eval-result"?: boolean;
	[key: string]: unknown;
}

interface DebugData {
	request?: Record<string, unknown>;
	policies?: DebugPolicy[];
}

interface ResponseData {
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body: string;
	duration: number;
	debugData?: DebugData;
}

type RequestSubTab = "params" | "headers" | "body" | "raw";

interface RequestTab {
	id: string;
	method: Method;
	path: string;
	headers: Header[];
	params: Header[];
	body: string;
	selected: boolean;
	activeRequestSubTab: RequestSubTab;
	response: ResponseData | null;
	activeResponseTab: "policy-eval" | "request-context" | "headers";
}

const DEFAULT_HEADERS: Header[] = [
	{ id: "1", name: "Content-Type", value: "application/json", enabled: true },
	{ id: "2", name: "Accept", value: "application/json", enabled: true },
	{ id: "3", name: "", value: "", enabled: true },
];

function parsePathParams(path: string): Header[] {
	const queryParams = path.split("?")[1];
	const params =
		queryParams?.split("&").map((param, index) => {
			const [name, value] = param.split("=");
			return {
				id: `${index}`,
				name: name ?? "",
				value: value ?? "",
				enabled: true,
			};
		}) || [];
	if (!params.some((h) => h.name === "" && h.value === "")) {
		params.push({
			id: crypto.randomUUID(),
			name: "",
			value: "",
			enabled: true,
		});
	}
	return params;
}

function syncPathFromParams(params: Header[], path: string): string {
	const location = path.split("?")[0];
	const queryString = params
		.filter((p) => (p.enabled ?? true) && p.name)
		.map((p) => `${p.name}=${p.value}`)
		.join("&");
	return queryString ? `${location}?${queryString}` : (location ?? "");
}

function createTab(): RequestTab {
	const path = "/Patient";
	return {
		id: crypto.randomUUID(),
		method: "GET",
		path,
		headers: DEFAULT_HEADERS.map((h) => ({ ...h, id: crypto.randomUUID() })),
		params: parsePathParams(path),
		body: "",
		selected: true,
		activeRequestSubTab: "raw",
		response: null,
		activeResponseTab: "policy-eval",
	};
}

// ── Debug helpers ──────────────────────────────────────────────────────

async function fetchDebugToken(client: AidboxClientR5): Promise<string> {
	const resp = await client.rawRequest({
		method: "POST",
		url: "/rpc?_m=aidbox.auth/get-eval-policy-debug-token",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			method: "aidbox.auth/get-eval-policy-debug-token",
		}),
	});
	const json = await resp.response.json();
	return json.result?.token ?? json.data?.token ?? "";
}

function extractDebugData(data: unknown): DebugData {
	const obj = data as Record<string, unknown>;
	// GraphQL: { extensions: { debug: [{ request, policies }] } }
	const graphqlDebug = (obj?.extensions as Record<string, unknown>)
		?.debug as DebugData[];
	if (Array.isArray(graphqlDebug) && graphqlDebug.length > 0) {
		return graphqlDebug[0];
	}
	// REST: { request: {...}, policies: [...] }
	return obj as DebugData;
}

function sortPolicies(
	policies: DebugPolicy[],
	currentPolicyId: string | undefined,
): DebugPolicy[] {
	return [...policies].sort((a, b) => {
		const scoreA = a.id === currentPolicyId ? 0 : a["eval-result"] ? 1 : 2;
		const scoreB = b.id === currentPolicyId ? 0 : b["eval-result"] ? 1 : 2;
		return scoreA - scoreB;
	});
}

// ── HTTP execution ─────────────────────────────────────────────────────

function buildHeaders(headers: Header[]): Record<string, string> {
	return headers
		.filter((h) => h.name && h.value && (h.enabled ?? true))
		.reduce(
			(acc, h) => {
				acc[h.name] = h.value;
				return acc;
			},
			{} as Record<string, string>,
		);
}

async function executeDebugRequest(
	tab: RequestTab,
	client: AidboxClientR5,
	debugToken: string,
): Promise<ResponseData> {
	const headers = buildHeaders(tab.headers);
	headers["x-debug"] = `debug-policy:${debugToken}`;
	headers.Accept = "application/json";

	try {
		const response: AidboxTypes.ResponseWithMeta = await client.rawRequest({
			method: tab.method,
			url: tab.path || "/",
			headers,
			body: tab.body || "",
		});
		const body = await response.response.text();
		let debugData: DebugData | undefined;
		try {
			debugData = extractDebugData(JSON.parse(body));
		} catch {
			// not JSON
		}
		return {
			status: response.response.status,
			statusText: response.response.statusText,
			headers: response.responseHeaders,
			body,
			duration: response.duration,
			debugData,
		};
	} catch (error) {
		const cause = (error as AidboxTypes.ErrorResponse).responseWithMeta;
		const body = await cause.response.text();
		let debugData: DebugData | undefined;
		try {
			debugData = extractDebugData(JSON.parse(body));
		} catch {
			// not JSON
		}
		return {
			status: cause.response.status,
			statusText: cause.response.statusText,
			headers: cause.responseHeaders,
			body,
			duration: cause.duration,
			debugData,
		};
	}
}

// ── Status bar ─────────────────────────────────────────────────────────

const methodColors: Record<string, string> = {
	GET: "text-utility-green typo-label-xs",
	POST: "text-utility-yellow typo-label-xs",
	PUT: "text-utility-blue typo-label-xs",
	PATCH: "text-utility-violet typo-label-xs",
	DELETE: "text-utility-red typo-label-xs",
};

function StatusBar({ response }: { response: ResponseData }) {
	const policies = response.debugData?.policies;
	const passed = policies?.filter((p) => p["eval-result"]).length ?? 0;
	const denied = policies ? policies.length - passed : 0;

	return (
		<div className="flex items-center gap-3 px-4 h-8 border-t bg-bg-secondary text-sm shrink-0">
			<span className="text-text-secondary font-medium">All Policies:</span>
			{policies && (
				<>
					<span className="flex items-center gap-1 text-green-600">
						<Lucide.BadgeCheck className="size-4" />
						<span className="font-bold">{passed}</span>
					</span>
					<span className="flex items-center gap-1 text-critical-default">
						<Lucide.BadgeX className="size-4" />
						<span className="font-bold">{denied}</span>
					</span>
				</>
			)}
		</div>
	);
}

// ── Request body editor ────────────────────────────────────────────────

function updateHeaderValue(
	headers: Header[],
	name: string,
	value: string,
): Header[] {
	const result = [...headers];
	const idx = result.findIndex(
		(h) => h.name?.toLowerCase() === name.toLowerCase(),
	);
	if (idx >= 0 && result[idx]) {
		result[idx] = { ...result[idx], value };
	}
	return result;
}

function RequestBodyEditor({
	tab,
	onBodyChange,
	onHeadersUpdate,
}: {
	tab: RequestTab;
	onBodyChange: (body: string) => void;
	onHeadersUpdate: (headers: Header[]) => void;
}) {
	const [bodyMode, setBodyMode] = useLocalStorage<"json" | "yaml">({
		key: "access-policy-devtool-body-mode",
		getInitialValueInEffect: false,
		defaultValue: "json",
	});

	const [bodyValue, setBodyValue] = React.useState(tab.body);

	React.useEffect(() => {
		setBodyValue(tab.body);
	}, [tab.body]);

	const handleChange = (value: string) => {
		setBodyValue(value);
		onBodyChange(value);
	};

	const handleModeChange = (newMode: "json" | "yaml") => {
		try {
			const parsed =
				bodyMode === "json" ? JSON.parse(bodyValue) : yaml.load(bodyValue);
			const converted =
				newMode === "yaml"
					? yaml.dump(parsed, { indent: 2 })
					: JSON.stringify(parsed, null, 2);
			setBodyValue(converted);
			onBodyChange(converted);
		} catch {
			// If parsing fails, just switch mode without converting
		}
		setBodyMode(newMode);

		const contentType = newMode === "yaml" ? "text/yaml" : "application/json";
		let headers = updateHeaderValue(tab.headers, "Content-Type", contentType);
		headers = updateHeaderValue(headers, "Accept", contentType);
		onHeadersUpdate(headers);
	};

	const handleFormat = () => {
		try {
			const current = bodyValue.trim();
			if (!current) return;
			let formatted: string;
			if (bodyMode === "yaml") {
				formatted = yaml.dump(yaml.load(current), { indent: 2 });
			} else {
				formatted = JSON.stringify(JSON.parse(current), null, 2);
			}
			setBodyValue(formatted);
			onBodyChange(formatted);
		} catch {
			// ignore
		}
	};

	return (
		<div className="relative h-full">
			<div className="sticky min-h-0 h-0 flex justify-end pt-2 pr-3 top-0 right-0 z-10">
				<CodeEditorMenubar
					mode={bodyMode}
					onModeChange={handleModeChange}
					textToCopy={bodyValue}
					onFormat={handleFormat}
				/>
			</div>
			<HSComp.CodeEditor
				key={`body-${tab.id}`}
				currentValue={bodyValue}
				mode={bodyMode}
				onChange={handleChange}
			/>
		</div>
	);
}

// ── Raw editor ────────────────────────────────────────────────────────

function RawEditor({
	selectedTab,
	onRawChange,
}: {
	selectedTab: RequestTab;
	onRawChange: (rawText: string) => void;
}) {
	const requestLine = `${selectedTab.method} ${selectedTab.path || "/"}`;
	const headersText =
		selectedTab.headers
			?.filter((h) => h.name && h.value && (h.enabled ?? true))
			.map((h) => `${h.name}: ${h.value}`)
			.join("\n") || "";
	const currentValue = `${requestLine}\n${headersText}\n\n${selectedTab.body || ""}`;

	return (
		<HSComp.CodeEditor
			key={`raw-${selectedTab.id}`}
			defaultValue={currentValue}
			mode="http"
			onChange={onRawChange}
		/>
	);
}

// ── Policy eval list ───────────────────────────────────────────────────

function PolicyEvalRow({ policy }: { policy: DebugPolicy }) {
	const { accessPolicyId } = React.useContext(AccessPolicyContext);
	const [expanded, setExpanded] = React.useState(policy.id === accessPolicyId);
	const passed = !!policy["eval-result"];

	return (
		<div className="border-b border-border-primary">
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: collapsible row */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: collapsible row */}
			<div
				className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-bg-tertiary"
				onClick={() => setExpanded((v) => !v)}
			>
				<div className="flex items-center gap-2">
					{expanded ? (
						<Lucide.ChevronDown
							className={`size-4 ${passed ? "text-green-600" : "text-critical-default"}`}
						/>
					) : (
						<Lucide.ChevronRight
							className={`size-4 ${passed ? "text-green-600" : "text-critical-default"}`}
						/>
					)}
					<span
						className={`typo-body-sm ${policy.id === accessPolicyId ? "font-bold" : ""}`}
					>
						{policy.id}
					</span>
				</div>
				<span
					className={`typo-label-xs ${passed ? "text-green-600" : "text-critical-default"}`}
				>
					{passed ? "passed" : "denied"}
				</span>
			</div>
			{expanded && (
				<pre className="px-7 pb-3 typo-code text-text-secondary text-xs whitespace-pre-wrap overflow-auto">
					{yaml.dump(policy, { indent: 2 })}
				</pre>
			)}
		</div>
	);
}

function PolicyEvalView({
	response,
	currentPolicyId,
}: {
	response: ResponseData | null;
	currentPolicyId: string | undefined;
}) {
	if (!response) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary bg-bg-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">No response yet</div>
					<div className="text-sm">Send a request to see policy evaluation</div>
				</div>
			</div>
		);
	}

	const debugData = response.debugData;

	if (!debugData?.policies) {
		return (
			<div className="p-4">
				<div className="p-3 bg-bg-error-secondary text-text-error-primary rounded mb-3">
					The response doesn't contain debug policy data. Make sure the debug
					token is valid.
				</div>
				<pre className="typo-code text-xs text-text-secondary whitespace-pre-wrap">
					{response.body}
				</pre>
			</div>
		);
	}

	const sorted = sortPolicies(debugData.policies, currentPolicyId);

	return (
		<div className="h-full overflow-auto">
			{sorted.map((policy) => (
				<PolicyEvalRow key={policy.id} policy={policy} />
			))}
		</div>
	);
}

// ── Response views for other tabs ──────────────────────────────────────

function RequestContextView({ response }: { response: ResponseData | null }) {
	if (!response) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary bg-bg-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">No response yet</div>
					<div className="text-sm">
						Send a request to see the request context
					</div>
				</div>
			</div>
		);
	}

	const request = response.debugData?.request;
	const content = request ? yaml.dump(request, { indent: 2 }) : response.body;

	return (
		<HSComp.CodeEditor
			readOnly
			key={`request-context-${response.status}`}
			currentValue={content}
			mode={request ? "yaml" : "json"}
		/>
	);
}

function ResponseHeadersView({ response }: { response: ResponseData | null }) {
	if (!response) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary bg-bg-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">No response yet</div>
					<div className="text-sm">Send a request to see response headers</div>
				</div>
			</div>
		);
	}

	return (
		<HSComp.CodeEditor
			readOnly
			key={`resp-headers-${response.status}`}
			currentValue={JSON.stringify(response.headers, null, 2)}
			mode="json"
		/>
	);
}

// ── Main component ─────────────────────────────────────────────────────

export function DevToolRequestPanel() {
	const client = useAidboxClient();
	const { accessPolicyId } = React.useContext(AccessPolicyContext);

	const [tabs, setTabs] = useLocalStorage<RequestTab[]>({
		key: "access-policy-devtool-tabs",
		getInitialValueInEffect: false,
		defaultValue: [createTab()],
	});

	const selectedTab = React.useMemo(() => {
		const tab = tabs.find((t) => t.selected) || tabs[0] || createTab();
		if (!tab.params) {
			tab.params = parsePathParams(tab.path);
		}
		return tab;
	}, [tabs]);

	const [isLoading, setIsLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const debugTokenRef = React.useRef<string | null>(null);

	// ── Tab management ──

	const selectTab = (tabId: string) => {
		setTabs((prev) => prev.map((t) => ({ ...t, selected: t.id === tabId })));
	};

	const addTab = () => {
		const newTab = createTab();
		setTabs((prev) => [
			...prev.map((t) => ({ ...t, selected: false })),
			newTab,
		]);
	};

	const closeTab = (tabId: string) => {
		setTabs((prev) => {
			const remaining = prev.filter((t) => t.id !== tabId);
			if (remaining.length === 0) return [createTab()];
			if (!remaining.some((t) => t.selected)) {
				const last = remaining[Math.max(0, remaining.length - 1)];
				if (last) last.selected = true;
			}
			return remaining;
		});
	};

	// ── Update selected tab ──

	const updateSelected = (
		updater: (tab: RequestTab) => Partial<RequestTab>,
	) => {
		setTabs((prev) =>
			prev.map((t) => (t.selected ? { ...t, ...updater(t) } : t)),
		);
	};

	const handleMethodChange = (method: string) =>
		updateSelected(() => ({ method: method as Method }));

	const handlePathChange = (path: string) =>
		updateSelected(() => ({ path, params: parsePathParams(path) }));

	const handleBodyChange = (body: string) => updateSelected(() => ({ body }));

	const handleHeaderChange = (headerIndex: number, header: Header) => {
		updateSelected((tab) => {
			const headers = [...tab.headers];
			headers[headerIndex] = { ...headers[headerIndex], ...header };
			if (!headers.some((h) => h.name === "" && h.value === "")) {
				headers.push({
					id: crypto.randomUUID(),
					name: "",
					value: "",
					enabled: true,
				});
			}
			return { headers };
		});
	};

	const handleHeaderRemove = (headerIndex: number) => {
		updateSelected((tab) => {
			const headers = [...tab.headers];
			headers.splice(headerIndex, 1);
			if (!headers.some((h) => h.name === "" && h.value === "")) {
				headers.push({
					id: crypto.randomUUID(),
					name: "",
					value: "",
					enabled: true,
				});
			}
			return { headers };
		});
	};

	const handleParamChange = (paramIndex: number, param: Header) => {
		updateSelected((tab) => {
			const params = [...tab.params];
			params[paramIndex] = { ...params[paramIndex], ...param };
			if (!params.some((h) => h.name === "" && h.value === "")) {
				params.push({
					id: crypto.randomUUID(),
					name: "",
					value: "",
					enabled: true,
				});
			}
			return { params, path: syncPathFromParams(params, tab.path) };
		});
	};

	const handleParamRemove = (paramIndex: number) => {
		updateSelected((tab) => {
			const params = [...tab.params];
			params.splice(paramIndex, 1);
			if (!params.some((h) => h.name === "" && h.value === "")) {
				params.push({
					id: crypto.randomUUID(),
					name: "",
					value: "",
					enabled: true,
				});
			}
			return { params, path: syncPathFromParams(params, tab.path) };
		});
	};

	const handleRawChange = (rawText: string) => {
		try {
			const parsed = parseHttpRequest(rawText);
			updateSelected(() => ({
				method: parsed.method as Method,
				path: parsed.path,
				headers: parsed.headers,
				params: parsePathParams(parsed.path),
				body: parsed.body,
			}));
		} catch {
			// ignore parse errors while typing
		}
	};

	const handleRequestSubTabChange = (subTab: RequestSubTab) =>
		updateSelected(() => ({ activeRequestSubTab: subTab }));

	const handleResponseTabChange = (
		tab: "policy-eval" | "request-context" | "headers",
	) => updateSelected(() => ({ activeResponseTab: tab }));

	// ── Send with debug ──

	const doSend = React.useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			// Fetch debug token if we don't have one
			if (!debugTokenRef.current) {
				debugTokenRef.current = await fetchDebugToken(client);
			}
			const resp = await executeDebugRequest(
				selectedTab,
				client,
				debugTokenRef.current,
			);
			setTabs((prev) =>
				prev.map((t) => (t.selected ? { ...t, response: resp } : t)),
			);
		} catch {
			// Token may have expired, retry once
			try {
				debugTokenRef.current = await fetchDebugToken(client);
				const resp = await executeDebugRequest(
					selectedTab,
					client,
					debugTokenRef.current,
				);
				setTabs((prev) =>
					prev.map((t) => (t.selected ? { ...t, response: resp } : t)),
				);
			} catch (retryErr) {
				setError(
					retryErr instanceof Error ? retryErr.message : String(retryErr),
				);
			}
		} finally {
			setIsLoading(false);
		}
	}, [selectedTab, client, setTabs]);

	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				doSend();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [doSend]);

	// ── Loading placeholder ──

	const loadingView = (
		<div className="flex items-center justify-center h-full text-text-secondary bg-bg-secondary">
			<div className="text-lg">Loading...</div>
		</div>
	);

	// ── Render ──

	return (
		<div className="flex flex-col h-full">
			{/* Request tabs */}
			<div className="flex h-10 w-full shrink-0">
				<HSComp.Tabs variant="browser" value={selectedTab.id}>
					<HSComp.TabsBrowserList>
						{tabs.map((tab) => (
							<HSComp.TabsTrigger
								key={tab.id}
								value={tab.id}
								{...(tabs.length > 1 && {
									onClose: () => closeTab(tab.id),
								})}
								onClick={() => selectTab(tab.id)}
							>
								<span className="flex items-center gap-1 truncate">
									<span className={methodColors[tab.method]}>{tab.method}</span>
									<span className="typo-body-xs">
										{tab.path || "New request"}
									</span>
								</span>
							</HSComp.TabsTrigger>
						))}
					</HSComp.TabsBrowserList>
					<HSComp.TabsAddButton onClick={addTab} />
				</HSComp.Tabs>
			</div>

			{/* Request line: method + URL + send */}
			<div className="px-4 py-3 flex items-center border-b gap-2 shrink-0">
				<UrlAutocomplete
					path={selectedTab.path}
					method={selectedTab.method}
					onSelectSuggestion={(path) => handlePathChange(path)}
					onSubmit={doSend}
				>
					<HSComp.RequestLineEditor
						key={`rl-${selectedTab.id}`}
						placeholder="Enter URL"
						className="w-full"
						method={selectedTab.method}
						path={selectedTab.path}
						onMethodChange={handleMethodChange}
						onPathChange={(e) => handlePathChange(e.target.value)}
					/>
				</UrlAutocomplete>
				<HSComp.Tooltip delayDuration={600}>
					<HSComp.TooltipTrigger asChild>
						<HSComp.Button
							variant="primary"
							onClick={doSend}
							disabled={isLoading}
						>
							<HSComp.PlayIcon />
							Send
						</HSComp.Button>
					</HSComp.TooltipTrigger>
					<HSComp.TooltipContent>
						Send request (Ctrl+Enter / ⌘+Enter)
					</HSComp.TooltipContent>
				</HSComp.Tooltip>
			</div>

			{/* Error banner */}
			{error && (
				<div className="px-4 py-2 bg-bg-error-secondary text-text-error-primary text-sm shrink-0">
					{error}
				</div>
			)}

			{/* Request + Response split */}
			<HSComp.ResizablePanelGroup
				direction="vertical"
				autoSaveId="access-policy-devtool-req-resp"
				className="grow min-h-0"
			>
				{/* Request sub-tabs: Params, Headers, Body, Raw */}
				<HSComp.ResizablePanel defaultSize={40} minSize={15}>
					<HSComp.Tabs
						value={selectedTab.activeRequestSubTab}
						onValueChange={(v) => handleRequestSubTabChange(v as RequestSubTab)}
						className="flex flex-col h-full"
					>
						<div className="flex items-center bg-bg-secondary px-4 border-b h-10 shrink-0">
							<span className="typo-label text-text-secondary pr-3">
								Request:
							</span>
							<HSComp.TabsList>
								<HSComp.TabsTrigger value="params">Params</HSComp.TabsTrigger>
								<HSComp.TabsTrigger value="headers">Headers</HSComp.TabsTrigger>
								<HSComp.TabsTrigger value="body">Body</HSComp.TabsTrigger>
								<HSComp.TabsTrigger value="raw">Raw</HSComp.TabsTrigger>
							</HSComp.TabsList>
						</div>
						<HSComp.TabsContent value="params" className="grow min-h-0">
							<ParamsEditor
								params={selectedTab.params}
								onParamChange={handleParamChange}
								onParamRemove={handleParamRemove}
							/>
						</HSComp.TabsContent>
						<HSComp.TabsContent value="headers" className="grow min-h-0">
							<HeadersEditor
								headers={selectedTab.headers}
								onHeaderChange={handleHeaderChange}
								onHeaderRemove={handleHeaderRemove}
							/>
						</HSComp.TabsContent>
						<HSComp.TabsContent value="body" className="relative grow min-h-0">
							<RequestBodyEditor
								tab={selectedTab}
								onBodyChange={handleBodyChange}
								onHeadersUpdate={(headers) =>
									updateSelected(() => ({ headers }))
								}
							/>
						</HSComp.TabsContent>
						<HSComp.TabsContent value="raw" className="relative grow min-h-0">
							<RawEditor
								selectedTab={selectedTab}
								onRawChange={handleRawChange}
							/>
						</HSComp.TabsContent>
					</HSComp.Tabs>
				</HSComp.ResizablePanel>

				<HSComp.ResizableHandle />

				{/* Response: Policy eval, RequestContext, Headers */}
				<HSComp.ResizablePanel defaultSize={60} minSize={15}>
					<div className="flex flex-col h-full">
						<HSComp.Tabs
							value={selectedTab.activeResponseTab}
							onValueChange={(v) =>
								handleResponseTabChange(
									v as "policy-eval" | "request-context" | "headers",
								)
							}
							className="flex flex-col grow min-h-0"
						>
							<div className="flex items-center bg-bg-secondary px-4 border-b h-10 shrink-0">
								<span className="typo-label text-text-secondary pr-3">
									Response:
								</span>
								<HSComp.TabsList>
									<HSComp.TabsTrigger value="policy-eval">
										Policy eval
									</HSComp.TabsTrigger>
									<HSComp.TabsTrigger value="request-context">
										RequestContext
									</HSComp.TabsTrigger>
									<HSComp.TabsTrigger value="headers">
										Headers
									</HSComp.TabsTrigger>
								</HSComp.TabsList>
							</div>
							<HSComp.TabsContent value="policy-eval" className="grow min-h-0">
								{isLoading ? (
									loadingView
								) : (
									<PolicyEvalView
										response={selectedTab.response}
										currentPolicyId={accessPolicyId}
									/>
								)}
							</HSComp.TabsContent>
							<HSComp.TabsContent
								value="request-context"
								className="grow min-h-0"
							>
								{isLoading ? (
									loadingView
								) : (
									<RequestContextView response={selectedTab.response} />
								)}
							</HSComp.TabsContent>
							<HSComp.TabsContent value="headers" className="grow min-h-0">
								{isLoading ? (
									loadingView
								) : (
									<ResponseHeadersView response={selectedTab.response} />
								)}
							</HSComp.TabsContent>
						</HSComp.Tabs>

						{/* Status bar */}
						{selectedTab.response && (
							<StatusBar response={selectedTab.response} />
						)}
					</div>
				</HSComp.ResizablePanel>
			</HSComp.ResizablePanelGroup>
		</div>
	);
}
