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
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { createFileRoute } from "@tanstack/react-router";
import {
	Columns2,
	Fullscreen,
	Minimize2,
	Rows2,
	Save,
	Timer,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AidboxCallWithMeta } from "../api/auth";
import {
	ActiveTabs,
	DEFAULT_TAB,
	type Header,
	type Tab,
} from "../components/rest/active-tabs";
import HeadersEditor from "../components/rest/headers-editor";
import {
	LeftMenu,
	LeftMenuContext,
	LeftMenuToggle,
} from "../components/rest/left-menu";
import ParamsEditor from "../components/rest/params-editor";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { HTTP_STATUS_CODES, REST_CONSOLE_TABS_KEY } from "../shared/const";
import { parseHttpRequest } from "../utils";

type ResponseData = {
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body: string;
	duration: number;
};

export const Route = createFileRoute("/rest")({
	staticData: {
		title: "REST Console",
	},
	component: RouteComponent,
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
			className="w-full"
			selectedMethod={selectedTab.method}
			setMethod={(method) => handleTabMethodChange(method)}
			methods={["GET", "POST", "PUT", "PATCH", "DELETE"]}
			inputValue={selectedTab.path || ""}
			onInputChange={(event) => handleTabPathChange(event.target.value)}
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
	handleFullscreenPanelChange,
	fullscreenPanel,
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
	handleFullscreenPanelChange: (panel: "request" | "response") => void;
	fullscreenPanel: "request" | "response" | null;
}) {
	const currentActiveSubTab = selectedTab.activeSubTab || "body";

	const getEditorValue = () => {
		return selectedTab.body || JSON.stringify({ resourceType: "" }, null, 2);
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
						<span className="typo-label text-text-secondary mb-0.5 pr-3">
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
						onClick={() => handleFullscreenPanelChange("request")}
						fullscreenPanel={fullscreenPanel}
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
				<TabsContent value="body">
					<CodeEditor
						id={`request-editor-${selectedTab.id}-${currentActiveSubTab}`}
						defaultValue={getEditorValue()}
						onChange={onBodyChange}
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

type PanelSplitDirection = "horizontal" | "vertical";

type SplitDirectionToggleProps = {
	direction: PanelSplitDirection;
	onChange: (direction: PanelSplitDirection) => void;
};

function HorizontalSplit({ onChange }: { onChange: () => void }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button variant="link" onClick={onChange} size="small">
					<Rows2 />
				</Button>
			</TooltipTrigger>
			<TooltipContent>Switch to vertical split</TooltipContent>
		</Tooltip>
	);
}

function VerticalSplit({ onChange }: { onChange: () => void }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button variant="link" onClick={onChange} size="small">
					<Columns2 />
				</Button>
			</TooltipTrigger>
			<TooltipContent>Switch to horizontal split</TooltipContent>
		</Tooltip>
	);
}

function ExpandPane({
	onClick,
	fullscreenPanel,
}: {
	onClick: () => void;
	fullscreenPanel: "request" | "response" | null;
}) {
	if (fullscreenPanel === null) {
		return (
			<Button variant="link" size="small" onClick={onClick}>
				<Fullscreen />
			</Button>
		);
	} else {
		return (
			<Button variant="primary" size="small" onClick={onClick}>
				<Minimize2 />
			</Button>
		);
	}
}

function SplitDirectionToggle({
	direction,
	onChange,
}: SplitDirectionToggleProps) {
	if (direction === "horizontal") {
		return <HorizontalSplit onChange={() => onChange("vertical")} />;
	} else if (direction === "vertical") {
		return <VerticalSplit onChange={() => onChange("horizontal")} />;
	}
}

