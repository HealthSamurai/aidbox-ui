import {
	Button,
	CodeEditor,
	type CodeEditorView,
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
	PanelLeftClose,
	PanelLeftOpen,
	Rows2,
	Save,
	Timer,
} from "lucide-react";
import {
	createContext,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
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

type SidebarStatus = "open" | "close";

type SidebarToggleButtonProps = {
	value?: SidebarStatus;
	onOpen: () => void;
	onClose: () => void;
};

function SidebarToggleButton({
	value,
	onOpen,
	onClose,
}: SidebarToggleButtonProps) {
	return (
		<Tooltip delayDuration={600}>
			<TooltipTrigger asChild>
				<Button
					variant="link"
					className="h-full border-b flex-shrink-0 border-r"
					onClick={value === "open" ? onOpen : onClose}
				>
					{value === "open" ? (
						<PanelLeftClose className="size-4" />
					) : (
						<PanelLeftOpen className="size-4" />
					)}
				</Button>
			</TooltipTrigger>
			<TooltipContent>History / Collections</TooltipContent>
		</Tooltip>
	);
}

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
	onRawChange,
}: {
	selectedTab: Tab;
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
			key={`raw-editor-${selectedTab.id}`}
			currentValue={currentValue}
			mode="http"
			{...(onRawChange ? { onChange: onRawChange } : {})}
		/>
	);
}

function RequestView({
	selectedTab,
	onBodyChange,
	onSubTabChange,
	onHeaderChange,
	onParamChange,
	onRawChange,
	onHeaderRemove,
	onParamRemove,
}: {
	selectedTab: Tab;
	onBodyChange: (body: string) => void;
	onSubTabChange: (subTab: "params" | "headers" | "body" | "raw") => void;
	onHeaderChange: (headerIndex: number, header: Header) => void;
	onParamChange: (paramIndex: number, param: Header) => void;
	onRawChange: (rawText: string) => void;
	onHeaderRemove: (headerIndex: number) => void;
	onParamRemove: (paramIndex: number) => void;
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
				<div className="flex items-center justify-between bg-bg-secondary px-4 border-y h-10">
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
					<ExpandPane />
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
					<RawEditor selectedTab={selectedTab} onRawChange={onRawChange} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
function ResponseEditorTabs({
	activeTab,
	onTabChange,
}: {
	activeTab: "body" | "headers" | "raw";
	onTabChange: (tab: "body" | "headers" | "raw") => void;
}) {
	return (
		<Tabs
			value={activeTab}
			onValueChange={(value) =>
				onTabChange(value as "body" | "headers" | "raw")
			}
		>
			<TabsList>
				<TabsTrigger value="body">Body</TabsTrigger>
				<TabsTrigger value="headers">Headers</TabsTrigger>
				<TabsTrigger value="raw">Raw</TabsTrigger>
			</TabsList>
		</Tabs>
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
					<Columns2 />
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
					<Rows2 />
				</Button>
			</TooltipTrigger>
			<TooltipContent>Switch to horizontal split</TooltipContent>
		</Tooltip>
	);
}

function ExpandPane() {
	return (
		<Button variant="link" size="small">
			<Fullscreen />
		</Button>
	);
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
				<div
					className={`flex items-center justify-between bg-bg-secondary px-4 h-10 ${panelsMode === "horizontal" ? "border-y" : "border-b"}`}
				>
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
						<SplitDirectionToggle
							direction={panelsMode}
							onChange={(newMode) => setPanelsMode(newMode)}
						/>
						<ExpandPane />
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

	AidboxCallWithMeta({
		method: selectedTab.method,
		url: selectedTab.path || "/",
		headers,
		body: selectedTab.body || "",
	})
		.then((response) => {
			console.log(response);
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
	const [activeResponseTab, setActiveResponseTab] = useState<
		"body" | "headers" | "raw"
	>("body");

	const selectedTab = useMemo(() => {
		return tabs.find((tab) => tab.selected) || DEFAULT_TAB;
	}, [tabs]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.ctrlKey && event.key === "Enter") {
				event.preventDefault();
				handleSendRequest(selectedTab, setResponse);
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [selectedTab]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Need to clear response only on tab change
	useEffect(() => {
		setResponse(null);
	}, [selectedTab.id]);

	function handleTabMethodChange(method: string) {
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

	return (
		<LeftMenuContext value={leftMenuOpen ? "open" : "close"}>
			<div className="flex w-full h-full">
				<LeftMenu />
				<div className="flex flex-col grow min-w-0">
					<div className="flex h-10 w-full">
						<LeftMenuToggle
							onClose={() => {
								console.log("close");
								setLeftMenuOpen(false);
							}}
							onOpen={() => {
								console.log("open");
								setLeftMenuOpen(true);
							}}
						/>
						<div className="grow min-w-0">
							<ActiveTabs setTabs={setTabs} tabs={tabs} />
						</div>
					</div>
					<div className="px-4 py-3 flex items-center">
						<RequestLineEditorWrapper
							selectedTab={selectedTab}
							handleTabPathChange={(path) =>
								handleTabRequestPathChange(path, tabs, setTabs)
							}
							handleTabMethodChange={handleTabMethodChange}
						/>
						<Tooltip delayDuration={600}>
							<TooltipTrigger asChild>
								<Button
									variant="primary"
									className="ml-2"
									onClick={() => handleSendRequest(selectedTab, setResponse)}
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
						<ResizablePanel defaultSize={50} className="min-h-10">
							<RequestView
								selectedTab={selectedTab}
								onBodyChange={handleTabBodyChange}
								onHeaderChange={handleTabHeaderChange}
								onParamChange={handleTabParamChange}
								onSubTabChange={handleSubTabChange}
								onRawChange={handleRawChange}
								onHeaderRemove={handleTabHeaderRemove}
								onParamRemove={handleTabParamRemove}
							/>
						</ResizablePanel>
						<ResizableHandle />
						<ResizablePanel defaultSize={50} className="min-h-10">
							<ResponsePane
								key={`response-${selectedTab.id}`}
								panelsMode={panelsMode}
								setPanelsMode={setPanelsMode}
								response={response}
								activeResponseTab={activeResponseTab}
								setActiveResponseTab={setActiveResponseTab}
							/>
						</ResizablePanel>
					</ResizablePanelGroup>
				</div>
			</div>
		</LeftMenuContext>
	);
}
