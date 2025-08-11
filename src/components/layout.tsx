import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbSeparator,
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
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	useSidebar,
} from "@panthevm_original/react-components";

import { Link, useMatches, useRouterState } from "@tanstack/react-router";
import {
	BookOpenText,
	House,
	LogOut,
	MessageCircleQuestionMark,
	PanelLeftClose,
	SquareTerminal,
	UserRound,
} from "lucide-react";
import React, { Children, useEffect, useState } from "react";
import AidboxLogo from "../assets/aidbox-logo.svg";

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
		<Sidebar collapsible="icon" className="pb-3 relative h-full">
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
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
function Navbar() {
	const matches = useMatches();
	console.log(matches);
	const breadcrumbs = matches
		.filter((match) => match.staticData?.title)
		.map((match) => ({
			title: match.staticData.title as string,
			path: match.pathname,
		}));

	return (
		<div className="flex-none h-15 flex items-center border-b">
			<div className="h-full shrink-0 border-r flex items-center justify-center w-12">
				<img
					src={AidboxLogo}
					alt="Aidbox"
					className="h-6"
					height="24"
					width="24"
				/>
			</div>
			<div className="px-6 w-full flex items-center justify-between">
				{breadcrumbs.length > 0 && (
					<Breadcrumb>
						<BreadcrumbList>
							{breadcrumbs.map((crumb, index) => (
								<React.Fragment key={crumb.path}>
									{index > 0 && <BreadcrumbSeparator>/</BreadcrumbSeparator>}
									<BreadcrumbItem>
										{index === breadcrumbs.length - 1 ? (
											<span className="text-muted-foreground">
												{crumb.title}
											</span>
										) : (
											<Link to={crumb.path}>{crumb.title}</Link>
										)}
									</BreadcrumbItem>
								</React.Fragment>
							))}
						</BreadcrumbList>
					</Breadcrumb>
				)}
				<div className="flex items-center gap-4">
					<Button
						variant="tertiary"
						size="icon"
						className="size-7 rounded-full"
						asChild
					>
						<a href="https://docs.aidbox.app" target="_blank" rel="noopener">
							<BookOpenText />
						</a>
					</Button>
					<Button
						variant="tertiary"
						size="icon"
						className="size-7 rounded-full"
						asChild
					>
						<a href="https://docs.aidbox.app" target="_blank" rel="noopener">
							<MessageCircleQuestionMark />
						</a>
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger>
							<Button
								variant="ghost"
								size="icon"
								className="size-8 rounded-full bg-(--color-surface-1) cursor-pointer"
							>
								<UserRound />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent className="p-2 mr-6">
							<div className="border-b text-center pb-4 mb-1">
								<span className="text-xs text-(--color-elements-assistive)">
									ivan.bagrov@health-samurai.io
								</span>
								<div className="bg-(--color-surface-1) w-fit rounded-full p-2 mx-auto">
									<UserRound size={48} />
								</div>
								<Button variant="secondary" className="mx-4" asChild>
									<a href="https://aidbox.app" target="_blank" rel="noopener">
										Manage your account
									</a>
								</Button>
							</div>
							<Button variant="ghost" className="w-full justify-start">
								<LogOut />
								Sign out
							</Button>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</div>
	);
}

function Layout({ children }: { children: React.ReactNode }) {
	const savedMode = getSidebarMode();
	const defaultOpen = savedMode === "expanded";

	return (
		<div className="flex flex-col h-screen">
			<Navbar></Navbar>
			<SidebarProvider defaultOpen={defaultOpen} className="grow min-h-0">
				<AidboxSidebar></AidboxSidebar>
				<SidebarInset>{children}</SidebarInset>
			</SidebarProvider>
		</div>
	);
}

export { Layout };
