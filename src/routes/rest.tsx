import { Prec } from "@codemirror/state";
import { type EditorView, keymap } from "@codemirror/view";
import type * as AidboxTypes from "@health-samurai/aidbox-client";
import {
	Button,
	CodeEditor,
	type GetStructureDefinitions,
	PlayIcon,
	RequestLineEditor,
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	toast,
} from "@health-samurai/react-components";
import {
	type QueryClient,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import * as yaml from "js-yaml";
import { Fullscreen, Minimize2, Timer } from "lucide-react";
import type React from "react";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { format as formatSQL } from "sql-formatter";
import { type AidboxClientR5, useAidboxClient } from "../AidboxClient";
import { fetchUIHistory } from "../api/auth";
import {
	ActiveTabs,
	addTab,
	addTabFromHistory,
	closeOtherTabs,
	closeTabsToLeft,
	closeTabsToRight,
	DEFAULT_TAB,
	type Header,
	type ResponseData,
	removeTab,
	type Tab,
} from "../components/rest/active-tabs";
import * as RestCollections from "../components/rest/collections";
import HeadersEditor from "../components/rest/headers-editor";
import {
	LeftMenu,
	LeftMenuContext,
	LeftMenuToggle,
	parseHttpCommand,
} from "../components/rest/left-menu";
import ParamsEditor from "../components/rest/params-editor";
import {
	computePathSuggestions,
	UrlAutocomplete,
	useRoutes,
} from "../components/rest/url-autocomplete";
import { SplitButton, type SplitDirection } from "../components/Split";
import { CodeEditorMenubar } from "../components/ViewDefinition/code-editor-menubar";
import { useExpandValueSet } from "../hooks/useExpandValueSet";
import { useGetStructureDefinitions } from "../hooks/useGetStructureDefinition";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { HTTP_STATUS_CODES, REST_CONSOLE_TABS_KEY } from "../shared/const";
import { useVimMode } from "../shared/vim-mode";
import { generateId, parseHttpRequest, parsePathParams } from "../utils";
import { outcomeToIssueLines } from "../utils/json-path-offset";
import { responseStorage } from "../utils/response-storage";
import { useWebMCPRestConsole } from "../webmcp/rest-console";
import type { RestConsoleActions } from "../webmcp/rest-console-context";

const TITLE = "REST console";

const preventNewlineOnModEnter = Prec.highest(
	keymap.of([{ key: "Mod-Enter", run: () => true }]),
);

export const Route = createFileRoute("/rest")({
	staticData: {
		title: TITLE,
	},
	component: RouteComponent,
	loader: () => ({ breadCrumb: TITLE }),
});

// ── OperationOutcome → issue line numbers ─────────────────────────────

function parseResponseBody(responseBody: string): unknown {
	try {
		return JSON.parse(responseBody);
	} catch {
		return yaml.load(responseBody);
	}
}

function operationOutcomeToIssueLines(
	bodyText: string,
	responseBody: string,
	mode: "json" | "yaml" = "json",
): { line: number; message?: string }[] {
	try {
		const outcome = parseResponseBody(responseBody) as Record<string, unknown>;
		if (outcome?.resourceType !== "OperationOutcome" || !outcome.issue) {
			return [];
		}
		return outcomeToIssueLines(
			bodyText,
			outcome.issue as Parameters<typeof outcomeToIssueLines>[1],
			mode,
		);
	} catch {
		return [];
	}
}

function splitRaw(raw: string): { head: string; body: string } {
	const idx = raw.indexOf("\n\n");
	if (idx === -1) return { head: raw, body: "" };
	return { head: raw.slice(0, idx), body: raw.slice(idx + 2) };
}

function convertBody(
	body: string,
	fromMode: "json" | "yaml",
	toMode: "json" | "yaml",
): string {
	if (!body.trim() || fromMode === toMode) return body;
	try {
		const parsed = fromMode === "yaml" ? yaml.load(body) : JSON.parse(body);
		return toMode === "yaml"
			? yaml.dump(parsed, { indent: 2 })
			: JSON.stringify(parsed, null, 2);
	} catch {
		return body;
	}
}

function formatBody(body: string, mode: "json" | "yaml"): string {
	if (!body.trim()) return body;
	try {
		if (mode === "yaml") {
			return yaml.dump(yaml.load(body), { indent: 2 });
		}
		return JSON.stringify(JSON.parse(body), null, 2);
	} catch {
		return body;
	}
}

function updateHeadersForMode(head: string, mode: "json" | "yaml"): string {
	const ct = mode === "yaml" ? "text/yaml" : "application/json";
	const lines = head.split("\n");
	let foundCt = false;
	let foundAccept = false;
	const updated = lines.map((line) => {
		if (/^content-type\s*:/i.test(line)) {
			foundCt = true;
			return `Content-Type: ${ct}`;
		}
		if (/^accept\s*:/i.test(line)) {
			foundAccept = true;
			return `Accept: ${ct}`;
		}
		return line;
	});
	if (!foundCt) updated.push(`Content-Type: ${ct}`);
	if (!foundAccept) updated.push(`Accept: ${ct}`);
	return updated.join("\n");
}

function RawEditor({
	selectedTab,
	requestLineVersion,
	onRawChange,
	getStructureDefinitions,
	expandValueSet,
	resourceTypeHint,
	getUrlSuggestions,
	issueLineNumbers,
}: {
	selectedTab: Tab;
	requestLineVersion: string;
	onRawChange?: (rawText: string) => void;
	getStructureDefinitions?: GetStructureDefinitions;
	expandValueSet?: (
		url: string,
		filter: string,
	) => Promise<{ code: string; display?: string; system?: string }[]>;
	resourceTypeHint?: string;
	getUrlSuggestions?: (
		path: string,
		method: string,
	) =>
		| { label: string; value: string; type?: string }[]
		| Promise<{ label: string; value: string; type?: string }[]>;
	issueLineNumbers?: { line: number; message?: string }[];
}) {
	const vimMode = useVimMode();
	const defaultRequestLine = `${selectedTab.method} ${selectedTab.path || "/"}`;
	const defaultHeaders =
		selectedTab.headers
			?.filter(
				(header) => header.name && header.value && (header.enabled ?? true),
			)
			.map((header) => `${header.name}: ${header.value}`)
			.join("\n") || "";

	const initialValue = `${defaultRequestLine}\n${defaultHeaders}\n\n${selectedTab.body || ""}`;
	const [rawValue, setRawValue] = useState(initialValue);
	const [bodyMode, setBodyMode] = useLocalStorage<"json" | "yaml">({
		key: `rest-console-raw-body-mode-${selectedTab.id}`,
		getInitialValueInEffect: false,
		defaultValue: "json",
	});
	const viewRef = useRef<EditorView | null>(null);

	const bodyModeRef = useRef(bodyMode);
	bodyModeRef.current = bodyMode;

	// Shift issue line numbers to account for headers in raw mode
	const rawIssueLines = useMemo(() => {
		if (!issueLineNumbers) return undefined;
		const sepIdx = rawValue.indexOf("\n\n");
		if (sepIdx === -1) return undefined;
		let headerLines = 0;
		for (let i = 0; i < sepIdx; i++) {
			if (rawValue[i] === "\n") headerLines++;
		}
		const offset = headerLines + 2; // +2 for the blank line
		return issueLineNumbers.map((il) => ({
			line: il.line + offset,
			message: il.message,
		}));
	}, [issueLineNumbers, rawValue]);

	const handleChange = (value: string) => {
		setRawValue(value);
		onRawChange?.(value);
	};

	const replaceBody = (newBody: string, newHead?: string) => {
		const view = viewRef.current;
		if (!view) return;
		const doc = view.state.doc.toString();
		const sepIdx = doc.indexOf("\n\n");
		if (sepIdx === -1) return;
		const head = doc.slice(0, sepIdx);
		const finalHead = newHead ?? head;
		const newDoc = `${finalHead}\n\n${newBody}`;
		// Keep cursor at same relative position, clamped to new doc length
		const cursor = Math.min(view.state.selection.main.head, newDoc.length);
		view.dispatch({
			changes: { from: 0, to: doc.length, insert: newDoc },
			selection: { anchor: cursor },
		});
		setRawValue(newDoc);
		onRawChange?.(newDoc);
	};

	const handleModeChange = (newMode: "json" | "yaml") => {
		const { head, body } = splitRaw(rawValue);
		const converted = convertBody(body, bodyMode, newMode);
		const updatedHead = updateHeadersForMode(head, newMode);
		setBodyMode(newMode);
		replaceBody(converted, updatedHead);
	};

	const handleFormat = () => {
		const { body } = splitRaw(rawValue);
		const formatted = formatBody(body, bodyMode);
		replaceBody(formatted);
	};

	return (
		<div className="relative h-full">
			<div className="sticky min-h-0 h-0 flex justify-end pt-2 pr-3 top-0 right-0 z-10">
				<CodeEditorMenubar
					mode={bodyMode}
					onModeChange={handleModeChange}
					textToCopy={rawValue}
					onFormat={handleFormat}
				/>
			</div>
			<CodeEditor
				key={`raw-editor-${selectedTab.id}-${requestLineVersion}`}
				defaultValue={initialValue}
				mode="http"
				additionalExtensions={[preventNewlineOnModEnter]}
				getStructureDefinitions={getStructureDefinitions}
				expandValueSet={expandValueSet}
				resourceTypeHint={resourceTypeHint}
				getUrlSuggestions={getUrlSuggestions}
				issueLineNumbers={rawIssueLines}
				vimMode={vimMode}
				viewCallback={(v) => {
					viewRef.current = v;
				}}
				onChange={handleChange}
			/>
		</div>
	);
}

function detectBodyModeFromHeaders(
	headers: Header[],
	currentBodyMode: "json" | "yaml",
): "json" | "yaml" | null {
	const contentTypeHeader = headers.find(
		(h) => h.name?.toLowerCase() === "content-type" && (h.enabled ?? true),
	);
	const acceptHeader = headers.find(
		(h) => h.name?.toLowerCase() === "accept" && (h.enabled ?? true),
	);
	const headerToCheck = contentTypeHeader || acceptHeader;
	if (!headerToCheck?.value) return null;

	const value = headerToCheck.value.toLowerCase().trim();
	if (value === "text/yaml" || value === "application/x-yaml") {
		return currentBodyMode !== "yaml" ? "yaml" : null;
	}
	if (value === "application/json") {
		return currentBodyMode !== "json" ? "json" : null;
	}
	return null;
}

/** Upsert a header by name (case-insensitive). Inserts before the empty row if possible. */
function upsertHeader(
	headers: Header[],
	headerName: string,
	value: string,
): void {
	const index = headers.findIndex(
		(h) => h.name?.toLowerCase() === headerName.toLowerCase(),
	);
	if (index >= 0 && headers[index]) {
		const existing = headers[index];
		headers[index] = {
			id: existing.id,
			name: existing.name,
			value,
			...(existing.enabled !== undefined && { enabled: existing.enabled }),
		};
		return;
	}
	const newHeader = {
		id: crypto.randomUUID(),
		name: headerName,
		value,
		enabled: true,
	};
	const emptyRowIndex = headers.findIndex(
		(h) => h.name === "" && h.value === "",
	);
	if (emptyRowIndex >= 0) {
		headers.splice(emptyRowIndex, 0, newHeader);
	} else {
		headers.push(newHeader);
	}
}

/** Build updated headers list when body mode changes. Returns null if no update needed. */
function buildHeadersForBodyMode(
	selectedHeaders: Header[] | undefined,
	bodyMode: "json" | "yaml",
): Header[] | null {
	const contentType = bodyMode === "yaml" ? "text/yaml" : "application/json";
	const headers = Array.isArray(selectedHeaders) ? [...selectedHeaders] : [];

	const contentTypeIndex = headers.findIndex(
		(h) => h.name?.toLowerCase() === "content-type",
	);
	const acceptIndex = headers.findIndex(
		(h) => h.name?.toLowerCase() === "accept",
	);

	const needsContentTypeUpdate =
		contentTypeIndex < 0 || headers[contentTypeIndex]?.value !== contentType;
	const needsAcceptUpdate =
		acceptIndex < 0 || headers[acceptIndex]?.value !== contentType;

	if (!needsContentTypeUpdate && !needsAcceptUpdate) return null;

	if (needsContentTypeUpdate)
		upsertHeader(headers, "Content-Type", contentType);
	if (needsAcceptUpdate) upsertHeader(headers, "Accept", contentType);

	return headers;
}

function RequestView({
	selectedTab,
	requestLineVersion,
	onBodyChange,
	onSubTabChange,
	onHeaderChange,
	onParamChange,
	onRawChange,
	onHeaderRemove,
	onParamRemove,
	onFullScreenToggle,
	fullScreenState,
	onBodyModeChange,
	onHeadersUpdate,
	webmcpActionsRef,
	getStructureDefinitions,
	expandValueSet,
	getUrlSuggestions,
}: {
	selectedTab: Tab;
	requestLineVersion: string;
	onBodyChange: (body: string) => void;
	onSubTabChange: (subTab: "params" | "headers" | "body" | "raw") => void;
	onHeaderChange: (headerIndex: number, header: Header) => void;
	onParamChange: (paramIndex: number, param: Header) => void;
	onRawChange: (rawText: string) => void;
	onHeaderRemove: (headerIndex: number) => void;
	onParamRemove: (paramIndex: number) => void;
	onFullScreenToggle: (state: "maximized" | "normal") => void;
	fullScreenState: "maximized" | "normal";
	onBodyModeChange: (mode: "json" | "yaml") => void;
	onHeadersUpdate: (headers: Header[]) => void;
	webmcpActionsRef: React.RefObject<RestConsoleActions>;
	getStructureDefinitions?: GetStructureDefinitions;
	expandValueSet?: (
		url: string,
		filter: string,
	) => Promise<{ code: string; display?: string; system?: string }[]>;
	getUrlSuggestions?: (
		path: string,
		method: string,
	) =>
		| { label: string; value: string; type?: string }[]
		| Promise<{ label: string; value: string; type?: string }[]>;
}) {
	const vimMode = useVimMode();
	const currentActiveSubTab = selectedTab.activeSubTab || "body";

	const resourceTypeHint = useMemo(() => {
		const pathWithoutQuery = (selectedTab.path || "").split("?")[0] ?? "";
		const segments = pathWithoutQuery.split("/").filter(Boolean);
		return segments.find((s) => /^[A-Z]/.test(s)) ?? undefined;
	}, [selectedTab.path]);

	const [bodyMode, setBodyMode] = useLocalStorage<"json" | "yaml">({
		key: `rest-console-body-mode-${selectedTab.id}`,
		getInitialValueInEffect: false,
		defaultValue: "json",
	});

	const [bodyEditorValue, setBodyEditorValue] = useState(
		selectedTab.body || "",
	);

	// Track whether body was edited after last response
	const [bodyEditedSinceResponse, setBodyEditedSinceResponse] = useState(false);
	const prevResponseRef = useRef(selectedTab.response);
	if (selectedTab.response !== prevResponseRef.current) {
		prevResponseRef.current = selectedTab.response;
		setBodyEditedSinceResponse(false);
	}

	const responseIssueLines = useMemo(() => {
		if (bodyEditedSinceResponse) return undefined;
		const responseBody = selectedTab.response?.body;
		if (!responseBody || !bodyEditorValue) return undefined;
		const lines = operationOutcomeToIssueLines(
			bodyEditorValue,
			responseBody,
			bodyMode,
		);
		return lines.length > 0 ? lines : undefined;
	}, [
		selectedTab.response?.body,
		bodyEditorValue,
		bodyEditedSinceResponse,
		bodyMode,
	]);

	const isUpdatingHeadersRef = useRef(false);

	useEffect(() => {
		setBodyEditorValue((prev) => {
			const next = selectedTab.body || "";
			// Mark as edited when body changes from external source (e.g. Raw tab)
			if (prev !== next) setBodyEditedSinceResponse(true);
			return next;
		});
	}, [selectedTab.body]);

	// Sync body mode when Content-Type or Accept header changes (from external sources like Raw/Headers tab)
	const [prevSelectedTabHeaders, setPrevSelectedTabHeaders] = useState<
		typeof selectedTab.headers | null
	>(null);

	if (selectedTab.headers !== prevSelectedTabHeaders) {
		setPrevSelectedTabHeaders(selectedTab.headers);
		if (!isUpdatingHeadersRef.current) {
			const headers = Array.isArray(selectedTab.headers)
				? selectedTab.headers
				: [];
			const newMode = detectBodyModeFromHeaders(headers, bodyMode);
			if (newMode) setBodyMode(newMode);
		}
	}

	const [prevBodyMode, setPrevBodyMode] = useState<typeof bodyMode | null>(
		null,
	);

	// Update Content-Type and Accept headers based on body mode
	if (bodyMode !== prevBodyMode) {
		setPrevBodyMode(bodyMode);

		const updatedHeaders = buildHeadersForBodyMode(
			selectedTab.headers,
			bodyMode,
		);
		if (updatedHeaders) {
			isUpdatingHeadersRef.current = true;
			onHeadersUpdate(updatedHeaders);
			setTimeout(() => {
				isUpdatingHeadersRef.current = false;
			}, 0);
		}
	}

	const getEditorValue = () => {
		return bodyEditorValue;
	};

	const handleBodyModeChange = (newMode: "json" | "yaml") => {
		const currentBody = bodyEditorValue.trim();
		if (!currentBody) {
			setBodyMode(newMode);
			onBodyModeChange(newMode);
			return;
		}

		const convertedBody = convertBody(currentBody, bodyMode, newMode);
		if (convertedBody === currentBody) {
			toast.error(`Failed to convert to ${newMode.toUpperCase()}`, {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
			return;
		}

		setBodyEditorValue(convertedBody);
		onBodyChange(convertedBody);
		setBodyMode(newMode);
		onBodyModeChange(newMode);
	};

	const handleFormatBody = () => {
		const currentBody = bodyEditorValue.trim();
		if (!currentBody) return;

		const formattedBody = formatBody(currentBody, bodyMode);
		if (formattedBody === currentBody) {
			toast.error("Failed to format code", {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
			return;
		}

		setBodyEditorValue(formattedBody);
		onBodyChange(formattedBody);
		toast.success("Code formatted", {
			position: "bottom-right",
			style: { margin: "1rem" },
		});
	};

	const handleBodyEditorChange = (value: string) => {
		setBodyEditorValue(value);
		onBodyChange(value);
		setBodyEditedSinceResponse(true);
	};

	// Override WebMCP stubs with real implementations
	webmcpActionsRef.current.getBodyMode = () => bodyMode;
	webmcpActionsRef.current.setBodyMode = handleBodyModeChange;
	webmcpActionsRef.current.formatBody = handleFormatBody;

	return (
		<div className="flex flex-col h-full">
			<Tabs
				value={currentActiveSubTab}
				onValueChange={(value) =>
					onSubTabChange(value as "params" | "headers" | "body" | "raw")
				}
			>
				<div className="flex items-center justify-between bg-bg-secondary px-4 border-b h-10">
					<div className="flex items-center">
						<span className="typo-label text-text-secondary pr-3">
							Request:
						</span>
						<TabsList>
							<TabsTrigger value="params">Params</TabsTrigger>
							<TabsTrigger value="headers">Headers</TabsTrigger>
							<TabsTrigger value="body">Body</TabsTrigger>
							<TabsTrigger value="raw">Raw</TabsTrigger>
						</TabsList>
					</div>
					<ExpandPane
						onToggle={(state) => onFullScreenToggle(state)}
						state={fullScreenState}
					/>
				</div>
				<TabsContent value="params">
					<ParamsEditor
						params={selectedTab.params || []}
						onParamChange={onParamChange}
						onParamRemove={onParamRemove}
					/>
				</TabsContent>
				<TabsContent value="headers">
					<HeadersEditor
						headers={selectedTab.headers || []}
						onHeaderChange={onHeaderChange}
						onHeaderRemove={onHeaderRemove}
					/>
				</TabsContent>
				<TabsContent value="body" className="relative h-full">
					<div className="sticky min-h-0 h-0 flex justify-end pt-2 pr-3 top-0 right-0 z-10">
						<CodeEditorMenubar
							mode={bodyMode}
							onModeChange={handleBodyModeChange}
							textToCopy={bodyEditorValue}
							onFormat={handleFormatBody}
						/>
					</div>
					<CodeEditor
						id={`request-editor-${selectedTab.id}-${currentActiveSubTab}`}
						key={`request-editor-${selectedTab.id}`}
						currentValue={getEditorValue()}
						mode={bodyMode}
						onChange={handleBodyEditorChange}
						additionalExtensions={[preventNewlineOnModEnter]}
						getStructureDefinitions={getStructureDefinitions}
						expandValueSet={expandValueSet}
						resourceTypeHint={resourceTypeHint}
						issueLineNumbers={responseIssueLines}
						vimMode={vimMode}
					/>
				</TabsContent>
				<TabsContent value="raw">
					<RawEditor
						requestLineVersion={requestLineVersion}
						selectedTab={selectedTab}
						onRawChange={onRawChange}
						getStructureDefinitions={getStructureDefinitions}
						expandValueSet={expandValueSet}
						resourceTypeHint={resourceTypeHint}
						getUrlSuggestions={getUrlSuggestions}
						issueLineNumbers={responseIssueLines}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}

type ResponseTabs = "body" | "headers" | "raw" | "explain";

function ResponseStatus({
	status,
	statusText,
}: {
	status: number;
	statusText?: string;
}) {
	const messageColor =
		status >= 400 ? "text-critical-default" : "text-green-500";
	return (
		<span className="flex font-medium items-center text-text-secondary text-sm min-w-0 shrink">
			<span className="shrink-0">Status:</span>
			<span className={`ml-1 ${messageColor} truncate`}>
				{status}{" "}
				<span className="hidden sm:inline">
					{statusText || HTTP_STATUS_CODES[status]}
				</span>
			</span>
		</span>
	);
}

function ExpandPane({
	onToggle,
	state,
}: {
	onToggle: (state: "maximized" | "normal") => void;
	state: "maximized" | "normal";
}) {
	if (state === "normal") {
		return (
			<Button variant="link" size="small" onClick={() => onToggle("maximized")}>
				<Fullscreen />
			</Button>
		);
	} else {
		return (
			<div className="flex gap-2 items-center">
				<span className="typo-body text-text-secondary">Esc</span>
				<Button
					variant="primary"
					size="small"
					onClick={() => onToggle("normal")}
				>
					<Minimize2 />
				</Button>
			</div>
		);
	}
}

type ResponsePaneProps = {
	response: ResponseData | null;
	splitState: SplitDirection;
	onSplitChange: (mode: SplitDirection) => void;
	onFullScreenToggle: (state: "maximized" | "normal") => void;
	fullScreenState: "maximized" | "normal";
	isLoading: boolean;
	activeResponseTab: ResponseTabs;
	onResponseTabChange: (tab: ResponseTabs) => void;
	selectedTab: Tab;
	aidboxClient: AidboxClientR5;
	sendVersion: number;
};

function ResponseInfo({ response }: { response: ResponseData }) {
	if (response) {
		return (
			<>
				<ResponseStatus
					status={response.status}
					statusText={response.statusText}
				/>
				<span className="flex items-center text-text-secondary text-sm pl-2">
					<Timer className="size-4 mr-1" strokeWidth={1.5} />
					<span className="font-bold">{Math.round(response.duration)}</span>
					<span className="ml-1">ms</span>
				</span>
			</>
		);
	}
}

function ResponseView({
	response,
	activeResponseTab,
	isLoading,
	responseMode,
	selectedTab,
	aidboxClient,
	sendVersion,
}: {
	response: ResponseData | null;
	activeResponseTab: ResponseTabs;
	isLoading: boolean;
	responseMode: "json" | "yaml";
	selectedTab: Tab;
	aidboxClient: AidboxClientR5;
	sendVersion: number;
}) {
	if (activeResponseTab === "explain") {
		return (
			<ExplainView
				key={`explain-${selectedTab.id}`}
				selectedTab={selectedTab}
				sendVersion={sendVersion}
				aidboxClient={aidboxClient}
			/>
		);
	}

	const getEditorContent = () => {
		if (!response) return "";

		switch (activeResponseTab) {
			case "headers":
				if (responseMode === "yaml") {
					return yaml.dump(response.headers, { indent: 2 });
				}
				return JSON.stringify(response.headers, null, 2);
			case "raw":
				return `HTTP/1.1 ${response.status} ${response.statusText}\n${Object.entries(
					response.headers,
				)
					.map(([key, value]) => `${key}: ${value}`)
					.join("\n")}\n\n${response.body}`;
			default:
				if (responseMode === "yaml") {
					try {
						// Try to parse as JSON first, then convert to YAML
						const parsed = JSON.parse(response.body);
						return yaml.dump(parsed, { indent: 2 });
					} catch {
						// If it's already YAML or invalid, return as-is
						return response.body;
					}
				}
				try {
					const parsed = JSON.parse(response.body);
					return JSON.stringify(parsed, null, 2);
				} catch {
					return response.body;
				}
		}
	};

	const getEditorMode = () => {
		if (activeResponseTab === "raw") return "http";
		return responseMode;
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary bg-bg-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Loading...</div>
					<div className="text-sm">Processing request</div>
				</div>
			</div>
		);
	}

	if (response) {
		return (
			<CodeEditor
				readOnly={true}
				key={`response-${activeResponseTab}-${response.status}-${responseMode}`}
				currentValue={getEditorContent()}
				mode={getEditorMode()}
			/>
		);
	} else {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary bg-bg-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">No response yet</div>
					<div className="text-sm">Send a request to see the response</div>
				</div>
			</div>
		);
	}
}

function isGetSearchRequest(tab: Tab): boolean {
	if (tab.method !== "GET") return false;
	const pathWithoutQuery = (tab.path || "/").split("?")[0] || "/";
	const normalized = pathWithoutQuery.replace(/\/+$/, "");
	const segments = normalized.split("/").filter(Boolean);
	// Search requests target a resource type (odd segments):
	//   /Patient (1), /fhir/Patient (2 with prefix, but "fhir" is a prefix)
	// Instance reads target a specific resource (even segments after type):
	//   /Patient/123 (2), /fhir/Patient/123 (3 with prefix)
	// Heuristic: if the last segment looks like an id (not a resource type name),
	// it's an instance read. Resource type names start with uppercase.
	if (segments.length === 0) return true; // root path like "/"
	const lastSegment = segments[segments.length - 1] || "";
	// If the last segment starts with uppercase, it's likely a resource type → search
	// If it starts with lowercase or is a number/uuid, it's likely an id → instance read
	return /^[A-Z]/.test(lastSegment);
}

type ExplainResponse = {
	query?: [string, ...unknown[]];
	"query-inline"?: [string];
	plan?: string;
};

function buildHeaders(tab: Tab): Record<string, string> {
	return (
		tab.headers
			?.filter(
				(header) => header.name && header.value && (header.enabled ?? true),
			)
			.reduce(
				(acc, header) => {
					const name: string =
						canonicalHeaderNames[header.name.toLowerCase()] || header.name;
					acc[name] = header.value;
					return acc;
				},
				{} as Record<string, string>,
			) ?? {}
	);
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
	} catch (error) {
		console.warn("Failed to format SQL:", error);
		return sql;
	}
}

function ExplainView({
	selectedTab,
	aidboxClient,
	sendVersion,
}: {
	selectedTab: Tab;
	aidboxClient: AidboxClientR5;
	sendVersion: number;
}) {
	const { isLoading, data, error } = useQuery({
		queryKey: ["rest-console-explain", selectedTab.id, sendVersion],
		queryFn: async (): Promise<ExplainResponse> => {
			const headers = buildHeaders(selectedTab);
			headers.Accept = "application/json";
			const basePath = selectedTab.path || "/";
			const explainUrl = `${basePath}${basePath.includes("?") ? "&" : "?"}_explain=analyze`;

			const response = await aidboxClient.rawRequest({
				method: selectedTab.method,
				url: explainUrl,
				headers,
				body: selectedTab.body || "",
			});

			return response.response.json();
		},
		retry: false,
		refetchOnWindowFocus: false,
	});

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
					<div className="text-sm text-critical-default">
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
						The explain operation is not supported for non-search requests
					</div>
				</div>
			</div>
		);
	}

	const defaultSubTab = inlineSQL ? "query" : querySQL ? "statement" : "plan";

	return (
		<Tabs
			variant="tertiary"
			defaultValue={defaultSubTab}
			className="flex flex-col grow min-h-0"
		>
			<div className="flex items-center bg-bg-secondary h-10 border-b shrink-0">
				<TabsList className="py-0! border-b-0!">
					{inlineSQL && <TabsTrigger value="query">Query</TabsTrigger>}
					{querySQL && <TabsTrigger value="statement">Statement</TabsTrigger>}
					{plan && <TabsTrigger value="plan">Execution Plan</TabsTrigger>}
				</TabsList>
			</div>
			{inlineSQL && (
				<TabsContent value="query" className="grow min-h-0">
					<CodeEditor readOnly currentValue={inlineSQL} mode="sql" />
				</TabsContent>
			)}
			{querySQL && (
				<TabsContent value="statement" className="grow min-h-0">
					{queryParams.length > 0 ? (
						<ResizablePanelGroup direction="vertical">
							<ResizablePanel minSize={20}>
								<CodeEditor readOnly currentValue={querySQL} mode="sql" />
							</ResizablePanel>
							<ResizableHandle />
							<ResizablePanel defaultSize={30} minSize={10}>
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
							</ResizablePanel>
						</ResizablePanelGroup>
					) : (
						<CodeEditor readOnly currentValue={querySQL} mode="sql" />
					)}
				</TabsContent>
			)}
			{plan && (
				<TabsContent
					value="plan"
					className="grow min-h-0 overflow-auto bg-bg-primary"
				>
					<pre className="p-4 typo-code text-text-primary whitespace-pre">
						{plan}
					</pre>
				</TabsContent>
			)}
		</Tabs>
	);
}

function ResponsePane({
	splitState,
	onSplitChange,
	response,
	onFullScreenToggle,
	fullScreenState,
	isLoading,
	activeResponseTab,
	onResponseTabChange,
	selectedTab,
	aidboxClient,
	sendVersion,
}: ResponsePaneProps) {
	// Use response mode from the response itself (set at request time)
	const responseMode = response?.mode || "json";

	return (
		<Tabs
			value={activeResponseTab}
			className="flex flex-col h-full"
			onValueChange={(value) => onResponseTabChange(value as ResponseTabs)}
		>
			<div className="flex items-center justify-between bg-bg-secondary px-4 h-10 border-b">
				<div className="flex items-center">
					<span className="typo-label text-text-secondary pr-3">Response:</span>
					<TabsList>
						<TabsTrigger value="body">Body</TabsTrigger>
						<TabsTrigger value="headers">Headers</TabsTrigger>
						<TabsTrigger value="raw">Raw</TabsTrigger>
						{isGetSearchRequest(selectedTab) && (
							<TabsTrigger value="explain">Explain</TabsTrigger>
						)}
					</TabsList>
				</div>
				<div className="flex items-center gap-1">
					{response && activeResponseTab !== "explain" && (
						<ResponseInfo response={response} />
					)}
					{fullScreenState === "normal" && (
						<SplitButton
							direction={splitState}
							onChange={(newMode) => onSplitChange(newMode)}
						/>
					)}
					<ExpandPane
						onToggle={(state) => onFullScreenToggle(state)}
						state={fullScreenState}
					/>
				</div>
			</div>
			<div className="flex-1 min-h-0 overflow-hidden">
				<ResponseView
					response={response}
					activeResponseTab={activeResponseTab}
					isLoading={isLoading}
					responseMode={responseMode}
					selectedTab={selectedTab}
					aidboxClient={aidboxClient}
					sendVersion={sendVersion}
				/>
			</div>
		</Tabs>
	);
}

function handleTabRequestPathChange(
	path: string,
	tabs: Tab[],
	setTabs: (tabs: Tab[]) => void,
) {
	const params = parsePathParams(path);
	setTabs(
		tabs.map((tab) => (tab.selected ? { ...tab, path, params } : tab)) as Tab[],
	);
}

const canonicalHeaderNames: Record<string, string> = {
	"content-type": "Content-Type",
	accept: "Accept",
};

async function executeRequest(
	tab: Tab,
	aidboxClient: AidboxClientR5,
): Promise<ResponseData> {
	const headers = buildHeaders(tab);
	const acceptHeader = tab.headers?.find(
		(h) => h.name?.toLowerCase() === "accept" && (h.enabled ?? true),
	);
	const responseMode: "json" | "yaml" =
		acceptHeader?.value?.toLowerCase().trim() === "text/yaml" ? "yaml" : "json";

	try {
		const hasBody = tab.method !== "GET" && tab.method !== "DELETE";
		const response: AidboxTypes.ResponseWithMeta =
			await aidboxClient.rawRequest({
				method: tab.method,
				url: tab.path || "/",
				headers,
				...(hasBody && tab.body ? { body: tab.body } : {}),
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

function handleSendRequest(
	selectedTab: Tab,
	queryClient: QueryClient,
	setIsLoading: (loading: boolean) => void,
	setResponse: (tabId: string, response: ResponseData) => void,
	aidboxClient: AidboxClientR5,
) {
	saveToUIHistory(selectedTab, queryClient, aidboxClient);
	setIsLoading(true);
	executeRequest(selectedTab, aidboxClient)
		.then((responseData) => setResponse(selectedTab.id, responseData))
		.finally(() => setIsLoading(false));
}

function requestParamsHasEmpty(params: Header[]) {
	return params.some((p) => p.name === "" && p.value === "");
}

function requestParamsEditorSyncPath(params: Header[], path: string) {
	const location = path.split("?")[0];
	const queryParams = params
		.filter((param) => param.enabled ?? true)
		.map((param) => (param.name ? `${param.name}=${param.value}` : ""))
		.filter((param) => param !== "")
		.join("&");
	return queryParams ? `${location}?${queryParams}` : location;
}

// Helper function to format request as HTTP command for history
function formatRequestAsHttpCommand(tab: Tab): string {
	const method = tab.method;
	const path = tab.path || "/";

	// Format headers - note: using colon without space after header name to match expected format
	const headerLines =
		tab.headers
			?.filter(
				(header) => header.name && header.value && (header.enabled ?? true),
			)
			.map((header) => `${header.name}:${header.value}`)
			.join("\n") || "";

	// Format body
	const body = tab.body?.trim() || "";

	// Combine all parts
	let command = `${method} ${path}`;
	if (headerLines) {
		command += `\n${headerLines}`;
	}
	if (body) {
		command += `\n\n${body}`;
	}

	return command;
}

// Helper function to save request to UI history
async function saveToUIHistory(
	tab: Tab,
	queryClient: QueryClient,
	aidboxClient: AidboxClientR5,
): Promise<void> {
	try {
		const historyId = generateId();
		const command = formatRequestAsHttpCommand(tab);

		queryClient.invalidateQueries({ queryKey: ["uiHistory"] });

		const historyPayload = {
			type: "http",
			command: command,
		};

		await aidboxClient.rawRequest({
			method: "PUT",
			url: `/ui_history/${historyId}`,
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(historyPayload),
		});

		queryClient.invalidateQueries({ queryKey: ["uiHistory"] });
	} catch (error) {
		// Silently fail - history saving shouldn't block the main request
		console.warn("Failed to save to UI history:", error);
	}
}

function SendButton(
	props: Omit<React.ComponentProps<typeof Button>, "variant">,
) {
	return (
		<Tooltip delayDuration={600}>
			<TooltipTrigger asChild>
				<Button {...props} variant="primary">
					<PlayIcon />
					Send
				</Button>
			</TooltipTrigger>
			<TooltipContent>Send request (Ctrl+Enter / ⌘+Enter)</TooltipContent>
		</Tooltip>
	);
}

// Strip response data from tabs before saving to localStorage
function stripResponsesFromTabs(tabs: Tab[]): Tab[] {
	return tabs.map(({ response, ...rest }) => rest);
}

function RouteComponent() {
	const client = useAidboxClient();
	const getStructureDefinitions = useGetStructureDefinitions();
	const expandValueSet = useExpandValueSet();
	const { data: routesTree } = useRoutes();
	const routesTreeRef = useRef(routesTree);
	routesTreeRef.current = routesTree;
	const clientRef = useRef(client);
	clientRef.current = client;
	const searchParamsCache = useRef<
		Record<string, { code: string; type?: string; expression?: string }[]>
	>({});

	const getUrlSuggestions = useCallback(
		async (path: string, method: string) => {
			const tree = routesTreeRef.current;
			if (!tree) return [];

			if (path.includes("?")) {
				const pathPart = path.split("?")[0] ?? "";
				const segments = pathPart.split("/").filter(Boolean);
				const resourceType = segments.find((s) => /^[A-Z]/.test(s)) ?? null;

				let searchParams = searchParamsCache.current[resourceType ?? ""] ?? [];
				if (resourceType && !searchParamsCache.current[resourceType]) {
					try {
						const bases = [
							resourceType,
							"DomainResource",
							"Resource",
							"Base",
						].join(",");
						const resp = await clientRef.current.rawRequest({
							method: "GET",
							url: `/fhir/SearchParameter?base=${bases}&_count=500&_elements=code,type,expression`,
							headers: { Accept: "application/json" },
						});
						const data = await resp.response.json();
						searchParams = (data.entry || []).map(
							(e: {
								resource: { code: string; type?: string; expression?: string };
							}) => e.resource,
						);
						searchParamsCache.current[resourceType] = searchParams;
					} catch {
						searchParams = [];
					}
				}

				return computePathSuggestions(
					tree,
					path,
					method,
					searchParams,
					resourceType,
				);
			}

			return computePathSuggestions(tree, path, method);
		},
		[],
	);
	const queryClient = useQueryClient();

	// Responses are stored in IndexedDB, subscribed via useSyncExternalStore
	const responses = useSyncExternalStore(
		responseStorage.subscribe,
		responseStorage.getSnapshot,
	);

	const [tabsRaw, setTabsRaw] = useLocalStorage<Tab[]>({
		key: REST_CONSOLE_TABS_KEY,
		getInitialValueInEffect: false,
		defaultValue: [DEFAULT_TAB],
	});

	// Wrap setTabs to strip responses before saving to localStorage
	const setTabs = useCallback(
		(value: Tab[] | ((prev: Tab[]) => Tab[])) => {
			setTabsRaw((prev) => {
				const newTabs = typeof value === "function" ? value(prev) : value;
				return stripResponsesFromTabs(newTabs);
			});
		},
		[setTabsRaw],
	);

	// Hydrate tabs with responses from IndexedDB
	const tabs = useMemo(() => {
		return tabsRaw.map((tab) => ({
			...tab,
			response: responses.get(tab.id),
		}));
	}, [tabsRaw, responses]);

	const leftPanelRef = useRef<ImperativePanelHandle>(null);

	const [leftMenuOpen, setLeftMenuOpen] = useLocalStorage<boolean>({
		key: "rest-console-left-menu-open",
		getInitialValueInEffect: false,
		defaultValue: true,
	});
	const initialLeftMenuOpen = useRef(leftMenuOpen);
	const [isPanelAnimating, setIsPanelAnimating] = useState(false);

	const [menuTab, setMenuTab] = useLocalStorage<string>({
		key: "rest-console-left-menu-default-tab",
		getInitialValueInEffect: false,
		defaultValue: "history",
	});

	const [historySearch, setHistorySearch] = useState("");

	const selectedTab = useMemo(() => {
		return tabs.find((tab) => tab.selected) || DEFAULT_TAB;
	}, [tabs]);

	const [selectedCollectionItemId, setSelectedCollectionItemId] = useState<
		string | undefined
	>(selectedTab.id);

	const webmcpActionsRef = useRef<RestConsoleActions>({} as RestConsoleActions);
	webmcpActionsRef.current = {
		getLeftMenuOpen: () => leftMenuOpen,
		setLeftMenuOpen: (open) => {
			if (open === leftMenuOpen) return;
			setIsPanelAnimating(true);
			if (open) {
				leftPanelRef.current?.expand();
			} else {
				leftPanelRef.current?.collapse();
			}
			setTimeout(() => setIsPanelAnimating(false), 200);
		},
		getMenuTab: () => menuTab,
		setMenuTab,
		searchHistory: async (query) => {
			setHistorySearch(query ?? "");
			const bundle = await fetchUIHistory(client);
			const entries = bundle?.entry ?? [];
			const items = entries
				.filter((e) => e.resource?.resourceType === "ui_history")
				.map((e) => {
					const r = e.resource as unknown as {
						id: string;
						command: string;
						meta?: { lastUpdated?: string };
					};
					const { method, path } = parseHttpCommand(r.command);
					return {
						id: r.id,
						method,
						path,
						date: r.meta?.lastUpdated ?? "",
					};
				});
			if (!query) return items;
			const q = query.toLowerCase();
			return items.filter(
				(i) =>
					i.method.toLowerCase().includes(q) ||
					i.path.toLowerCase().includes(q),
			);
		},
		listCollections: async () => {
			const entries = await RestCollections.getCollectionsEntries(client);
			const grouped: Record<
				string,
				{ id: string; method: string; path: string; title?: string }[]
			> = {};
			const ungrouped: {
				id: string;
				method: string;
				path: string;
				title?: string;
			}[] = [];
			for (const e of entries) {
				if (!e.id) continue;
				const parsed = parseHttpRequest(e.command);
				const item = {
					id: e.id,
					method: parsed.method,
					path: parsed.path,
					...(e.title ? { title: e.title } : {}),
				};
				if (e.collection) {
					if (!grouped[e.collection]) grouped[e.collection] = [];
					grouped[e.collection]?.push(item);
				} else {
					ungrouped.push(item);
				}
			}
			const result = Object.entries(grouped).map(([name, items]) => ({
				name,
				items,
			}));
			if (ungrouped.length > 0) {
				result.push({ name: "(ungrouped)", items: ungrouped });
			}
			return result;
		},
		saveToCollection: async (collectionName) => {
			const entries = await RestCollections.getCollectionsEntries(client);
			await RestCollections.SaveRequest(
				client,
				selectedTab,
				queryClient,
				entries,
				setSelectedCollectionItemId,
				!collectionName,
				setTabs,
				tabs,
				collectionName,
				!collectionName,
			);
		},
		addCollectionEntry: async (collectionName) => {
			await RestCollections.handleAddNewCollectionEntry(
				client,
				collectionName,
				queryClient,
				setSelectedCollectionItemId,
				setTabs,
				tabs,
			);
		},
		renameCollection: async (name, newName) => {
			const entries = await RestCollections.getCollectionsEntries(client);
			await RestCollections.renameCollectionByName(
				client,
				entries,
				name,
				newName,
				queryClient,
			);
		},
		deleteCollection: async (name) => {
			const entries = await RestCollections.getCollectionsEntries(client);
			await RestCollections.deleteCollectionByName(
				client,
				entries,
				name,
				queryClient,
			);
		},
		renameSnippet: async (id, newTitle) => {
			await RestCollections.renameSnippetById(
				client,
				id,
				newTitle,
				queryClient,
			);
		},
		deleteSnippet: async (id) => {
			await RestCollections.deleteSnippetById(client, id, queryClient);
		},
		listTabs: () =>
			tabs.map((t) => ({
				id: t.id,
				method: t.method,
				path: t.path ?? "",
				selected: !!t.selected,
			})),
		selectTab: (id) => {
			if (!tabs.some((t) => t.id === id)) {
				throw new Error(`Tab ${id} not found`);
			}
			setTabs(tabs.map((t) => ({ ...t, selected: t.id === id })));
		},
		addTab: () => {
			const newTab = addTab(tabs, setTabs);
			return newTab.id;
		},
		closeTab: (id) => {
			const tabId = id ?? tabs.find((t) => t.selected)?.id;
			if (!tabId) throw new Error("No tab to close");
			removeTab(tabs, tabId, setTabs);
			responseStorage.delete(tabId);
		},
		closeOtherTabs: (id) => {
			const keepId = id ?? tabs.find((t) => t.selected)?.id;
			if (!keepId) throw new Error("No tab specified");
			for (const rid of closeOtherTabs(tabs, keepId, setTabs))
				responseStorage.delete(rid);
		},
		closeTabsToLeft: (id) => {
			const anchorId = id ?? tabs.find((t) => t.selected)?.id;
			if (!anchorId) throw new Error("No tab specified");
			for (const rid of closeTabsToLeft(tabs, anchorId, setTabs))
				responseStorage.delete(rid);
		},
		closeTabsToRight: (id) => {
			const anchorId = id ?? tabs.find((t) => t.selected)?.id;
			if (!anchorId) throw new Error("No tab specified");
			for (const rid of closeTabsToRight(tabs, anchorId, setTabs))
				responseStorage.delete(rid);
		},
		getRawRequest: () => formatRequestAsHttpCommand(selectedTab),
		setRawRequest: (raw) => {
			const parsed = parseHttpRequest(raw);
			setRequestLineVersion(generateId());
			setTabs((current) =>
				current.map((tab) => {
					if (!tab.selected) return tab;
					return {
						...tab,
						method: parsed.method as Tab["method"],
						path: parsed.path,
						params: parsePathParams(parsed.path),
						headers: parsed.headers,
						body: parsed.body,
					};
				}),
			);
		},
		getBodyMode: () => "json",
		setBodyMode: () => {},
		formatBody: () => {},
		getRequestBody: () => selectedTab.body ?? "",
		setRequestBody: (body) => {
			setRequestLineVersion(generateId());
			setTabs((current) =>
				current.map((tab) => (tab.selected ? { ...tab, body } : tab)),
			);
		},
		getRequestHeaders: () =>
			(selectedTab.headers ?? [])
				.filter((h) => h.name || h.value)
				.map((h) => ({
					name: h.name,
					value: h.value,
					enabled: h.enabled ?? true,
				})),
		setRequestHeaders: (headers) => {
			setRequestLineVersion(generateId());
			setTabs((current) =>
				current.map((tab) => {
					if (!tab.selected) return tab;
					return {
						...tab,
						headers: [
							...headers.map((h) => ({
								id: generateId(),
								name: h.name,
								value: h.value,
								enabled: h.enabled ?? true,
							})),
							{ id: generateId(), name: "", value: "", enabled: true },
						],
					};
				}),
			);
		},
		toggleRequestHeader: (name, enabled) => {
			setRequestLineVersion(generateId());
			setTabs((current) =>
				current.map((tab) => {
					if (!tab.selected) return tab;
					return {
						...tab,
						headers: (tab.headers ?? []).map((h) =>
							h.name.toLowerCase() === name.toLowerCase()
								? { ...h, enabled: enabled ?? !(h.enabled ?? true) }
								: h,
						),
					};
				}),
			);
		},
		getRequestParams: () =>
			(selectedTab.params ?? [])
				.filter((p) => p.name || p.value)
				.map((p) => ({
					name: p.name,
					value: p.value,
					enabled: p.enabled ?? true,
				})),
		setRequestParams: (params) => {
			setRequestLineVersion(generateId());
			setTabs((current) =>
				current.map((tab) => {
					if (!tab.selected) return tab;
					const newParams = [
						...params.map((p) => ({
							id: generateId(),
							name: p.name,
							value: p.value,
							enabled: p.enabled ?? true,
						})),
						{ id: generateId(), name: "", value: "", enabled: true },
					];
					return {
						...tab,
						params: newParams,
						path: requestParamsEditorSyncPath(newParams, tab.path ?? ""),
					};
				}),
			);
		},
		toggleRequestParam: (name, enabled) => {
			setRequestLineVersion(generateId());
			setTabs((current) =>
				current.map((tab) => {
					if (!tab.selected) return tab;
					const newParams = (tab.params ?? []).map((p) =>
						p.name.toLowerCase() === name.toLowerCase()
							? { ...p, enabled: enabled ?? !(p.enabled ?? true) }
							: p,
					);
					return {
						...tab,
						params: newParams,
						path: requestParamsEditorSyncPath(newParams, tab.path ?? ""),
					};
				}),
			);
		},
		sendRequest: async () => {
			saveToUIHistory(selectedTab, queryClient, client);
			const resp = await executeRequest(selectedTab, client);
			responseStorage.set(selectedTab.id, resp);
			return resp;
		},
		getResponse: () => response,
		getResponseTab: () => selectedTab.activeResponseTab || "body",
		setResponseTab: (tab) =>
			handleResponseTabChange(tab as "body" | "headers" | "raw" | "explain"),
		getPanelLayout: () => {
			if (fullscreenPanel === "request") return "request-maximized";
			if (fullscreenPanel === "response") return "response-maximized";
			return panelsMode === "horizontal" ? "horizontal" : "vertical";
		},
		setPanelLayout: (layout) => {
			if (layout === "request-maximized") setFullscreenPanel("request");
			else if (layout === "response-maximized") setFullscreenPanel("response");
			else if (layout === "horizontal") {
				setFullscreenPanel(null);
				setPanelsMode("horizontal");
			} else if (layout === "vertical") {
				setFullscreenPanel(null);
				setPanelsMode("vertical");
			} else {
				setFullscreenPanel(null);
			}
		},
		setRequestSubTab: (subTab) => {
			setTabs((currentTabs) =>
				currentTabs.map((tab) =>
					tab.selected ? { ...tab, activeSubTab: subTab } : tab,
				),
			);
		},
		selectHistoryItem: (id) => {
			const entry = tabs.find((t) => t.historyId === id);
			if (entry) {
				setTabs(tabs.map((t) => ({ ...t, selected: t.id === entry.id })));
				return;
			}
			// Need to fetch the history item to get its command
			fetchUIHistory(client).then((bundle) => {
				const resource = bundle?.entry?.find((e) => e.resource?.id === id)
					?.resource as { id: string; command: string } | undefined;
				if (!resource) throw new Error(`History item ${id} not found`);
				const { method, path, headers, body } = parseHttpCommand(
					resource.command,
				);
				const queryParams = path.split("?")[1];
				const params =
					queryParams?.split("&").map((param, index) => {
						const [name, value] = param.split("=");
						try {
							return {
								id: `${index}`,
								name: decodeURIComponent(name ?? ""),
								value: decodeURIComponent(value ?? ""),
								enabled: true,
							};
						} catch {
							return {
								id: `${index}`,
								name: name ?? "",
								value: value ?? "",
								enabled: true,
							};
						}
					}) || [];
				if (!params.some((p) => p.name === "" && p.value === "")) {
					params.push({
						id: generateId(),
						name: "",
						value: "",
						enabled: true,
					});
				}
				addTabFromHistory(tabs, setTabs, {
					method,
					path,
					headers: headers.map((h) => ({
						id: generateId(),
						name: h.key,
						value: h.value,
						enabled: true,
					})),
					body,
					params,
					historyId: id,
				});
			});
		},
	};
	useWebMCPRestConsole(webmcpActionsRef);

	useEffect(() => {
		if (!initialLeftMenuOpen.current) {
			leftPanelRef.current?.collapse();
		}
	}, []);

	const [panelsMode, setPanelsMode] = useLocalStorage<
		"horizontal" | "vertical"
	>({
		key: "rest-console-panels-mode",
		getInitialValueInEffect: false,
		defaultValue: "vertical",
	});

	const response = selectedTab.response || null;

	const [requestLineVersion, setRequestLineVersion] = useState<string>(
		generateId(),
	);

	const [fullscreenPanel, setFullscreenPanel] = useState<
		"request" | "response" | null
	>(null);

	const [isLoading, setIsLoading] = useState(false);
	const [sendVersion, setSendVersion] = useState(0);

	const doSendRequest = useCallback(() => {
		setSendVersion((v) => v + 1);
		handleSendRequest(
			selectedTab,
			queryClient,
			setIsLoading,
			responseStorage.set,
			client,
		);
	}, [selectedTab, queryClient, client]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				doSendRequest();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [doSendRequest]);

	function handleTabMethodChange(method: string) {
		setRequestLineVersion(generateId());
		setTabs((currentTabs) =>
			currentTabs.map((tab) =>
				tab.selected
					? {
							...tab,
							method: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
						}
					: tab,
			),
		);
	}

	function handleTabHeaderChange(headerIndex: number, header: Header) {
		setTabs((currentTabs) => {
			return currentTabs.map((tab) => {
				if (!tab.selected) return tab;

				const headers = Array.isArray(tab.headers) ? [...tab.headers] : [];
				headers[headerIndex] = { ...headers[headerIndex], ...header };

				const hasEmptyHeader = headers.some(
					(h) => h.name === "" && h.value === "",
				);

				if (!hasEmptyHeader) {
					headers.push({
						id: generateId(),
						name: "",
						value: "",
						enabled: true,
					});
				}

				return {
					...tab,
					headers,
				};
			}) as Tab[];
		});
	}

	function handleTabParamChange(paramIndex: number, param: Header) {
		setTabs((currentTabs) => {
			return currentTabs.map((tab) => {
				if (!tab.selected) return tab;

				const params = Array.isArray(tab.params) ? [...tab.params] : [];
				params[paramIndex] = { ...params[paramIndex], ...param };

				const hasEmptyParam = requestParamsHasEmpty(params);

				if (!hasEmptyParam) {
					params.push({
						id: generateId(),
						name: "",
						value: "",
						enabled: true,
					});
				}

				return {
					...tab,
					path: requestParamsEditorSyncPath(params, tab.path || ""),
					params,
				};
			}) as Tab[];
		});
	}

	const handleTabBodyChange = useCallback(
		(body: string) => {
			setTabs((currentTabs) => {
				const updatedTabs = currentTabs.map((tab) =>
					tab.selected ? { ...tab, body } : tab,
				);
				return updatedTabs;
			});
		},
		[setTabs],
	);

	function handleSubTabChange(subTab: "params" | "headers" | "body" | "raw") {
		setTabs((currentTabs) => {
			const updatedTabs = currentTabs.map((tab) =>
				tab.selected ? { ...tab, activeSubTab: subTab } : tab,
			);
			return updatedTabs;
		});
	}

	const handleRawChange = useCallback(
		(rawText: string) => {
			try {
				const parsed = parseHttpRequest(rawText);
				setTabs(
					(currentTabs) =>
						currentTabs.map((tab) => {
							if (!tab.selected) return tab;
							return {
								...tab,
								method: parsed.method as Tab["method"],
								path: parsed.path,
								headers: parsed.headers,
								body: parsed.body,
								params: parsePathParams(parsed.path),
							};
						}) as Tab[],
				);
			} catch (error) {
				console.warn("Failed to parse HTTP request:", error);
			}
		},
		[setTabs],
	);

	function handleTabHeaderRemove(headerIndex: number) {
		setTabs((currentTabs) => {
			return currentTabs.map((tab) => {
				if (!tab.selected) return tab;

				const headers = Array.isArray(tab.headers) ? [...tab.headers] : [];
				headers.splice(headerIndex, 1);

				// Check if after removal there is at least one empty header (both name and value are empty)
				const hasEmptyHeader = headers.some(
					(header) =>
						(header.name === undefined || header.name === "") &&
						(header.value === undefined || header.value === ""),
				);

				// If not, add an empty header row
				if (!hasEmptyHeader) {
					headers.push({
						id: generateId(),
						name: "",
						value: "",
						enabled: true,
					});
				}

				return {
					...tab,
					headers,
				};
			}) as Tab[];
		});
	}

	function handleTabParamRemove(paramIndex: number) {
		setTabs((currentTabs) => {
			return currentTabs.map((tab) => {
				if (!tab.selected) return tab;

				const params = Array.isArray(tab.params) ? [...tab.params] : [];
				params.splice(paramIndex, 1);

				// Check if after removal there is at least one empty param (both name and value are empty)
				const hasEmptyParam = requestParamsHasEmpty(params);

				// If not, add an empty param row
				if (!hasEmptyParam) {
					params.push({
						id: generateId(),
						name: "",
						value: "",
						enabled: true,
					});
				}

				return {
					...tab,
					path: requestParamsEditorSyncPath(params, tab.path || ""),
					params,
				};
			}) as Tab[];
		});
	}

	function handleBodyModeChange(_mode: "json" | "yaml") {
		// This handler is currently just a placeholder since the mode state
		// is managed within RequestView component
	}

	function handleHeadersUpdate(headers: Header[]) {
		setTabs((currentTabs) => {
			return currentTabs.map((tab) =>
				tab.selected ? { ...tab, headers } : tab,
			) as Tab[];
		});
	}

	function handleResponseTabChange(responseTab: ResponseTabs) {
		setTabs((currentTabs) => {
			return currentTabs.map((tab) =>
				tab.selected ? { ...tab, activeResponseTab: responseTab } : tab,
			) as Tab[];
		});
	}

	const collectionEntries = useQuery({
		queryKey: ["rest-console-collections"],
		queryFn: () => RestCollections.getCollectionsEntries(client),
		refetchOnWindowFocus: false,
	});

	return (
		<LeftMenuContext value={leftMenuOpen ? "open" : "close"}>
			<div className="w-full h-full">
				<ResizablePanelGroup direction="horizontal" className="w-full h-full">
					<ResizablePanel
						ref={leftPanelRef}
						defaultSize={20}
						minSize={20}
						maxSize={80}
						collapsible
						collapsedSize={0}
						onCollapse={() => setLeftMenuOpen(false)}
						onExpand={() => setLeftMenuOpen(true)}
						className={
							isPanelAnimating ? "transition-[flex-grow] duration-200" : ""
						}
					>
						<LeftMenu
							tabs={tabs}
							setTabs={setTabs}
							selectedTab={selectedTab}
							collectionEntries={collectionEntries}
							setSelectedCollectionItemId={setSelectedCollectionItemId}
							selectedCollectionItemId={selectedCollectionItemId}
							menuTab={menuTab}
							onMenuTabChange={setMenuTab}
							historySearch={historySearch}
							onHistorySearchChange={setHistorySearch}
						/>
					</ResizablePanel>
					{(leftMenuOpen || isPanelAnimating) && <ResizableHandle />}
					<ResizablePanel
						defaultSize={80}
						minSize={40}
						className={
							isPanelAnimating ? "transition-[flex-grow] duration-200" : ""
						}
					>
						<div className="flex flex-col h-full min-w-0">
							<div className="flex h-10 w-full">
								<LeftMenuToggle
									onClose={() => {
										setIsPanelAnimating(true);
										leftPanelRef.current?.collapse();
										setTimeout(() => setIsPanelAnimating(false), 200);
									}}
									onOpen={() => {
										setIsPanelAnimating(true);
										leftPanelRef.current?.expand();
										setTimeout(() => setIsPanelAnimating(false), 200);
									}}
								/>
								<div className="grow min-w-0">
									<ActiveTabs
										setTabs={setTabs}
										tabs={tabs}
										onTabsRemoved={(tabIds) => {
											for (const tabId of tabIds) {
												responseStorage.delete(tabId);
											}
										}}
									/>
								</div>
							</div>
							<div className="px-4 py-3 flex items-center border-b gap-2">
								<UrlAutocomplete
									key={`url-autocomplete-${selectedTab.id}`}
									path={selectedTab.path || ""}
									method={selectedTab.method}
									onSelectSuggestion={(path) => {
										setRequestLineVersion(generateId());
										handleTabRequestPathChange(path, tabs, setTabs);
									}}
									onSubmit={() =>
										handleSendRequest(
											selectedTab,
											queryClient,
											setIsLoading,
											responseStorage.set,
											client,
										)
									}
								>
									<RequestLineEditor
										key={`request-line-editor-${selectedTab.id}`}
										placeholder="Enter URL"
										autoFocus={selectedTab.path === ""}
										className="w-full"
										method={selectedTab.method}
										path={selectedTab.path || ""}
										onMethodChange={(method) => handleTabMethodChange(method)}
										onPathChange={(event) => {
											setRequestLineVersion(generateId());
											handleTabRequestPathChange(
												event.target.value,
												tabs,
												setTabs,
											);
										}}
									/>
								</UrlAutocomplete>
								<SendButton
									onClick={() =>
										handleSendRequest(
											selectedTab,
											queryClient,
											setIsLoading,
											responseStorage.set,
											client,
										)
									}
								/>
								<RestCollections.SaveButton
									tab={selectedTab}
									collectionEntries={collectionEntries}
									setSelectedCollectionItemId={setSelectedCollectionItemId}
									tabs={tabs}
									setTabs={setTabs}
									setLeftMenuOpen={setLeftMenuOpen}
								/>
							</div>
							<ResizablePanelGroup
								autoSaveId="rest-console-request-response"
								direction={panelsMode}
								className="grow"
							>
								<ResizablePanel
									defaultSize={50}
									minSize={panelsMode === "horizontal" ? 20 : undefined}
									className={`min-h-10 ${fullscreenPanel === "request" ? "absolute top-0 bottom-0 h-full w-full left-0 z-100 overflow-auto" : fullscreenPanel === "response" ? "hidden" : ""}`}
								>
									<RequestView
										requestLineVersion={requestLineVersion}
										selectedTab={selectedTab}
										onBodyChange={handleTabBodyChange}
										onHeaderChange={handleTabHeaderChange}
										onParamChange={handleTabParamChange}
										onSubTabChange={handleSubTabChange}
										onRawChange={handleRawChange}
										onHeaderRemove={handleTabHeaderRemove}
										onParamRemove={handleTabParamRemove}
										onFullScreenToggle={(state) =>
											setFullscreenPanel(
												state === "maximized" ? "request" : null,
											)
										}
										fullScreenState={
											fullscreenPanel === "request" ? "maximized" : "normal"
										}
										onBodyModeChange={handleBodyModeChange}
										onHeadersUpdate={handleHeadersUpdate}
										webmcpActionsRef={webmcpActionsRef}
										getStructureDefinitions={getStructureDefinitions}
										expandValueSet={expandValueSet}
										getUrlSuggestions={getUrlSuggestions}
									/>
								</ResizablePanel>
								<ResizableHandle />
								<ResizablePanel
									defaultSize={50}
									minSize={panelsMode === "horizontal" ? 20 : undefined}
									className={`min-h-10 ${fullscreenPanel === "response" ? "absolute top-0 bottom-0 h-full w-full left-0 z-100 overflow-auto" : fullscreenPanel === "request" ? "hidden" : ""}`}
								>
									<ResponsePane
										key={`response-${selectedTab.id}`}
										response={response}
										splitState={panelsMode}
										onSplitChange={setPanelsMode}
										fullScreenState={
											fullscreenPanel === "response" ? "maximized" : "normal"
										}
										onFullScreenToggle={(state) =>
											state === "maximized"
												? setFullscreenPanel("response")
												: setFullscreenPanel(null)
										}
										isLoading={isLoading}
										activeResponseTab={
											selectedTab.activeResponseTab === "explain" &&
											!isGetSearchRequest(selectedTab)
												? "body"
												: selectedTab.activeResponseTab || "body"
										}
										onResponseTabChange={handleResponseTabChange}
										selectedTab={selectedTab}
										aidboxClient={client}
										sendVersion={sendVersion}
									/>
								</ResizablePanel>
							</ResizablePanelGroup>
						</div>
					</ResizablePanel>
				</ResizablePanelGroup>
			</div>
		</LeftMenuContext>
	);
}
