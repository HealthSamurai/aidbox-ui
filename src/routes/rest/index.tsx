import {
	Button,
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
import { Fullscreen, PanelRightOpen, Play, Save } from "lucide-react";
import { useState } from "react";
import {
	ActiveTabs,
	DEFAULT_TABS,
	type Tab,
} from "../../components/rest/active-tabs";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { REST_CONSOLE_TABS_KEY } from "../../shared/const";

export const Route = createFileRoute("/rest/")({
	staticData: {
		title: "REST Console",
	},
	component: RouteComponent,
});

function SidebarToggleButton() {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button variant="link" className="h-full border-r">
					<PanelRightOpen className="size-4" />
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
	return (
		<div className="flex items-center justify-between bg-bg-secondary px-4 border-y">
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

function ResponseView() {
	return (
		<div className="flex items-center justify-between bg-bg-secondary px-4 border-y">
			<div className="flex items-center">
				<span className="typo-label text-text-secondary mb-0.5 pr-3">
					Response:
				</span>
				<ResponseEditorTabs />
			</div>
			<Button variant="link">
				<Fullscreen />
			</Button>
		</div>
	);
}

function RouteComponent() {
	const [tabs, setTabs] = useLocalStorage<Tab[]>({
		key: REST_CONSOLE_TABS_KEY,
		getInitialValueInEffect: false,
		defaultValue: DEFAULT_TABS,
	});

	return (
		<div className="h-full w-full flex flex-col">
			<div className="grid grid-cols-[48px_auto_1fr] h-10 border-b">
				<SidebarToggleButton />
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
	);
}
