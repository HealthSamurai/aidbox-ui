import {
	Button,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
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
import { House, PanelLeftClose, SquareTerminal } from "lucide-react";
import { useEffect, useState } from "react";

const mainMenuItems = [
	{ title: "Home", url: "/", icon: House },
	{ title: "REST Console", url: "/rest-console", icon: SquareTerminal },
];

const SIDEBAR_MODE_KEY = "aidbox-sidebar-mode";

export type SidebarMode = "expanded" | "collapsed" | "hover";

function saveSidebarMode(mode: SidebarMode) {
	localStorage.setItem(SIDEBAR_MODE_KEY, mode);
}

export function getSidebarMode(): SidebarMode {
	const saved = localStorage.getItem(SIDEBAR_MODE_KEY);
	if (saved === "expanded" || saved === "collapsed" || saved === "hover") {
		return saved;
	}
	return "expanded";
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
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton>
									<PanelLeftClose></PanelLeftClose>
									edge:d8c83455a0
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent side="top" className="mx-3 w-[240px]">
								<DropdownMenuLabel>Sidebar control</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuCheckboxItem
									checked={sidebarMode === "expanded"}
									onCheckedChange={() => handleModeChange("expanded")}
								>
									Expanded

								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={sidebarMode === "collapsed"}
									onCheckedChange={() => handleModeChange("collapsed")}
								>
									Collapsed
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={sidebarMode === "hover"}
									onCheckedChange={() => handleModeChange("hover")}
								>
									Expand on hover
								</DropdownMenuCheckboxItem>
							</DropdownMenuContent>
						</DropdownMenu>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroupContent>
				</SidebarGroup>
			</SidebarFooter>
		</Sidebar>
	);
}
