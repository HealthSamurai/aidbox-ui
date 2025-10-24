import {
	Button,
	CodeEditor,
	PlayIcon,
	RequestLineEditor,
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	toast,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import {
	type QueryClient,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Fullscreen, Minimize2, Timer } from "lucide-react";
import * as yaml from "js-yaml";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AidboxCallWithMeta } from "../api/auth";
import {
	ActiveTabs,
	DEFAULT_TAB,
	type Header,
	type Tab,
} from "../components/rest/active-tabs";
import * as RestCollections from "../components/rest/collections";
import HeadersEditor from "../components/rest/headers-editor";
import {
	LeftMenu,
	LeftMenuContext,
	LeftMenuToggle,
} from "../components/rest/left-menu";
import ParamsEditor from "../components/rest/params-editor";
import { SplitButton, type SplitDirection } from "../components/Split";
import { CodeEditorMenubar } from "../components/ViewDefinition/code-editor-menubar";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { HTTP_STATUS_CODES, REST_CONSOLE_TABS_KEY } from "../shared/const";
import { parseHttpRequest } from "../utils";

type ResponseData = {
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body: string;
	duration: number;
	mode?: "json" | "yaml";
};

const TITLE = "REST Console";

export const Route = createFileRoute("/rest")({
	staticData: {
		title: TITLE,
	},
	component: RouteComponent,
	loader: () => ({ breadCrumb: TITLE }),
});

function RequestLineEditorWrapper({
	selectedTab,
	handleTabPathChange,
	handleTabMethodChange,
}: {
	selectedTab: Tab;
	handleTabPathChange: (path: string) => void;
	handleTabMethodChange: (method: string) => void;
}) {
	return (
		<RequestLineEditor
			key={`request-line-editor-${selectedTab.id}`}
			placeholder="/fhir/Patient"
			autoFocus={selectedTab.path === ""}
			className="w-full"
			method={selectedTab.method}
			path={selectedTab.path || ""}
			onMethodChange={(method) => handleTabMethodChange(method)}
			onPathChange={(event) => handleTabPathChange(event.target.value)}
		/>
	);
}

