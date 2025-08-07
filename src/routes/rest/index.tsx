import {
	Button,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Separator,
	Tabs,
	TabsList,
	TabsTrigger,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@health-samurai/react-components";
import { createFileRoute } from "@tanstack/react-router";
import { PanelRightOpen, Plus, X } from "lucide-react";
import { Fragment, useState } from "react";

export const Route = createFileRoute("/rest/")({
	staticData: {
		title: "REST Console",
	},
	component: RouteComponent,
});

const METHOD_COLORS = {
	GET: {
		text: "text-text-success-primary",
		border: "border-border-success",
		background: "bg-(--color-green-200)",
	},
	POST: {
		border: "border-border-success",
		text: "text-yellow-600",
	},
	PUT: {
		border: "border-border-success",
		text: "text-blue-500",
	},
	PATCH: {
		border: "border-border-success",
		text: "text-[#B5069E]",
	},
	DELETE: {
		border: "border-border-success",
		text: "text-text-error-secondary",
	},
};

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
				<Button variant="link" className="border-r h-full">
					<PanelRightOpen className="size-4" />
				</Button>
			</TooltipTrigger>
			<TooltipContent>History / Collections</TooltipContent>
		</Tooltip>
	);
}

function ActiveTabs() {
	return (
		<Tabs defaultValue={MockState.activeTab}>
			<TabsList>
				{MockState.activeTabs.map((activeTab) => (
					<Fragment key={activeTab.id}>
						<TabsTrigger
							value={activeTab.id}
							className="max-w-100 truncate justify-start"
						>
							<span
								className={`mr-1 ${METHOD_COLORS[activeTab.method as keyof typeof METHOD_COLORS].text}`}
							>
								{activeTab.method}
							</span>
							{activeTab.path}
							<Button variant="link" className="p-0 ml-2" asChild>
								<X size={16} />
							</Button>
						</TabsTrigger>
						<Separator orientation="vertical" />
					</Fragment>
				))}
			</TabsList>
		</Tabs>
	);
}

function RequestLineEditor() {
	const [selectedMethod, setSelectedMethod] =
		useState<keyof typeof METHOD_COLORS>("GET");
	return (
		<div className={`flex w-full rounded-md border-1 border-border-primary`}>
			<Select
				value={selectedMethod}
				onValueChange={(method: keyof typeof METHOD_COLORS) =>
					setSelectedMethod(method)
				}
			>
				<SelectTrigger className={`min-w-25 border-none shadow-none`}>
					<SelectValue />
				</SelectTrigger>
				<Separator orientation="vertical" className="bg-border-primary" />
				<SelectContent>
					{Object.keys(METHOD_COLORS).map((method) => (
						<SelectItem key={method} value={method}>
							<span
								className={`font-bold mr-1 ${METHOD_COLORS[method as keyof typeof METHOD_COLORS].text}`}
							>
								{method}
							</span>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Input className="border-none" />
		</div>
	);
}

function RouteComponent() {
	return (
		<div className="h-full w-full">
			<div className="flex border-b h-10">
				<SidebarToggleButton />
				<div className="flex w-full overflow-x-scroll">
					<ActiveTabs />
					<div className="w-full bg-bg-secondary">
						<Button variant="link" className="h-full">
							<Plus />
						</Button>
					</div>
				</div>
			</div>
			<div className="flex w-full px-4 py-3">
				<RequestLineEditor />
			</div>
		</div>
	);
}
