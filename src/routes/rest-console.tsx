import {
	Button,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	Input,
	Label,
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Textarea,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@panthevm_original/react-components";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/rest-console")({
	staticData: {
		title: "REST Console",
	},
	component: RouteComponent,
});

function HistoryCollectionsSidebar() {
	const [selectedTab, setSelectedTab] = useState(() => {
		return localStorage.getItem("rest-console-selected-tab") || "history";
	});

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
	return (
		<Sidebar collapsible="icon" className="border-r absolute h-full">
			<SidebarHeader className="group-data-[collapsible=icon]:p-2 p-0">
				<SidebarMenu className="gap-0">
					<SidebarMenuItem className="group-data-[collapsible=icon]:block hidden">
						<SidebarMenuButton asChild>
							<SidebarTrigger />
						</SidebarMenuButton>
					</SidebarMenuItem>
					<div className="group-data-[collapsible=icon]:hidden flex items-center justify-between border-b p-2">
						<Tabs value={selectedTab} onValueChange={handleTabChange}>
							<TabsList variant="dashed">
								<TabsTrigger value="history">History</TabsTrigger>
								<TabsTrigger value="collections">Collections</TabsTrigger>
							</TabsList>
						</Tabs>
						<SidebarTrigger />
					</div>
					<div className="group-data-[collapsible=icon]:hidden py-2 border-b px-2">
						<Input
							placeholder={
								selectedTab === "history"
									? "Search history..."
									: "Search collections..."
							}
						/>
					</div>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				{selectedTab === "history" ? (
					<SidebarGroup className="group-data-[collapsible=icon]:hidden">
						<SidebarGroupContent>
							<SidebarMenu>
								{historyItems.map((item) => (
									<SidebarMenuItem key={item.id}>
										<Tooltip>
											<TooltipTrigger asChild>
												<SidebarMenuButton className="px-3 truncate">
													<span>
														{item.method} {item.url}
													</span>
												</SidebarMenuButton>
											</TooltipTrigger>
											<TooltipContent
												side="right"
												align="center"
												sideOffset="2"
											>
												{item.method} {item.url}
											</TooltipContent>
										</Tooltip>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				) : (
					<>
						{Object.entries(groupedCollections).map(
							([collectionName, items]) => (
								<SidebarGroup
									key={collectionName}
									className="group-data-[collapsible=icon]:hidden"
								>
									<SidebarGroupLabel>{collectionName}</SidebarGroupLabel>
									<SidebarGroupContent>
										<SidebarMenu>
											{items.map((item) => (
												<SidebarMenuItem key={item.id}>
													<Tooltip>
														<TooltipTrigger asChild>
															<SidebarMenuButton className="px-3 truncate">
																<span>
																	{item.method} {item.url}
																</span>
															</SidebarMenuButton>
														</TooltipTrigger>
														<TooltipContent
															side="right"
															align="center"
															sideOffset="2"
														>
															{item.method} {item.url}
														</TooltipContent>
													</Tooltip>
												</SidebarMenuItem>
											))}
										</SidebarMenu>
									</SidebarGroupContent>
								</SidebarGroup>
							),
						)}
					</>
				)}
			</SidebarContent>
		</Sidebar>
	);
}

function RouteComponent() {
	const [sidebarOpen, setSidebarOpen] = useState(() => {
		const stored = localStorage.getItem("rest-console-sidebar-open");
		return stored ? JSON.parse(stored) : false;
	});

	const handleOpenChange = (open) => {
		setSidebarOpen(open);
		localStorage.setItem("rest-console-sidebar-open", JSON.stringify(open));
	};

	return (
		<SidebarProvider
			open={sidebarOpen}
			onOpenChange={handleOpenChange}
			className="flex min-h-0"
		>
			<HistoryCollectionsSidebar />
			<SidebarInset className="flex-1 h-full">
				<div className="p-4">REST Console content area</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
