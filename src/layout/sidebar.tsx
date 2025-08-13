import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@panthevm_original/react-components";
import { Link, useRouterState } from "@tanstack/react-router";
import { House,  SquareTerminal } from "lucide-react";
import { type SidebarMode, SidebarModeSelect, getSidebarMode } from "./sidebar-mode";
import { useState } from "react";


const mainMenuItems = [
	{ title: "Home", url: "/", icon: House },
	{ title: "REST Console", url: "/rest-console", icon: SquareTerminal },
];


export function AidboxSidebar() {
	const routerState = useRouterState();
	const currentPath = routerState.location.pathname;

	const sidebar = useSidebar();

	const [sidebarMode, setSidebarMode] = useState<SidebarMode>(getSidebarMode);

	const onModeChange = (mode: SidebarMode) => {
		setSidebarMode(mode);
		if (mode === "expanded") {
			sidebar.setOpen(true);
		} else {
			sidebar.setOpen(false);
		}
	};

	function handleHoverMode(hover: boolean) {
		if (sidebarMode === "hover") {
			sidebar.setOpen(hover);
		}
	}

	return (
		<Sidebar
			collapsible="icon"
			data-sidebar-mode={sidebarMode}
			className="relative h-full"
			onMouseEnter={() => handleHoverMode(true)}
			onMouseLeave={() => handleHoverMode(false)}
		>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							{mainMenuItems.map((item) => (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton
										asChild
										isActive={currentPath === item.url}
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
								<SidebarModeSelect mode={sidebarMode} onModeChange={onModeChange} />
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarFooter>
		</Sidebar>
	);
}
