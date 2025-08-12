import {
	Button,
	Label,
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
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
} from "@panthevm_original/react-components";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/rest-console")({
	staticData: {
		title: "REST Console",
	},
	component: RouteComponent,
});

function HistoryCollectionsSidebar() {
	return (
		<Sidebar collapsible="icon" className="border-r absolute h-full">
			<SidebarHeader className="group-data-[collapsible=icon]:border-none border-b">
				<SidebarMenu>
					<SidebarMenuItem className="group-data-[collapsible=icon]:block hidden">
						<SidebarMenuButton asChild>
							<SidebarTrigger />
						</SidebarMenuButton>
					</SidebarMenuItem>
					<div className="group-data-[collapsible=icon]:hidden flex items-center justify-between">
						<Tabs defaultValue="history">
							<TabsList variant="dashed">
								<TabsTrigger value="history">History</TabsTrigger>
								<TabsTrigger value="collections">Collections</TabsTrigger>
							</TabsList>
						</Tabs>
						<SidebarTrigger />
					</div>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent></SidebarContent>
		</Sidebar>
	);
}

function RouteComponent() {
	return (
		<SidebarProvider defaultOpen={false} className="flex min-h-0">
			<HistoryCollectionsSidebar />
			<SidebarInset className="flex-1 h-full">
				<div className="p-4">REST Console content area</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
