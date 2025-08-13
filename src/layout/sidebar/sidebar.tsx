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
import { House, SquareTerminal } from "lucide-react";
import { useEffect } from "react";
import type { SidebarMode } from "../../shared/types";
import { SidebarModeSelect } from "../sidebar-mode";

const mainMenuItems = [
	{ title: "Home", url: "/", icon: House },
	{ title: "REST Console", url: "/rest-console", icon: SquareTerminal },
];

export interface SidebarInnerProps {
	sidebarMode: SidebarMode;
	setSidebarMode: (mode: SidebarMode) => void;
}

export function SidebarInner({
	setSidebarMode,
	sidebarMode,
}: SidebarInnerProps) {
	const routerState = useRouterState();
	const currentPath = routerState.location.pathname;

	const sidebar = useSidebar();

	useEffect(() => {
		sidebar.setOpen(sidebarMode === "expanded");
	}, [sidebarMode]);

	const onModeChange = (mode: SidebarMode) => {
		setSidebarMode(mode);
	};

	function handleHoverMode(hover: boolean) {
		sidebar.setOpen(hover);
	}

	return (
		<Sidebar
			collapsible="icon"
			data-sidebar-mode={sidebarMode}
			className="relative h-full"
			{...(sidebarMode === "hover"
				? {
						onMouseEnter: () => handleHoverMode(true),
						onMouseLeave: () => handleHoverMode(false),
					}
				: {})}
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
								<SidebarModeSelect
									mode={sidebarMode}
									onModeChange={onModeChange}
								/>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarFooter>
		</Sidebar>
	);
}
