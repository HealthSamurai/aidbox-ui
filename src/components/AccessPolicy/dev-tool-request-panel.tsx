import type * as AidboxTypes from "@health-samurai/aidbox-client";
import * as HSComp from "@health-samurai/react-components";
import * as yaml from "js-yaml";
import * as Lucide from "lucide-react";
import React from "react";
import { format as formatSQL } from "sql-formatter";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import { useUserInfo } from "../../api/auth";
import { useLocalStorage } from "../../hooks";
import {
	parseHttpRequest,
	parsePathParams,
	syncPathFromParams,
} from "../../utils";
import { type Header, methodColors } from "../rest/active-tabs";
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

type RequestSubTab = "params" | "headers" | "body" | "raw" | "auth";

interface RequestTab {
	id: string;
	method: Method;
	path: string;
	headers: Header[];
	params: Header[];
	body: string;
	suUserId: string;
	selected: boolean;
	activeRequestSubTab: RequestSubTab;
	response: ResponseData | null;
	activeResponseTab: "policy-eval" | "request-context" | "headers" | "sql";
}

const DEFAULT_HEADERS: Header[] = [
	{ id: "1", name: "Content-Type", value: "application/json", enabled: true },
	{ id: "2", name: "Accept", value: "application/json", enabled: true },
	{ id: "3", name: "", value: "", enabled: true },
];

