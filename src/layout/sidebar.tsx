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
	ClipboardList,
	Columns3Cog,
	Database,
	Package,
	PanelLeftClose,
	PanelLeftOpen,
	Settings,
	ShieldUser,
	SquareArrowOutUpRight,
	SquareTerminal,
} from "lucide-react";
import { useEffect } from "react";
import { UI_BASE_PATH } from "../shared/const";
import type { SidebarMode } from "../shared/types";
import { getAidboxBaseURL } from "../utils";

const mainMenuItems: { link: React.JSX.Element; url: string; title: string }[] =
	[
		{
			url: "/resource",
			title: "Resource browser",
			link: (
				<Link to="/resource">
					<Columns3Cog />
					Resource browser
				</Link>
			),
		},
		{
			url: "/rest",
			title: "REST Console",
			link: (
				<Link to="/rest">
					<SquareTerminal />
					REST Console
				</Link>
			),
		},
		{
			url: "/db-console",
			title: "DB Console",
			link: (
				<Link to="/db-console">
					<Database />
					DB Console
				</Link>
			),
		},
		{
			url: "/ig",
			title: "FHIR Packages",
			link: (
				<Link to="/ig">
					<Package />
					FHIR Packages
				</Link>
			),
		},
		{
			url: `${getAidboxBaseURL()}/ui/sdc`,
			title: "Aidbox Forms",
			link: (
				<a href={`${getAidboxBaseURL()}/ui/sdc`}>
					<ClipboardList />
					Aidbox Forms
					<SquareArrowOutUpRight className="ml-auto size-3.5 opacity-50" />
				</a>
			),
		},
		{
			url: "/audit-events",
			title: "Audit events",
			link: (
				<Link to="/audit-events">
					<ShieldUser />
					Audit events
				</Link>
			),
		},
		{
			url: "/settings",
			title: "Settings",
			link: (
				<Link to="/settings">
					<Settings />
					Settings
				</Link>
			),
		},
	];

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
