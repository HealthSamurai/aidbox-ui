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
import {
	type FileRoutesByPath,
	Link,
	useRouterState,
} from "@tanstack/react-router";
import {
	Columns3Cog,
	House,
	type LucideProps,
	PanelLeftClose,
	PanelLeftOpen,
	SquareTerminal,
} from "lucide-react";
import { useEffect } from "react";
import { UI_BASE_PATH } from "../shared/const";
import type { SidebarMode } from "../shared/types";

const mainMenuItems: {
	title: string;
	url: keyof FileRoutesByPath;
	icon: React.ForwardRefExoticComponent<
		Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
	>;
}[] = [
	{ title: "Home", url: "/", icon: House },
	{ title: "REST Console", url: "/rest", icon: SquareTerminal },
	{
		title: "Resource browser",
		url: "/resource",
		icon: Columns3Cog,
	},
];

const isActiveNavItem = (
	item: (typeof mainMenuItems)[number],
	currentPath: string,
) => {
	console.log(currentPath, item.url);
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
										<Link to={item.url as string}>
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
