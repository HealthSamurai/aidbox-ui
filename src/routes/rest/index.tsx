import {
	Button,
	METHOD_COLORS,
	RequestLineEditor,
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	Separator,
	Tabs,
	TabsList,
	TabsTrigger,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { createFileRoute } from "@tanstack/react-router";
import { Fullscreen, PanelRightOpen, Play, Plus, Save, X } from "lucide-react";
import { Fragment, useState } from "react";
import { useLocalStorage } from "../../hooks";

export const Route = createFileRoute("/rest/")({
	staticData: {
		title: "REST Console",
	},
	component: RouteComponent,
});

const MockState = {
	activeTab: "active-tab-1",
	activeTabs: [
		{
			id: "active-tab-1",
			method: "GET",
			path: "/fhir/Patient",
		},
		{
			id: "active-tab-2",
			method: "POST",
			path: "/fhir/Organization",
		},
		{
			id: "active-tab-3",
			method: "PUT",
			path: "/fhir/Encounter/en",
		},
		{
			id: "active-tab-4",
			method: "PATCH",
			path: "/fhir/Observation/ob",
		},
		{
			id: "active-tab-5",
			method: "PUT",
			path: "/fhir/Organization/uuid-uuid-uuid-uuiduuid/QuestionareResponse/uuid-uuid-uuid-uuiduuid",
		},
		{
			id: "active-tab-6",
			method: "DELETE",
			path: "/fhir/Appointement/ap",
		},
	],
};

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

function ActiveTabs() {
	const [tabs, setTabs] = useLocalStorage({
		key: "key",
		getInitialValueInEffect: false,
		defaultValue: [{ id: 1 }],
	});
	return (
		<Tabs
			defaultValue={MockState.activeTab}
			className="overflow-x-auto overflow-y-hidden"
		>
			<TabsList className="w-full">
				{MockState.activeTabs.map((activeTab, index) => (
					<Fragment key={activeTab.id}>
						<TabsTrigger value={activeTab.id} className="max-w-80 min-w-15">
							<Tooltip delayDuration={400}>
								<TooltipTrigger asChild>
									<span className="w-full flex items-center justify-between">
										<span className="truncate">
											<span
												className={`mr-1 ${METHOD_COLORS[activeTab.method as keyof typeof METHOD_COLORS].text}`}
											>
												{activeTab.method}
											</span>
											{activeTab.path}
										</span>
										<Button variant="link" className="p-0 ml-2" asChild>
											<X size={16} />
										</Button>
									</span>
								</TooltipTrigger>
								<TooltipContent className="max-w-60">
									{activeTab.method} {activeTab.path}
								</TooltipContent>
							</Tooltip>
						</TabsTrigger>

						{index < MockState.activeTabs.length - 1 && (
							<Separator orientation="vertical" />
						)}
					</Fragment>
				))}
			</TabsList>
		</Tabs>
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
	return (
		<div className="h-full w-full flex flex-col">
			<div className="grid grid-cols-[48px_auto_1fr] h-10 border-b">
				<SidebarToggleButton />
				<ActiveTabs />
				<div className="bg-bg-secondary border-l">
					<Button variant="link" className="h-full">
						<Plus />
					</Button>
				</div>
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
