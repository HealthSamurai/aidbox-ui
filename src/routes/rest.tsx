import {
	Button,
	CodeEditor,
	RequestLineEditor,
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	Tabs,
	TabsList,
	TabsTrigger,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { createFileRoute } from "@tanstack/react-router";
import {
	Fullscreen,
	PanelLeftClose,
	PanelLeftOpen,
	Play,
	Save,
	Timer,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
	ActiveTabs,
	DEFAULT_TAB,
	type Header,
	type Tab,
} from "../components/rest/active-tabs";
import HeadersEditor from "../components/rest/headers-editor";
import { LeftMenu } from "../components/rest/left-menu";
import ParamsEditor from "../components/rest/params-editor";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { HTTP_STATUS_CODES, REST_CONSOLE_TABS_KEY } from "../shared/const";

export const Route = createFileRoute("/rest")({
	staticData: {
		title: "REST Console",
	},
	component: RouteComponent,
});

function SidebarToggleButton({
	setLeftMenuOpen,
	leftMenuOpen,
}: {
	setLeftMenuOpen: (open: boolean) => void;
	leftMenuOpen: boolean;
}) {
	return (
		<Tooltip delayDuration={600}>
			<TooltipTrigger asChild>
				<Button
					variant="link"
					className="h-full border-b flex-shrink-0 border-r"
					onClick={() => setLeftMenuOpen(!leftMenuOpen)}
				>
					{leftMenuOpen ? (
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

function RequestEditorTabs() {
	return (
		<Tabs defaultValue="body">
			<TabsList>
				<TabsTrigger value="params">Params</TabsTrigger>
				<TabsTrigger value="headers">Headers</TabsTrigger>
				<TabsTrigger value="body">Body</TabsTrigger>
				<TabsTrigger value="raw">Raw</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}

function RequestView({
	selectedTab,
	onBodyChange,
	onSubTabChange,
	onHeaderChange,
	onParamChange,
}: {
	selectedTab: Tab;
	onBodyChange: (body: string) => void;
	onSubTabChange: (subTab: "params" | "headers" | "body" | "raw") => void;
	onHeaderChange: (headerIndex: number, header: Header) => void;
	onParamChange: (paramIndex: number, param: Header) => void;
}) {
	const activeSubTab = selectedTab.activeSubTab || "body";

	const shouldShowBody =
		selectedTab.method === "POST" ||
		selectedTab.method === "PUT" ||
		selectedTab.method === "PATCH";

	const currentActiveSubTab = shouldShowBody
		? activeSubTab
		: activeSubTab === "body"
			? "headers"
			: activeSubTab;

	const getEditorValue = () => {
		return (
			selectedTab.body || JSON.stringify({ resourceType: "Patient" }, null, 2)
		);
	};

	const renderContent = () => {
		switch (currentActiveSubTab) {
			case "params":
				return (
					<ParamsEditor
						key={`params-editor-${selectedTab.id}-${currentActiveSubTab}`}
						params={selectedTab.params || []}
						onParamChange={onParamChange}
					/>
				);
			case "headers":
				return (
					<HeadersEditor
						key={`headers-editor-${selectedTab.id}-${currentActiveSubTab}`}
						headers={selectedTab.headers || []}
						onHeaderChange={onHeaderChange}
					/>
				);
			case "raw":
			case "body":
				return (
					<CodeEditor
						id={`request-editor-${selectedTab.id}-${currentActiveSubTab}`}
						key={`request-editor-${selectedTab.id}-${currentActiveSubTab}`}
						defaultValue={getEditorValue()}
						onChange={onBodyChange}
					/>
				);
			default:
				return null;
		}
	};

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between bg-bg-secondary px-4 border-y h-10">
				<div className="flex items-center">
					<span className="typo-label text-text-secondary mb-0.5 pr-3">
						Request:
					</span>
					<Tabs
						value={currentActiveSubTab}
						onValueChange={(value) =>
							onSubTabChange(value as "params" | "headers" | "body" | "raw")
						}
					>
						<TabsList>
							<TabsTrigger value="params">Params</TabsTrigger>
							<TabsTrigger value="headers">Headers</TabsTrigger>
							{shouldShowBody && <TabsTrigger value="body">Body</TabsTrigger>}
							<TabsTrigger value="raw">Raw</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
				<Button variant="link">
					<Fullscreen />
				</Button>
			</div>
			{renderContent()}
		</div>
	);
}
function ResponseEditorTabs() {
	return (
		<Tabs defaultValue="body">
			<TabsList>
				<TabsTrigger value="body">Body</TabsTrigger>
				<TabsTrigger value="headers">Headers</TabsTrigger>
				<TabsTrigger value="raw">Raw</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}

function ResponseStatus({ status }: { status: number }) {
	const messageColor =
		status >= 400 ? "text-critical-default" : "text-green-500";
	return (
		<span className="flex font-medium items-center text-text-secondary text-sm">
			<span>Status:</span>
			<span className={`ml-1 ${messageColor}`}>
				{status} {HTTP_STATUS_CODES[status]}
			</span>
		</span>
	);
}
function ResponseView() {
	const defaultEditorValue = JSON.stringify(
		{ resourceType: "Patient" },
		null,
		2,
	);
	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between bg-bg-secondary px-4 border-b h-10">
				<div className="flex items-center">
					<span className="typo-label text-text-secondary mb-0.5 pr-3">
						Response:
					</span>
					<ResponseEditorTabs />
				</div>
				<div className="flex items-center gap-2">
					<ResponseStatus status={200} />
					<span className="flex items-center text-text-secondary text-sm pl-2">
						<Timer className="size-4 mr-1" strokeWidth={1.5} />
						<span className="font-bold">512</span>
						<span className="ml-1">ms</span>
					</span>
					<Button variant="link">
						<Fullscreen />
					</Button>
				</div>
			</div>
			<CodeEditor defaultValue={defaultEditorValue} onChange={() => {}} />
		</div>
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

	const selectedTab = useMemo(() => {
		return tabs.find((tab) => tab.selected) || DEFAULT_TAB;
	}, [tabs]);

	function handleTabPathChange(path: string) {
		setTabs((currentTabs) =>
			currentTabs.map((tab) => (tab.selected ? { ...tab, path } : tab)),
		);
	}

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

				// Проверяем, есть ли хотя бы один header с пустыми name и value
				const hasEmptyHeader = headers.some(
					(h) => h.name === "" && h.value === "",
				);

				if (!hasEmptyHeader) {
					headers.push({ id: crypto.randomUUID(), name: "", value: "" });
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

				// Проверяем, есть ли хотя бы один param с пустыми name и value
				const hasEmptyParam = params.some(
					(p) => p.name === "" && p.value === "",
				);

				if (!hasEmptyParam) {
					params.push({ id: crypto.randomUUID(), name: "", value: "" });
				}

				return {
					...tab,
					params,
				};
			}) as Tab[];
		});
	}

	function handleTabBodyChange(body: string) {
		setTabs((currentTabs) => {
			const updatedTabs = currentTabs.map((tab) =>
				tab.selected ? { ...tab, body } : tab,
			);
			return updatedTabs;
		});
	}

	function handleSubTabChange(subTab: "params" | "headers" | "body" | "raw") {
		setTabs((currentTabs) => {
			const updatedTabs = currentTabs.map((tab) =>
				tab.selected ? { ...tab, activeSubTab: subTab } : tab,
			);
			return updatedTabs;
		});
	}

	return (
		<div className="flex w-full h-full">
			<LeftMenu leftMenuOpen={leftMenuOpen} />
			<div className="flex flex-col grow min-w-0">
				<div className="flex h-10 w-full">
					<SidebarToggleButton
						setLeftMenuOpen={setLeftMenuOpen}
						leftMenuOpen={leftMenuOpen}
					/>
					<div className="grow min-w-0">
						<ActiveTabs setTabs={setTabs} tabs={tabs} />
					</div>
				</div>
				<div className="px-4 py-3 flex items-center">
					<RequestLineEditorWrapper
						selectedTab={selectedTab}
						handleTabPathChange={handleTabPathChange}
						handleTabMethodChange={handleTabMethodChange}
					/>
					<Button variant="primary" className="ml-2">
						<Play />
						SEND
					</Button>
					<Button variant="link" className="ml-2">
						<Save />
					</Button>
				</div>
				<ResizablePanelGroup
					autoSaveId="rest-console-request-response"
					direction="vertical"
					className="grow"
				>
					<ResizablePanel defaultSize={50} className="min-h-10">
						<RequestView
							selectedTab={selectedTab}
							onBodyChange={handleTabBodyChange}
							onHeaderChange={handleTabHeaderChange}
							onParamChange={handleTabParamChange}
							onSubTabChange={handleSubTabChange}
						/>
					</ResizablePanel>
					<ResizableHandle />
					<ResizablePanel defaultSize={50} className="min-h-10">
						<ResponseView />
					</ResizablePanel>
				</ResizablePanelGroup>
			</div>
		</div>
	);
}
