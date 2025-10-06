import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarTrigger,
	useSidebar,
} from "@health-samurai/react-components";
import { Link, useRouterState } from "@tanstack/react-router";
import {
	House,
	PanelLeftClose,
	PanelLeftOpen,
	SquareTerminal,
} from "lucide-react";
import { useEffect } from "react";
import { UI_BASE_PATH } from "../shared/const";
import type { SidebarMode } from "../shared/types";

const mainMenuItems = [
	{ title: "Home", url: "/", icon: House },
	{ title: "REST Console", url: "/rest", icon: SquareTerminal },
];

export function AidboxSidebar({
	sidebarMode,
	setSidebarMode,
}: {
	sidebarMode: SidebarMode;
	setSidebarMode: (mode: SidebarMode) => void;
}) {
	const routerState = useRouterState();
	const currentPath = routerState.location.pathname;
	const sidebar = useSidebar();

	useEffect(() => {
		sidebar.setOpen(sidebarMode === "expanded");
	}, [sidebarMode, sidebar]);

	return (
		<Sidebar
			collapsible="icon"
			data-sidebar-mode={sidebarMode}
			className="relative h-full"
		>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{mainMenuItems.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton
										asChild
										isActive={
											currentPath === item.url ||
											currentPath === UI_BASE_PATH + "/" + item.url
										}
										tooltip={{ sideOffset: 16, children: item.title }}
										className="text-nowrap"
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
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									onClick={() =>
										sidebarMode === "expanded"
											? setSidebarMode("collapsed")
											: setSidebarMode("expanded")
									}
								>
									{sidebarMode === "expanded" ? (
										<PanelLeftClose />
									) : (
										<PanelLeftOpen />
									)}
									edge:d8c83455a0
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarFooter>
		</Sidebar>
	);
}