function RawEditor({
	selectedTab,
	requestLineVersion,
	onRawChange,
}: {
	selectedTab: Tab;
	requestLineVersion: string;
	onRawChange?: (rawText: string) => void;
}) {
	const defaultRequestLine = `${selectedTab.method} ${selectedTab.path || "/"}`;
	const defaultHeaders =
		selectedTab.headers
			?.filter(
				(header) => header.name && header.value && (header.enabled ?? true),
			)
			.map((header) => `${header.name}: ${header.value}`)
			.join("\n") || "";

	const currentValue = `${defaultRequestLine}\n${defaultHeaders}\n\n${selectedTab.body || ""}`;

	return (
		<CodeEditor
			key={`raw-editor-${selectedTab.id}-${requestLineVersion}`}
			defaultValue={currentValue}
			mode="http"
			{...(onRawChange ? { onChange: onRawChange } : {})}
		/>
	);
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
}) {
	const currentActiveSubTab = selectedTab.activeSubTab || "body";

	const [bodyMode, setBodyMode] = useLocalStorage<"json" | "yaml">({
		key: `rest-console-body-mode-${selectedTab.id}`,
		getInitialValueInEffect: false,
		defaultValue: "json",
	});

	const [bodyEditorValue, setBodyEditorValue] = useState(
		selectedTab.body || "",
	);

	const isUpdatingHeadersRef = useState({ current: false })[0];

	useEffect(() => {
		setBodyEditorValue(selectedTab.body || "");
	}, [selectedTab.body]);

	// Sync body mode when Content-Type or Accept header changes (from external sources like Raw/Headers tab)
	useEffect(() => {
		// Skip if we're the ones updating the headers
		if (isUpdatingHeadersRef.current) {
			return;
		}

		const headers = Array.isArray(selectedTab.headers)
			? selectedTab.headers
			: [];
		const contentTypeHeader = headers.find(
			(h) => h.name?.toLowerCase() === "content-type" && (h.enabled ?? true),
		);
		const acceptHeader = headers.find(
			(h) => h.name?.toLowerCase() === "accept" && (h.enabled ?? true),
		);

		// Check Content-Type header first, then Accept header as fallback
		const headerToCheck = contentTypeHeader || acceptHeader;

		if (headerToCheck?.value) {
			const value = headerToCheck.value.toLowerCase().trim();
			if (value === "text/yaml" || value === "application/x-yaml") {
				if (bodyMode !== "yaml") {
					setBodyMode("yaml");
				}
			} else if (value === "application/json") {
				if (bodyMode !== "json") {
					setBodyMode("json");
				}
			}
			// If it's any other value, don't change the mode
		}
	}, [selectedTab.headers]);

	// Update Content-Type and Accept headers based on body mode
	useEffect(() => {
		const contentType = bodyMode === "yaml" ? "text/yaml" : "application/json";

		const headers = Array.isArray(selectedTab.headers)
			? [...selectedTab.headers]
			: [];
		const contentTypeIndex = headers.findIndex(
			(h) => h.name?.toLowerCase() === "content-type",
		);
		const acceptIndex = headers.findIndex(
			(h) => h.name?.toLowerCase() === "accept",
		);

		// Check if we need to update
		const needsContentTypeUpdate =
			contentTypeIndex < 0 || headers[contentTypeIndex]?.value !== contentType;
		const needsAcceptUpdate =
			acceptIndex < 0 || headers[acceptIndex]?.value !== contentType;

		if (needsContentTypeUpdate || needsAcceptUpdate) {
			isUpdatingHeadersRef.current = true;

			// Update or add Content-Type header
			if (needsContentTypeUpdate) {
				if (contentTypeIndex >= 0 && headers[contentTypeIndex]) {
					// Update existing Content-Type header
					const existingHeader = headers[contentTypeIndex];
					headers[contentTypeIndex] = {
						id: existingHeader.id,
						name: existingHeader.name,
						value: contentType,
						...(existingHeader.enabled !== undefined && {
							enabled: existingHeader.enabled,
						}),
					};
				} else {
					// Add Content-Type header if it doesn't exist (before the empty row)
					const emptyRowIndex = headers.findIndex(
						(h) => h.name === "" && h.value === "",
					);

					if (emptyRowIndex >= 0) {
						headers.splice(emptyRowIndex, 0, {
							id: crypto.randomUUID(),
							name: "Content-Type",
							value: contentType,
							enabled: true,
						});
					} else {
						headers.push({
							id: crypto.randomUUID(),
							name: "Content-Type",
							value: contentType,
							enabled: true,
						});
					}
				}
			}

			// Update or add Accept header
			if (needsAcceptUpdate) {
				// Re-find acceptIndex since we may have modified the array
				const currentAcceptIndex = headers.findIndex(
					(h) => h.name?.toLowerCase() === "accept",
				);

				if (currentAcceptIndex >= 0 && headers[currentAcceptIndex]) {
					// Update existing Accept header
					const existingHeader = headers[currentAcceptIndex];
					headers[currentAcceptIndex] = {
						id: existingHeader.id,
						name: existingHeader.name,
						value: contentType,
						...(existingHeader.enabled !== undefined && {
							enabled: existingHeader.enabled,
						}),
					};
				} else {
					// Add Accept header if it doesn't exist (before the empty row)
					const emptyRowIndex = headers.findIndex(
						(h) => h.name === "" && h.value === "",
					);

					if (emptyRowIndex >= 0) {
						headers.splice(emptyRowIndex, 0, {
							id: crypto.randomUUID(),
							name: "Accept",
							value: contentType,
							enabled: true,
						});
					} else {
						headers.push({
							id: crypto.randomUUID(),
							name: "Accept",
							value: contentType,
							enabled: true,
						});
					}
				}
			}

			onHeadersUpdate(headers);

			// Reset the flag after a short delay
			setTimeout(() => {
				isUpdatingHeadersRef.current = false;
			}, 0);
		}
	}, [bodyMode]);

	const getEditorValue = () => {
		return bodyEditorValue;
	};

	const handleBodyModeChange = (newMode: "json" | "yaml") => {
		try {
			const currentBody = bodyEditorValue.trim();
			if (!currentBody) {
				setBodyMode(newMode);
				onBodyModeChange(newMode);
				return;
			}

			let convertedBody: string;
			if (newMode === "yaml") {
				const parsed = JSON.parse(currentBody);
				convertedBody = yaml.dump(parsed, { indent: 2 });
			} else {
				const parsed = yaml.load(currentBody) as object;
				convertedBody = JSON.stringify(parsed, null, 2);
			}

			setBodyEditorValue(convertedBody);
			onBodyChange(convertedBody);
			setBodyMode(newMode);
			onBodyModeChange(newMode);
		} catch (error) {
			toast.error(`Failed to convert to ${newMode.toUpperCase()}`, {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
		}
	};

	const handleFormatBody = () => {
		try {
			const currentBody = bodyEditorValue.trim();
			if (!currentBody) return;

			let formattedBody: string;
			if (bodyMode === "yaml") {
				const parsed = yaml.load(currentBody);
				formattedBody = yaml.dump(parsed, { indent: 2 });
			} else {
				const parsed = JSON.parse(currentBody);
				formattedBody = JSON.stringify(parsed, null, 2);
			}

			setBodyEditorValue(formattedBody);
			onBodyChange(formattedBody);
			toast.success("Code formatted", {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
		} catch (error) {
			toast.error("Failed to format code", {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
		}
	};

	const handleBodyEditorChange = (value: string) => {
		setBodyEditorValue(value);
		onBodyChange(value);
	};

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
					/>
				</TabsContent>
				<TabsContent value="raw">
					<RawEditor
						requestLineVersion={requestLineVersion}
						selectedTab={selectedTab}
						onRawChange={onRawChange}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}

type ResponseTabs = "body" | "headers" | "raw";

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
		<span className="flex font-medium items-center text-text-secondary text-sm">
			<span>Status:</span>
			<span className={`ml-1 ${messageColor}`}>
				{status} {statusText || HTTP_STATUS_CODES[status]}
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
					<span className="font-bold">{response.duration}</span>
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
}: {
	response: ResponseData | null;
	activeResponseTab: ResponseTabs;
	isLoading: boolean;
	responseMode: "json" | "yaml";
}) {
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

function ResponsePane({
	splitState,
	onSplitChange,
	response,
	onFullScreenToggle,
	fullScreenState,
	isLoading,
}: ResponsePaneProps) {
	const [activeResponseTab, setActiveResponseTab] = useState<
		"body" | "headers" | "raw"
	>("body");

	// Use response mode from the response itself (set at request time)
	const responseMode = response?.mode || "json";

	return (
		<Tabs
			value={activeResponseTab}
			className="h-full"
			onValueChange={(value) =>
				setActiveResponseTab(value as "body" | "headers" | "raw")
			}
		>
			<div className="flex flex-col h-full">
				<div className="flex items-center justify-between bg-bg-secondary px-4 h-10 border-b">
					<div className="flex items-center">
						<span className="typo-label text-text-secondary pr-3">
							Response:
						</span>
						<TabsList>
							<TabsTrigger value="body">Body</TabsTrigger>
							<TabsTrigger value="headers">Headers</TabsTrigger>
							<TabsTrigger value="raw">Raw</TabsTrigger>
						</TabsList>
					</div>
					<div className="flex items-center gap-1">
						{response && <ResponseInfo response={response} />}
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
				<ResponseView
					response={response}
					activeResponseTab={activeResponseTab}
					isLoading={isLoading}
					responseMode={responseMode}
				/>
			</div>
		</Tabs>
	);
}

function requestParamsHasEmpty(params: Header[]): boolean {
	return params.some((param) => param.name === "" && param.value === "");
}

function handleTabRequestPathChange(
	path: string,
	tabs: Tab[],
	setTabs: (tabs: Tab[]) => void,
) {
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

	if (!requestParamsHasEmpty(params)) {
		params.push({
			id: crypto.randomUUID(),
			name: "",
			value: "",
			enabled: true,
		});
	}

	setTabs(
		tabs.map((tab) => (tab.selected ? { ...tab, path, params } : tab)) as Tab[],
	);
}

function handleSendRequest(
	selectedTab: Tab,
	setResponse: (response: ResponseData | null) => void,
	queryClient: QueryClient,
	setIsLoading: (loading: boolean) => void,
) {
	const headers =
		selectedTab.headers
			?.filter(
				(header) => header.name && header.value && (header.enabled ?? true),
			)
			.reduce(
				(acc, header) => {
					acc[header.name] = header.value;
					return acc;
				},
				{} as Record<string, string>,
			) ?? {};

	// Determine response mode based on Accept header at request time
	const acceptHeader = selectedTab.headers?.find(
		(h) => h.name?.toLowerCase() === "accept" && (h.enabled ?? true),
	);
	const responseMode: "json" | "yaml" =
		acceptHeader?.value?.toLowerCase().trim() === "text/yaml" ||
		acceptHeader?.value?.toLowerCase().trim() === "application/x-yaml"
			? "yaml"
			: "json";

	// Save to UI history (don't wait for it)
	saveToUIHistory(selectedTab, queryClient);

	setIsLoading(true);

	AidboxCallWithMeta({
		method: selectedTab.method,
		url: selectedTab.path || "/",
		headers,
		body: selectedTab.body || "",
	})
		.then((response) => {
			setResponse({ ...response, mode: responseMode });
		})
		.catch((error) => {
			console.error("error", error);

			const errorResponse: ResponseData = {
				status: 0,
				statusText: "Network Error",
				headers: {},
				body: JSON.stringify({ error: error.message }, null, 2),
				duration: 0,
				mode: responseMode,
			};

			setResponse(errorResponse);
		})
		.finally(() => {
			setIsLoading(false);
		});
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
): Promise<void> {
	try {
		const historyId = crypto.randomUUID();
		const command = formatRequestAsHttpCommand(tab);

		queryClient.invalidateQueries({ queryKey: ["uiHistory"] });

		const historyPayload = {
			type: "http",
			command: command,
		};

		await AidboxCallWithMeta({
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
			<TooltipContent>Send request (Ctrl+Enter)</TooltipContent>
		</Tooltip>
	);
}

function RouteComponent() {
	const [tabs, setTabs] = useLocalStorage<Tab[]>({
		key: REST_CONSOLE_TABS_KEY,
		getInitialValueInEffect: false,
		defaultValue: [DEFAULT_TAB],
	});

	const [leftMenuOpen, setLeftMenuOpen] = useLocalStorage<boolean>({
		key: "rest-console-left-menu-open",
		getInitialValueInEffect: false,
		defaultValue: true,
	});

	const [panelsMode, setPanelsMode] = useLocalStorage<
		"horizontal" | "vertical"
	>({
		key: "rest-console-panels-mode",
		getInitialValueInEffect: false,
		defaultValue: "vertical",
	});

	const [response, setResponse] = useState<ResponseData | null>(null);

	const [requestLineVersion, setRequestLineVersion] = useState<string>(
		crypto.randomUUID(),
	);

	const [fullscreenPanel, setFullscreenPanel] = useState<
		"request" | "response" | null
	>(null);

	const [isLoading, setIsLoading] = useState(false);

	const selectedTab = useMemo(() => {
		return tabs.find((tab) => tab.selected) || DEFAULT_TAB;
	}, [tabs]);

	const queryClient = useQueryClient();
	const [selectedCollectionItemId, setSelectedCollectionItemId] = useState<
		string | undefined
	>(selectedTab.id);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.ctrlKey && event.key === "Enter") {
				event.preventDefault();
				handleSendRequest(selectedTab, setResponse, queryClient, setIsLoading);
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [selectedTab, queryClient]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Need to clear response only on tab change
	useEffect(() => {
		setResponse(null);
	}, [selectedTab.id]);

	function handleTabMethodChange(method: string) {
		setRequestLineVersion(crypto.randomUUID());
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
						id: crypto.randomUUID(),
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
						id: crypto.randomUUID(),
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

				setTabs((currentTabs) => {
					return currentTabs.map((tab) => {
						if (!tab.selected) return tab;

						const queryParams = parsed.path.split("?")[1];
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

						if (!requestParamsHasEmpty(params)) {
							params.push({
								id: crypto.randomUUID(),
								name: "",
								value: "",
								enabled: true,
							});
						}

						return {
							...tab,
							method: parsed.method as
								| "GET"
								| "POST"
								| "PUT"
								| "PATCH"
								| "DELETE",
							path: parsed.path,
							headers: parsed.headers,
							body: parsed.body,
							params: params,
						};
					}) as Tab[];
				});
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
						id: crypto.randomUUID(),
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
						id: crypto.randomUUID(),
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

	function handleBodyModeChange(mode: "json" | "yaml") {
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

	const collectionEntries = useQuery({
		queryKey: ["rest-console-collections"],
		queryFn: RestCollections.getCollectionsEntries,
		refetchOnWindowFocus: false,
	});

	return (
		<LeftMenuContext value={leftMenuOpen ? "open" : "close"}>
			<div className="flex w-full h-full">
				<LeftMenu
					tabs={tabs}
					setTabs={setTabs}
					selectedTab={selectedTab}
					collectionEntries={collectionEntries}
					setSelectedCollectionItemId={setSelectedCollectionItemId}
					selectedCollectionItemId={selectedCollectionItemId}
				/>
				<div className="flex flex-col grow min-w-0">
					<div className="flex h-10 w-full">
						<LeftMenuToggle
							onClose={() => {
								setLeftMenuOpen(false);
							}}
							onOpen={() => {
								setLeftMenuOpen(true);
							}}
						/>
						<div className="grow min-w-0">
							<ActiveTabs setTabs={setTabs} tabs={tabs} />
						</div>
					</div>
					<div className="px-4 py-3 flex items-center border-b gap-2">
						<RequestLineEditorWrapper
							selectedTab={selectedTab}
							handleTabPathChange={(path) => {
								setRequestLineVersion(crypto.randomUUID());
								handleTabRequestPathChange(path, tabs, setTabs);
							}}
							handleTabMethodChange={handleTabMethodChange}
						/>
						<SendButton
							onClick={() =>
								handleSendRequest(
									selectedTab,
									setResponse,
									queryClient,
									setIsLoading,
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
									setFullscreenPanel(state === "maximized" ? "request" : null)
								}
								fullScreenState={
									fullscreenPanel === "request" ? "maximized" : "normal"
								}
								onBodyModeChange={handleBodyModeChange}
								onHeadersUpdate={handleHeadersUpdate}
							/>
						</ResizablePanel>
						<ResizableHandle />
						<ResizablePanel
							defaultSize={50}
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
							/>
						</ResizablePanel>
					</ResizablePanelGroup>
				</div>
			</div>
		</LeftMenuContext>
	);
}
