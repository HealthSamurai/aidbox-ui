import {
	Button,
	Input,
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	Tabs,
	TabsList,
	TabsTrigger,
} from "@panthevm_original/react-components";
import { createFileRoute } from "@tanstack/react-router";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/rest-console")({
	staticData: {
		title: "REST Console",
	},
	component: RouteComponent,
});

function RequestPreviewLine({ item }) {
	return (
		<span className="truncate">
			<span className="text-start font-semibold mr-2 text-text-secondary inline-block w-14">
				{item.method}
			</span>
			{item.url}
		</span>
	);
}

function LeftPanel({ isVisible, onToggle }) {
	const [selectedTab, setSelectedTab] = useState(() => {
		return localStorage.getItem("rest-console-selected-tab") || "history";
	});
	const [searchQuery, setSearchQuery] = useState("");

	const handleTabChange = (value) => {
		setSelectedTab(value);
		localStorage.setItem("rest-console-selected-tab", value);
	};

	const historyItems = [
		{
			id: "1",
			method: "POST",
			url: "/fhir/Patient",
		},
		{
			id: "2",
			method: "PUT",
			url: "/fhir/Organization",
		},
		{
			id: "3",
			method: "DELETE",
			url: "/fhir/Organization/org-1",
		},
		{
			id: "4",
			method: "PATCH",
			url: "/fhir/Organization/org-1",
		},
		{
			id: "5",
			method: "GET",
			url: "/fhir/Patient?gender=male&active=true&deceased=false",
		},
	];

	const collectionItems = [
		{
			id: "1",
			collectionName: "My patch requests",
			method: "PATCH",
			url: "/fhir/Patient",
		},
		{
			id: "2",
			method: "GET",
			collectionName: "Foo bar requests",
			url: "/fhir/Patient",
		},
		{
			id: "3",
			method: "GET",
			collectionName: "Figs get requests",
			url: "/fhir/Practitioner",
		},
	];

	const groupedCollections = useMemo(() => {
		const groups = {};
		collectionItems.forEach((item) => {
			if (!groups[item.collectionName]) {
				groups[item.collectionName] = [];
			}
			groups[item.collectionName].push(item);
		});
		return groups;
	}, []);

	if (!isVisible) {
		return (
			<div className="h-full flex flex-col items-center pt-3 px-2 border-r">
				<Button
					variant="ghost"
					onClick={onToggle}
					aria-label="Show panel"
					className="py-2 px-[0.44rem] text-text-secondary hover:bg-bg-secondary"
				>
					<PanelRightOpen className="size-5" />
				</Button>
				<div className="flex-1 pb-6 flex items-end justify-center px-2">
					<span
						className="text-sm text-muted-foreground"
						style={{
							writingMode: "vertical-rl",
							transform: "rotate(180deg)",
						}}
					>
						History / Collections
					</span>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col">
			<div className="border-b py-3 px-2 flex items-center justify-between">
				<Tabs value={selectedTab} onValueChange={handleTabChange}>
					<TabsList variant="dashed">
						<TabsTrigger value="history">History</TabsTrigger>
						<TabsTrigger value="collections">Collections</TabsTrigger>
					</TabsList>
				</Tabs>
				<Button
					variant="ghost"
					onClick={onToggle}
					aria-label="Hide panel"
					className="py-2 px-[0.44rem] text-text-secondary hover:bg-bg-secondary"
				>
					<PanelRightClose className="size-5 border-b-2 border-transparent" />
				</Button>
			</div>
			<div className="border-b p-2">
				<Input
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					placeholder={
						selectedTab === "history"
							? "Search history..."
							: "Search collections..."
					}
				/>
			</div>
			<div className="flex-1 overflow-y-auto p-2">
				{selectedTab === "history" ? (
					<div className="space-y-1">
						{historyItems
							.filter((item) => {
								const searchText = `${item.method} ${item.url}`.toLowerCase();
								return searchText.includes(searchQuery.toLowerCase());
							})
							.map((item) => (
								<Button
									key={item.id}
									variant="ghost"
									className="w-full justify-start px-3 truncate"
								>
									<RequestPreviewLine item={item}></RequestPreviewLine>
								</Button>
							))}
					</div>
				) : (
					<div className="space-y-4">
						{Object.entries(groupedCollections)
							.filter(([collectionName]) =>
								collectionName
									.toLowerCase()
									.includes(searchQuery.toLowerCase()),
							)
							.map(([collectionName, items]) => (
								<div key={collectionName} className="mt-2">
									<h3 className="text-sm text-text-secondary mb-1 px-3">
										{collectionName}
									</h3>
									<div className="space-y-1 ml-2">
										{items.map((item) => (
											<Button
												key={item.id}
												variant="ghost"
												className="w-full justify-start px-3 truncate"
											>
												<RequestPreviewLine item={item}></RequestPreviewLine>
											</Button>
										))}
									</div>
								</div>
							))}
					</div>
				)}
			</div>
		</div>
	);
}

function RouteComponent() {
	const [leftPanelVisible, setLeftPanelVisible] = useState(() => {
		const stored = localStorage.getItem("rest-console-left-panel-visible");
		return stored ? JSON.parse(stored) : true;
	});

	const toggleLeftPanel = () => {
		const newState = !leftPanelVisible;
		setLeftPanelVisible(newState);
		localStorage.setItem(
			"rest-console-left-panel-visible",
			JSON.stringify(newState),
		);
	};

	return (
		<div className="h-full flex">
			<ResizablePanelGroup
				autoSaveId="rest-console-left-menu"
				direction="horizontal"
				className="h-full flex-1"
			>
				<ResizablePanel
					defaultSize={15}
					className={
						!leftPanelVisible ? "max-w-[3.145rem] min-w-60" : "min-w-60"
					}
				>
					<LeftPanel isVisible={leftPanelVisible} onToggle={toggleLeftPanel} />
				</ResizablePanel>
				<ResizableHandle
					withHandle
					className={!leftPanelVisible ? "hidden" : ""}
				/>
				<ResizablePanel>
					<div className="h-full p-4">
						<div className="text-center text-muted-foreground">
							REST Console content area
						</div>
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}
