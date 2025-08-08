import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	useSidebar,
} from "@panthevm_original/react-components";

import { Link, useRouterState } from "@tanstack/react-router";
import { House, PanelLeftClose, SquareTerminal } from "lucide-react";

const mainMenuItems = [
	{ title: "Home", url: "/", icon: House },
	{ title: "REST Console", url: "/rest-console", icon: SquareTerminal },
];

function AidboxSidebar() {
	const { setOpen, toggleSidebar } = useSidebar();
	const routerState = useRouterState();
	const currentPath = routerState.location.pathname;
	return (
		<Sidebar collapsible="icon" className="pb-3">
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{mainMenuItems.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton
										asChild
										isActive={currentPath === item.url}
										tooltip={item.title}
									>
										<Link to={item.url}>
											<item.icon />
											{item.title}
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton>
									<PanelLeftClose></PanelLeftClose>
									edge:d8c83455a0
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent side="top" className="w-[240px]">
								<DropdownMenuItem>Expanded</DropdownMenuItem>
								<DropdownMenuItem>Collapsed</DropdownMenuItem>
								<DropdownMenuItem>Expand on hover</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}

function Layout({ children }: { children: React.ReactNode }) {
	return (
		<SidebarProvider defaultOpen={true}>
			<AidboxSidebar></AidboxSidebar>
			<SidebarInset>{children}</SidebarInset>
		</SidebarProvider>
	);
}

export { Layout };