type ResponsePaneProps = {
	panelsMode: PanelSplitDirection;
	setPanelsMode: (mode: PanelSplitDirection) => void;
	response: ResponseData | null;
	activeResponseTab: ResponseTabs;
	setActiveResponseTab: (tab: ResponseTabs) => void;
	handleFullscreenPanelChange: (panel: "request" | "response") => void;
	fullscreenPanel: "request" | "response" | null;
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
}: {
	response: ResponseData | null;
	activeResponseTab: ResponseTabs;
}) {
	const getEditorContent = () => {
		if (!response) return "";

		switch (activeResponseTab) {
			case "headers":
				return JSON.stringify(response.headers, null, 2);
			case "raw":
				return `HTTP/1.1 ${response.status} ${response.statusText}\n${Object.entries(
					response.headers,
				)
					.map(([key, value]) => `${key}: ${value}`)
					.join("\n")}\n\n${response.body}`;
			case "body":
			default:
				try {
					const parsed = JSON.parse(response.body);
					return JSON.stringify(parsed, null, 2);
				} catch {
					return response.body;
				}
		}
	};

	if (response) {
		return (
			<CodeEditor
				key={`response-${activeResponseTab}-${response.status}`}
				currentValue={getEditorContent()}
				mode={activeResponseTab === "raw" ? "http" : "json"}
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
	panelsMode,
	setPanelsMode,
	response,
	activeResponseTab,
	setActiveResponseTab,
	handleFullscreenPanelChange,
	fullscreenPanel,
}: ResponsePaneProps) {
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
						<span className="typo-label text-text-secondary mb-0.5 pr-3">
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
						{fullscreenPanel === null && (
							<SplitDirectionToggle
								direction={panelsMode}
								onChange={(newMode) => setPanelsMode(newMode)}
							/>
						)}
						<ExpandPane
							onClick={() => handleFullscreenPanelChange("response")}
							fullscreenPanel={fullscreenPanel}
						/>
					</div>
				</div>
				<ResponseView
					response={response}
					activeResponseTab={activeResponseTab}
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
	onHistorySaved?: () => void,
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

	// Save to UI history (don't wait for it)
	saveToUIHistory(selectedTab, onHistorySaved);

	AidboxCallWithMeta({
		method: selectedTab.method,
		url: selectedTab.path || "/",
		headers,
		body: selectedTab.body || "",
	})
		.then((response) => {
			setResponse(response);
		})
		.catch((error) => {
			console.error("error", error);

			const errorResponse: ResponseData = {
				status: 0,
				statusText: "Network Error",
				headers: {},
				body: JSON.stringify({ error: error.message }, null, 2),
				duration: 0,
			};

			setResponse(errorResponse);
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
async function saveToUIHistory(tab: Tab, onSaved?: () => void): Promise<void> {
	try {
		const historyId = crypto.randomUUID();
		const command = formatRequestAsHttpCommand(tab);

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

		// Call the callback to refresh history
		onSaved?.();
	} catch (error) {
		// Silently fail - history saving shouldn't block the main request
		console.warn("Failed to save to UI history:", error);
	}
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

	// State to store history refresh function
	const [refreshHistory, setRefreshHistory] = React.useState<
		(() => void) | null
	>(null);

	const [panelsMode, setPanelsMode] = useLocalStorage<
		"horizontal" | "vertical"
	>({
		key: "rest-console-panels-mode",
		getInitialValueInEffect: false,
		defaultValue: "vertical",
	});

	const [response, setResponse] = useState<ResponseData | null>(null);
	const [activeResponseTab, setActiveResponseTab] = useState<
		"body" | "headers" | "raw"
	>("body");

	const [requestLineVersion, setRequestLineVersion] = useState<string>(
		crypto.randomUUID(),
	);

	const [fullscreenPanel, setFullscreenPanel] = useState<
		"request" | "response" | null
	>(null);

	const selectedTab = useMemo(() => {
		return tabs.find((tab) => tab.selected) || DEFAULT_TAB;
	}, [tabs]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.ctrlKey && event.key === "Enter") {
				event.preventDefault();
				handleSendRequest(
					selectedTab,
					setResponse,
					refreshHistory || undefined,
				);
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [selectedTab, refreshHistory]);

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

	const handleFullscreenPanelChange = (panel: "request" | "response") => {
		if (fullscreenPanel === panel) {
			setFullscreenPanel(null);
		} else {
			setFullscreenPanel(panel);
		}
	};

	return (
		<LeftMenuContext value={leftMenuOpen ? "open" : "close"}>
			<div className="flex w-full h-full">
				<LeftMenu
					tabs={tabs}
					setTabs={setTabs}
					onHistoryRefreshNeeded={setRefreshHistory}
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
					<div className="px-4 py-3 flex items-center border-b">
						<RequestLineEditorWrapper
							selectedTab={selectedTab}
							handleTabPathChange={(path) => {
								setRequestLineVersion(crypto.randomUUID());
								handleTabRequestPathChange(path, tabs, setTabs);
							}}
							handleTabMethodChange={handleTabMethodChange}
						/>
						<Tooltip delayDuration={600}>
							<TooltipTrigger asChild>
								<Button
									variant="primary"
									className="ml-2"
									onClick={() =>
										handleSendRequest(
											selectedTab,
											setResponse,
											refreshHistory || undefined,
										)
									}
								>
									<PlayIcon />
									Send
								</Button>
							</TooltipTrigger>
							<TooltipContent>Send request (Ctrl+Enter)</TooltipContent>
						</Tooltip>
						<Button variant="secondary" className="ml-2">
							<Save />
							Save
						</Button>
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
								handleFullscreenPanelChange={handleFullscreenPanelChange}
								fullscreenPanel={fullscreenPanel}
							/>
						</ResizablePanel>
						<ResizableHandle />
						<ResizablePanel
							defaultSize={50}
							className={`min-h-10 ${fullscreenPanel === "response" ? "absolute top-0 bottom-0 h-full w-full left-0 z-100 overflow-auto" : fullscreenPanel === "request" ? "hidden" : ""}`}
						>
							<ResponsePane
								key={`response-${selectedTab.id}`}
								panelsMode={panelsMode}
								setPanelsMode={setPanelsMode}
								response={response}
								activeResponseTab={activeResponseTab}
								setActiveResponseTab={setActiveResponseTab}
								handleFullscreenPanelChange={handleFullscreenPanelChange}
								fullscreenPanel={fullscreenPanel}
							/>
						</ResizablePanel>
					</ResizablePanelGroup>
				</div>
			</div>
		</LeftMenuContext>
	);
}
