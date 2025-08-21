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
import { useState } from "react";
import {
	ActiveTabs,
	DEFAULT_TABS,
	type Tab,
} from "../../components/rest/active-tabs";
import { LeftMenu } from "../../components/rest/left-menu";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { HTTP_STATUS_CODES, REST_CONSOLE_TABS_KEY } from "../../shared/const";

export const Route = createFileRoute("/rest/")({
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
					className="h-full border-r"
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

function RequestLineEditorWrapper() {
	const [selectedMethod, setSelectedMethod] = useState("GET");
	const [requestPath, setRequestPath] = useState("/fhir/Patient");
	return (
		<RequestLineEditor
			className="w-full"
			selectedMethod={selectedMethod}
			setMethod={setSelectedMethod}
			methods={["GET", "POST", "PUT", "PATCH", "DELETE"]}
			inputValue={requestPath}
			onInputChange={(event) => setRequestPath(event.target.value)}
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

function RequestView() {
	const defaultEditorValue = JSON.stringify({ resourceType: "Patient" }, null, 2);
	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between bg-bg-secondary px-4 border-y h-10">
				<div className="flex items-center">
					<span className="typo-label text-text-secondary mb-0.5 pr-3">
						Request:
					</span>
					<RequestEditorTabs />
				</div>
				<Button variant="link">
					<Fullscreen />
				</Button>
			</div>
			<CodeEditor defaultValue={defaultEditorValue} onChange={() => { }} />
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
	const defaultEditorValue = JSON.stringify({ resourceType: "Patient" }, null, 2);
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
			<CodeEditor defaultValue={defaultEditorValue} onChange={() => { }} />
		</div>
	);
}

function RouteComponent() {
	const [tabs, setTabs] = useLocalStorage<Tab[]>({
		key: REST_CONSOLE_TABS_KEY,
		getInitialValueInEffect: false,
		defaultValue: DEFAULT_TABS,
	});

	const [leftMenuOpen, setLeftMenuOpen] = useLocalStorage<boolean>({
		key: "rest-console-left-menu-open",
		getInitialValueInEffect: false,
		defaultValue: true,
	});

	return (
		<div className="flex h-full w-full">
			<LeftMenu leftMenuOpen={leftMenuOpen} />
			<div className="h-full w-full flex flex-col">
				<div className="grid grid-cols-[48px_auto_1fr] h-10 border-b">
					<SidebarToggleButton
						setLeftMenuOpen={setLeftMenuOpen}
						leftMenuOpen={leftMenuOpen}
					/>
					<ActiveTabs setTabs={setTabs} tabs={tabs} />
				</div>
				<div className="px-4 py-3 flex">
					<RequestLineEditorWrapper />
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
						<RequestView />
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
