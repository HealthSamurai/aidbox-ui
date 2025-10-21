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
} from "@health-samurai/react-components";
import { Link, useRouterState } from "@tanstack/react-router";
import {
	Columns3Cog,
	House,
	PanelLeftClose,
	PanelLeftOpen,
	SquareTerminal,
} from "lucide-react";
import { useEffect } from "react";
import { UI_BASE_PATH } from "../shared/const";
import type { SidebarMode } from "../shared/types";

const mainMenuItems = [
	<Link key="/" to="/">
		<House />
		Home
	</Link>,
	<Link key="/rest" to="/rest">
		<SquareTerminal />
		REST Console
	</Link>,
	<Link key="/resource" to="/resource">
		<Columns3Cog />
		Resource browser
	</Link>,
].map((link) => {
	const linkChildren = link.props.children;
	const title = linkChildren[linkChildren.length - 1];
	return { link, url: link.props.to, title };
});

const isActiveNavItem = (
	item: (typeof mainMenuItems)[number],
	currentPath: string,
) => {
	return (
		currentPath === item.url ||
		(currentPath.startsWith(item.url) && item.url !== "/") ||
		currentPath === `${UI_BASE_PATH}/${item.url}`
	);
};

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
										isActive={isActiveNavItem(item, currentPath)}
										tooltip={{ sideOffset: 16, children: item.title }}
										className="text-nowrap"
									>
										{item.link}
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