function ensureEmptyRow(rows: Header[]): void {
	if (!rows.some((h) => h.name === "" && h.value === "")) {
		rows.push({ id: crypto.randomUUID(), name: "", value: "", enabled: true });
	}
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
		suUserId: "",
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
	if (tab.suUserId) {
		headers.su = tab.suUserId;
	}

	const url = (tab.path || "/").replace(/\/\/+/g, "/");

	try {
		const response: AidboxTypes.ResponseWithMeta = await client.rawRequest({
			method: tab.method,
			url,
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
		if (!cause?.response) {
			return {
				status: 0,
				statusText: "Error",
				headers: {},
				body: error instanceof Error ? error.message : String(error),
				duration: 0,
			};
		}
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

function ResponseInfo({ response }: { response: ResponseData }) {
	const policies = response.debugData?.policies;
	const passed = policies?.filter((p) => p["eval-result"]).length ?? 0;
	const accessGranted = passed > 0;

	return (
		<div className="flex items-center text-sm ml-3 min-w-0">
			{policies && (
				<span
					className={`font-medium whitespace-nowrap truncate ${accessGranted ? "text-green-600" : "text-critical-default"}`}
				>
					{accessGranted ? "Access granted" : "Access denied"}
				</span>
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

function NoResponsePlaceholder({ children }: { children: string }) {
	return (
		<div className="flex items-center justify-center h-full text-text-secondary bg-bg-secondary">
			<div className="text-center">
				<div className="text-lg mb-2">No response yet</div>
				<div className="text-sm">{children}</div>
			</div>
		</div>
	);
}

// ── Policy eval list ───────────────────────────────────────────────────

function PolicyEvalRow({
	policy,
	allExpanded,
}: {
	policy: DebugPolicy;
	allExpanded: boolean | null;
}) {
	const { accessPolicyId } = React.useContext(AccessPolicyContext);
	const [expanded, setExpanded] = React.useState(policy.id === accessPolicyId);
	const passed = !!policy["eval-result"];

	React.useEffect(() => {
		if (allExpanded !== null) setExpanded(allExpanded);
	}, [allExpanded]);

	return (
		<div className="border-b border-border-tertiary">
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: collapsible row */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: collapsible row */}
			<div
				className="flex items-center justify-between pl-3 pr-4 py-2 cursor-pointer hover:bg-bg-tertiary"
				onClick={() => setExpanded((v) => !v)}
			>
				<div className="flex items-center gap-2">
					{expanded ? (
						<Lucide.ChevronDown className="size-4 shrink-0 text-text-tertiary" />
					) : (
						<Lucide.ChevronRight className="size-4 shrink-0 text-text-tertiary" />
					)}
					<span
						className={`typo-body-xs ${passed ? "text-green-600" : "text-critical-default"} ${policy.id === accessPolicyId ? "font-bold" : ""}`}
					>
						{policy.id}
					</span>
				</div>
			</div>
			{expanded && (
				<div className="px-4 pb-2">
					<HSComp.CodeEditor
						readOnly
						currentValue={yaml.dump(
							Object.fromEntries(
								Object.entries(policy).filter(
									([k]) =>
										k !== "eval-result" && k !== "id" && k !== "policy-id",
								),
							),
							{ indent: 2 },
						)}
						mode="yaml"
						lineNumbers={false}
						foldGutter={false}
					/>
				</div>
			)}
		</div>
	);
}

function PolicyEvalView({
	response,
	currentPolicyId,
	allExpanded,
}: {
	response: ResponseData | null;
	currentPolicyId: string | undefined;
	allExpanded: boolean | null;
}) {
	if (!response) {
		return (
			<NoResponsePlaceholder>
				Send a request to see policy evaluation
			</NoResponsePlaceholder>
		);
	}

	const debugData = response.debugData;

	if (!debugData?.policies) {
		let errorMessage: string | undefined;
		try {
			const parsed = JSON.parse(response.body);
			if (parsed.resourceType === "OperationOutcome") {
				errorMessage = parsed.issue
					?.map((i: { details?: { text?: string } }) => i.details?.text)
					.filter(Boolean)
					.join("\n");
			}
		} catch {
			// not JSON
		}

		return (
			<div className="flex items-center justify-center h-full text-text-secondary bg-bg-secondary">
				<div className="text-center p-4">
					{response.status > 0 && (
						<div className="text-lg font-medium text-critical-default mb-2">
							{response.status} {response.statusText}
						</div>
					)}
					<div className="text-sm">{errorMessage || response.body}</div>
				</div>
			</div>
		);
	}

	const sorted = sortPolicies(debugData.policies, currentPolicyId);

	return (
		<div className="h-full overflow-auto">
			{sorted.map((policy) => (
				<PolicyEvalRow
					key={policy.id}
					policy={policy}
					allExpanded={allExpanded}
				/>
			))}
		</div>
	);
}

// ── Response views for other tabs ──────────────────────────────────────

function RequestContextView({ response }: { response: ResponseData | null }) {
	const [mode, setMode] = React.useState<"json" | "yaml">("yaml");

	if (!response) {
		return (
			<NoResponsePlaceholder>
				Send a request to see the request context
			</NoResponsePlaceholder>
		);
	}

	const request = response.debugData?.request;
	const content = request
		? mode === "yaml"
			? yaml.dump(request, { indent: 2 })
			: JSON.stringify(request, null, 2)
		: response.body;

	return (
		<div className="relative size-full">
			<HSComp.CodeEditor
				readOnly
				key={`request-context-${response.status}-${mode}`}
				currentValue={content}
				mode={request ? mode : "json"}
			/>
			{request && (
				<div className="absolute top-2 right-4 flex items-center gap-2 border rounded-full p-2 border-border-secondary bg-bg-primary shadow-sm">
					<HSComp.SegmentControl
						value={mode}
						onValueChange={(v) => setMode(v as "json" | "yaml")}
						items={[
							{ value: "json", label: "JSON" },
							{ value: "yaml", label: "YAML" },
						]}
					/>
					<HSComp.Button variant="ghost" size="small" asChild>
						<HSComp.CopyIcon text={content} />
					</HSComp.Button>
				</div>
			)}
		</div>
	);
}

function ResponseHeadersView({ response }: { response: ResponseData | null }) {
	if (!response) {
		return (
			<NoResponsePlaceholder>
				Send a request to see response headers
			</NoResponsePlaceholder>
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

function resolveTemplatePath(
	obj: Record<string, unknown>,
	path: string,
): unknown {
	const parts = path.split(".");
	let current: unknown = obj;
	for (const part of parts) {
		if (current == null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

function substituteTemplates(
	query: string,
	request: Record<string, unknown>,
): string {
	return query.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
		const trimmed = path.trim();
		const value = resolveTemplatePath(request, trimmed);
		if (value === undefined || value === null) return "null";
		if (typeof value === "string") return `'${value}'`;
		return String(value);
	});
}

function SqlQueryView({
	response,
	accessPolicy,
}: {
	response: ResponseData | null;
	accessPolicy: Record<string, unknown> | undefined;
}) {
	const sqlQuery = (accessPolicy?.sql as Record<string, unknown>)?.query as
		| string
		| undefined;

	const request = response?.debugData?.request;

	const formatted = React.useMemo(() => {
		if (!response || !sqlQuery) return "";
		const substituted = request
			? substituteTemplates(sqlQuery, request)
			: sqlQuery;
		try {
			return formatSQL(substituted, {
				language: "postgresql",
				keywordCase: "upper",
				indentStyle: "tabularRight",
				linesBetweenQueries: 2,
			});
		} catch {
			return substituted;
		}
	}, [response, sqlQuery, request]);

	if (!response || !sqlQuery) {
		return (
			<NoResponsePlaceholder>
				Send a request to see the substituted SQL query
			</NoResponsePlaceholder>
		);
	}

	return (
		<HSComp.CodeEditor
			readOnly
			key={`sql-${response.status}`}
			currentValue={formatted}
			mode="sql"
		/>
	);
}

// ── Auth tab ────────────────────────────────────────────────────────────

interface UserEntry {
	id: string;
}

function useUserSearch(client: AidboxClientR5, search: string) {
	const [users, setUsers] = React.useState<UserEntry[]>([]);
	const [isLoading, setIsLoading] = React.useState(false);

	React.useEffect(() => {
		let cancelled = false;
		const fetchUsers = async () => {
			setIsLoading(true);
			try {
				const params = new URLSearchParams({ _count: "50" });
				if (search) params.set("_id:contains", search);
				const resp = await client.rawRequest({
					method: "GET",
					url: `/User?${params}`,
					headers: { Accept: "application/json" },
				});
				const json = await resp.response.json();
				if (!cancelled) {
					const entries = (json.entry || []).map(
						(e: { resource: UserEntry }) => e.resource,
					);
					setUsers(entries);
				}
			} catch {
				if (!cancelled) setUsers([]);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};
		fetchUsers();
		return () => {
			cancelled = true;
		};
	}, [client, search]);

	return { users, isLoading };
}

function useSuEnabled(client: AidboxClientR5) {
	const [enabled, setEnabled] = React.useState<boolean | null>(null);

	React.useEffect(() => {
		let cancelled = false;
		client
			.rawRequest({
				method: "GET",
				url: "/api/v1/settings/introspect/security.debug-su-enable",
				headers: { Accept: "application/json" },
			})
			.then(async (resp) => {
				const json = await resp.response.json();
				if (!cancelled) setEnabled(json.value === true);
			})
			.catch(() => {
				if (!cancelled) setEnabled(false);
			});
		return () => {
			cancelled = true;
		};
	}, [client]);

	return enabled;
}

// biome-ignore lint/correctness/noUnusedVariables: hidden tab, will be re-enabled
function AuthTab({
	suUserId,
	onSuUserChange,
}: {
	suUserId: string;
	onSuUserChange: (userId: string) => void;
}) {
	const client = useAidboxClient();
	const { users, isLoading } = useUserSearch(client, "");
	const userInfo = useUserInfo();
	const suEnabled = useSuEnabled(client);

	React.useEffect(() => {
		if (!suUserId && userInfo.data?.id) {
			onSuUserChange(userInfo.data.id);
		}
	}, [suUserId, userInfo.data?.id, onSuUserChange]);

	const options = React.useMemo(
		() => users.map((u) => ({ value: u.id, label: u.id })),
		[users],
	);

	return (
		<div className="p-4 space-y-3">
			<div className="space-y-1">
				<div className="flex items-center gap-1">
					<span className="typo-label text-text-secondary">Requester</span>
					<HSComp.Tooltip>
						<HSComp.TooltipTrigger asChild>
							<Lucide.Info className="size-3.5 text-text-tertiary" />
						</HSComp.TooltipTrigger>
						<HSComp.TooltipContent>
							Requires{" "}
							<a
								href="/u/settings#setting-security.debug-su-enable"
								className="typo-code text-xs text-text-link underline"
							>
								security.debug-su-enable
							</a>{" "}
							setting
						</HSComp.TooltipContent>
					</HSComp.Tooltip>
				</div>
				<p className="typo-body-xs text-text-tertiary">
					Impersonate a user when debugging access policies
				</p>
			</div>
			<HSComp.Combobox
				options={options}
				value={suUserId}
				onValueChange={onSuUserChange}
				placeholder="Select user..."
				searchPlaceholder="Search users..."
				emptyText={isLoading ? "Loading..." : "No users found."}
				className="w-64"
				disabled={suEnabled === false}
			/>
			{suEnabled === false && (
				<p className="typo-body-xs text-text-error-primary">
					Enable{" "}
					<a
						href="/u/settings#setting-security.debug-su-enable"
						className="underline"
					>
						security.debug-su-enable
					</a>{" "}
					setting to use this feature.
				</p>
			)}
		</div>
	);
}

// ── Main component ─────────────────────────────────────────────────────

export function DevToolRequestPanel() {
	const client = useAidboxClient();
	const { accessPolicyId, accessPolicy } =
		React.useContext(AccessPolicyContext);
	const isSqlEngine =
		(accessPolicy as Record<string, unknown> | undefined)?.engine === "sql";

	const [tabs, setTabs] = useLocalStorage<RequestTab[]>({
		key: "access-policy-devtool-tabs",
		getInitialValueInEffect: false,
		defaultValue: [createTab()],
	});

	const selectedTab = React.useMemo(() => {
		const found = tabs.find((t) => t.selected) || tabs[0] || createTab();
		return {
			...found,
			params: found.params || parsePathParams(found.path),
			activeResponseTab:
				found.activeResponseTab === "sql" && !isSqlEngine
					? "policy-eval"
					: found.activeResponseTab,
		};
	}, [tabs, isSqlEngine]);

	const [isLoading, setIsLoading] = React.useState(false);
	const debugTokenRef = React.useRef<string | null>(null);
	const [maximized, setMaximized] = React.useState<
		"request" | "response" | null
	>(null);
	const [allPoliciesExpanded, setAllPoliciesExpanded] = React.useState<
		boolean | null
	>(null);

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
			ensureEmptyRow(headers);
			return { headers };
		});
	};

	const handleHeaderRemove = (headerIndex: number) => {
		updateSelected((tab) => {
			const headers = [...tab.headers];
			headers.splice(headerIndex, 1);
			ensureEmptyRow(headers);
			return { headers };
		});
	};

	const handleParamChange = (paramIndex: number, param: Header) => {
		updateSelected((tab) => {
			const params = [...tab.params];
			params[paramIndex] = { ...params[paramIndex], ...param };
			ensureEmptyRow(params);
			return { params, path: syncPathFromParams(params, tab.path) };
		});
	};

	const handleParamRemove = (paramIndex: number) => {
		updateSelected((tab) => {
			const params = [...tab.params];
			params.splice(paramIndex, 1);
			ensureEmptyRow(params);
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
		tab: "policy-eval" | "request-context" | "headers" | "sql",
	) => updateSelected(() => ({ activeResponseTab: tab }));

	// ── Send with debug ──

	const doSend = React.useCallback(async () => {
		const saveResponse = (resp: ResponseData) => {
			setTabs((prev) =>
				prev.map((t) => (t.selected ? { ...t, response: resp } : t)),
			);
		};

		setIsLoading(true);
		try {
			if (!debugTokenRef.current) {
				debugTokenRef.current = await fetchDebugToken(client);
			}
			saveResponse(
				await executeDebugRequest(selectedTab, client, debugTokenRef.current),
			);
		} catch {
			// Token may have expired, retry once
			try {
				debugTokenRef.current = await fetchDebugToken(client);
				saveResponse(
					await executeDebugRequest(selectedTab, client, debugTokenRef.current),
				);
			} catch (retryErr) {
				saveResponse({
					status: 0,
					statusText: "Error",
					headers: {},
					body: retryErr instanceof Error ? retryErr.message : String(retryErr),
					duration: 0,
				});
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
			<HSComp.Tabs variant="browser" value={selectedTab.id}>
				<HSComp.TabsBrowserList>
					{tabs.map((tab) => (
						<HSComp.ContextMenu key={tab.id}>
							<HSComp.ContextMenuTrigger>
								<HSComp.TabsTrigger
									value={tab.id}
									{...(tabs.length > 1 && {
										onClose: () => closeTab(tab.id),
									})}
									onClick={() => selectTab(tab.id)}
									onMouseDown={(e) => {
										if (e.button === 1) {
											e.preventDefault();
											e.stopPropagation();
											closeTab(tab.id);
										}
									}}
								>
									<span className="flex items-center gap-1 truncate">
										<span className={methodColors[tab.method]}>
											{tab.method}
										</span>
										<span className="typo-body-xs">
											{tab.path || "New request"}
										</span>
									</span>
								</HSComp.TabsTrigger>
							</HSComp.ContextMenuTrigger>
							<HSComp.ContextMenuContent className="w-50">
								<HSComp.ContextMenuItem
									onClick={() => {
										const newTab = {
											...tab,
											id: crypto.randomUUID(),
											selected: true,
										};
										setTabs((prev) => [
											...prev.map((t) => ({ ...t, selected: false })),
											newTab,
										]);
									}}
								>
									Duplicate tab
								</HSComp.ContextMenuItem>
								<HSComp.ContextMenuSeparator />
								<HSComp.ContextMenuItem onClick={() => closeTab(tab.id)}>
									Close tab
								</HSComp.ContextMenuItem>
								<HSComp.ContextMenuItem
									onClick={() =>
										setTabs((prev) => {
											const kept = prev.find((t) => t.id === tab.id);
											return kept ? [{ ...kept, selected: true }] : prev;
										})
									}
								>
									Close other tabs
								</HSComp.ContextMenuItem>
								<HSComp.ContextMenuItem
									onClick={() => {
										const idx = tabs.findIndex((t) => t.id === tab.id);
										setTabs((prev) => prev.filter((_, i) => i >= idx));
									}}
								>
									Close tabs to left
								</HSComp.ContextMenuItem>
								<HSComp.ContextMenuItem
									onClick={() => {
										const idx = tabs.findIndex((t) => t.id === tab.id);
										setTabs((prev) => prev.filter((_, i) => i <= idx));
									}}
								>
									Close tabs to right
								</HSComp.ContextMenuItem>
							</HSComp.ContextMenuContent>
						</HSComp.ContextMenu>
					))}
				</HSComp.TabsBrowserList>
				<HSComp.TabsAddButton onClick={addTab} />
				<HSComp.TabsListDropdown
					tabs={tabs.map((tab) => ({
						id: tab.id,
						content: (
							<span className="flex items-center gap-1 truncate">
								<span className={methodColors[tab.method]}>{tab.method}</span>
								<span className="typo-body-xs">
									{tab.path || "New request"}
								</span>
							</span>
						),
					}))}
					handleTabSelect={selectTab}
					handleCloseTab={closeTab}
				/>
			</HSComp.Tabs>

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
							Debug
						</HSComp.Button>
					</HSComp.TooltipTrigger>
					<HSComp.TooltipContent>
						Debug request (Ctrl+Enter / ⌘+Enter)
					</HSComp.TooltipContent>
				</HSComp.Tooltip>
			</div>

			{/* Request + Response split */}
			<HSComp.ResizablePanelGroup
				direction="vertical"
				autoSaveId="access-policy-devtool-req-resp"
				className="grow min-h-0 relative"
			>
				{/* Request sub-tabs: Params, Headers, Body, Raw */}
				<HSComp.ResizablePanel defaultSize={40} minSize={15}>
					<div
						className={`flex flex-col h-full ${maximized === "request" ? "absolute top-0 left-0 w-full h-full z-30 bg-bg-primary" : ""}`}
					>
						<HSComp.Tabs
							value={selectedTab.activeRequestSubTab}
							onValueChange={(v) =>
								handleRequestSubTabChange(v as RequestSubTab)
							}
							className="flex flex-col h-full"
						>
							<div className="flex items-center justify-between bg-bg-secondary px-4 border-b h-10 shrink-0">
								<div className="flex items-center">
									<span className="typo-label text-text-secondary pr-3">
										Request:
									</span>
									<HSComp.TabsList>
										<HSComp.TabsTrigger value="params">
											Params
										</HSComp.TabsTrigger>
										<HSComp.TabsTrigger value="headers">
											Headers
										</HSComp.TabsTrigger>
										<HSComp.TabsTrigger value="body">Body</HSComp.TabsTrigger>
										<HSComp.TabsTrigger value="raw">Raw</HSComp.TabsTrigger>
									</HSComp.TabsList>
								</div>
								<HSComp.Tooltip>
									<HSComp.TooltipTrigger asChild>
										<HSComp.Button
											variant="ghost"
											size="small"
											onClick={() =>
												setMaximized(maximized === "request" ? null : "request")
											}
										>
											{maximized === "request" ? (
												<Lucide.PanelTopClose className="size-4" />
											) : (
												<Lucide.PanelTopOpen className="size-4" />
											)}
										</HSComp.Button>
									</HSComp.TooltipTrigger>
									<HSComp.TooltipContent align="end">
										{maximized === "request"
											? "Show response panel"
											: "Hide response panel"}
									</HSComp.TooltipContent>
								</HSComp.Tooltip>
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
							<HSComp.TabsContent
								value="body"
								className="relative grow min-h-0"
							>
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
					</div>
				</HSComp.ResizablePanel>

				<HSComp.ResizableHandle />

				{/* Response: Policy eval, RequestContext, Headers */}
				<HSComp.ResizablePanel defaultSize={60} minSize={15}>
					<div
						className={`flex flex-col h-full ${maximized === "response" ? "absolute top-0 left-0 w-full h-full z-30 bg-bg-primary" : ""}`}
					>
						<HSComp.Tabs
							value={selectedTab.activeResponseTab}
							onValueChange={(v) =>
								handleResponseTabChange(
									v as "policy-eval" | "request-context" | "headers" | "sql",
								)
							}
							className="flex flex-col grow min-h-0"
						>
							<div className="flex items-center justify-between bg-bg-secondary px-4 border-b h-10 shrink-0">
								<div className="flex items-center">
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
										{isSqlEngine && (
											<HSComp.TabsTrigger value="sql">SQL</HSComp.TabsTrigger>
										)}
									</HSComp.TabsList>
								</div>
								<div className="flex items-center gap-1">
									{selectedTab.response && (
										<ResponseInfo response={selectedTab.response} />
									)}
									<HSComp.Tooltip>
										<HSComp.TooltipTrigger asChild>
											<HSComp.Button
												variant="ghost"
												size="small"
												onClick={() =>
													setMaximized(
														maximized === "response" ? null : "response",
													)
												}
											>
												{maximized === "response" ? (
													<Lucide.PanelBottomClose className="size-4" />
												) : (
													<Lucide.PanelBottomOpen className="size-4" />
												)}
											</HSComp.Button>
										</HSComp.TooltipTrigger>
										<HSComp.TooltipContent align="end">
											{maximized === "response"
												? "Show request panel"
												: "Hide request panel"}
										</HSComp.TooltipContent>
									</HSComp.Tooltip>
								</div>
							</div>
							<HSComp.TabsContent
								value="policy-eval"
								className="grow min-h-0 relative"
							>
								{isLoading ? (
									loadingView
								) : (
									<PolicyEvalView
										response={selectedTab.response}
										currentPolicyId={accessPolicyId}
										allExpanded={allPoliciesExpanded}
									/>
								)}
								{!isLoading && selectedTab.response && (
									<div className="absolute top-2 right-4 flex items-center border rounded-full p-2 border-border-secondary bg-bg-primary shadow-sm">
										<HSComp.Tooltip>
											<HSComp.TooltipTrigger asChild>
												<HSComp.Button
													variant="ghost"
													size="small"
													onClick={() =>
														setAllPoliciesExpanded((prev) =>
															prev === null ? true : !prev,
														)
													}
												>
													{allPoliciesExpanded ? (
														<Lucide.ListChevronsDownUp className="size-4" />
													) : (
														<Lucide.ListChevronsUpDown className="size-4" />
													)}
												</HSComp.Button>
											</HSComp.TooltipTrigger>
											<HSComp.TooltipContent>
												{allPoliciesExpanded ? "Collapse all" : "Expand all"}
											</HSComp.TooltipContent>
										</HSComp.Tooltip>
									</div>
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
							{isSqlEngine && (
								<HSComp.TabsContent value="sql" className="grow min-h-0">
									{isLoading ? (
										loadingView
									) : (
										<SqlQueryView
											response={selectedTab.response}
											accessPolicy={
												accessPolicy as Record<string, unknown> | undefined
											}
										/>
									)}
								</HSComp.TabsContent>
							)}
						</HSComp.Tabs>
					</div>
				</HSComp.ResizablePanel>
			</HSComp.ResizablePanelGroup>
		</div>
	);
}
