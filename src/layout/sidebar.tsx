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
import { SidebarModeSelect } from "./sidebar-mode";
import { useEffect, useState } from "react";


const mainMenuItems = [
	{ title: "Home", url: "/", icon: House },
	{ title: "REST Console", url: "/rest-console", icon: SquareTerminal },
];

export type SidebarMode = "expanded" | "collapsed" | "hover";

const SIDEBAR_MODE_KEY = "aidbox-sidebar-mode";

function saveSidebarMode(mode: SidebarMode) {
	localStorage.setItem(SIDEBAR_MODE_KEY, mode);
}

export function getSidebarMode(): SidebarMode {
	const stored = localStorage.getItem(SIDEBAR_MODE_KEY);
	return (stored as SidebarMode) || "expanded";
}


export function AidboxSidebar({
	onModeChange,
}: {
	onModeChange?: (mode: SidebarMode) => void;
}) {
	const routerState = useRouterState();
	const currentPath = routerState.location.pathname;

	const sidebar = useSidebar();

	const [sidebarMode, setSidebarMode] = useState<SidebarMode>(getSidebarMode);
	const [isHovering, setIsHovering] = useState(false);

	useEffect(() => {
		const mode = getSidebarMode();
		if (mode === "collapsed" || mode === "hover") {
			sidebar.setOpen(false);
		} else if (mode === "expanded") {
			sidebar.setOpen(true);
		}
		onModeChange?.(mode);
	}, [sidebar, onModeChange]);

	useEffect(() => {
		if (sidebarMode === "hover") {
			sidebar.setOpen(isHovering);
		}
	}, [isHovering, sidebarMode, sidebar]);

	const handleModeChange = (mode: SidebarMode) => {
		setSidebarMode(mode);
		saveSidebarMode(mode);
		onModeChange?.(mode);
		if (mode === "collapsed" || mode === "hover") {
			sidebar.setOpen(false);
			setIsHovering(true);
		} else if (mode === "expanded") {
			sidebar.setOpen(true);
		}
	};

	const handleMouseEnter = () => {
		if (sidebarMode === "hover") {
			setIsHovering(true);
		}
	};

	const handleMouseLeave = () => {
		if (sidebarMode === "hover") {
			setIsHovering(false);
		}
	};

	return (
		<Sidebar
			collapsible="icon"
			data-sidebar-mode={sidebarMode}
			className="relative h-full"
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
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
								<SidebarModeSelect mode={sidebarMode} onModeChange={handleModeChange} />
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarFooter>
		</Sidebar>
	);
}
