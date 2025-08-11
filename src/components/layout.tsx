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
import { useEffect, useState } from "react";

const mainMenuItems = [
	{ title: "Home", url: "/", icon: House },
	{ title: "REST Console", url: "/rest-console", icon: SquareTerminal },
];

const SIDEBAR_MODE_KEY = "aidbox-sidebar-mode";

type SidebarMode = "expanded" | "collapsed" | "hover";

function saveSidebarMode(mode: SidebarMode) {
	localStorage.setItem(SIDEBAR_MODE_KEY, mode);
}

function getSidebarMode(): SidebarMode {
	const saved = localStorage.getItem(SIDEBAR_MODE_KEY);
	if (saved === "expanded" || saved === "collapsed" || saved === "hover") {
		return saved;
	}
	return "expanded";
}

function AidboxSidebar() {
	const routerState = useRouterState();
	const currentPath = routerState.location.pathname;
	const sidebar = useSidebar();
	const [sidebarMode, setSidebarMode] = useState<SidebarMode>(getSidebarMode);

	useEffect(() => {
		const mode = getSidebarMode();
		if (mode === "collapsed" || mode === "hover") {
			sidebar.setOpen(false);
		} else if (mode === "expanded") {
			sidebar.setOpen(true);
		}
	}, [sidebar]);

	const handleModeChange = (mode: SidebarMode) => {
		setSidebarMode(mode);
		saveSidebarMode(mode);
		if (mode === "collapsed" || mode === "hover") {
			sidebar.setOpen(false);
		} else if (mode === "expanded") {
			sidebar.setOpen(true);
		}
	};

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
							<DropdownMenuContent side="top" className="mx-3 w-[240px]">
								<DropdownMenuItem onSelect={() => handleModeChange("expanded")}>
									Expanded
								</DropdownMenuItem>
								<DropdownMenuItem
									onSelect={() => handleModeChange("collapsed")}
								>
									Collapsed
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}

function Layout({ children }: { children: React.ReactNode }) {
	const savedMode = getSidebarMode();
	const defaultOpen = savedMode === "expanded";

	return (
		<SidebarProvider defaultOpen={defaultOpen}>
			<AidboxSidebar></AidboxSidebar>
			<SidebarInset>{children}</SidebarInset>
		</SidebarProvider>
	);
}

export { Layout };
