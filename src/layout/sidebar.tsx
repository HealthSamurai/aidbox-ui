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
import { useAuditLogEnabled } from "../components/AuditEvents/api";
import { useBoxInfo } from "../components/settings/api";
import { UI_BASE_PATH } from "../shared/const";
import type { SidebarMode } from "../shared/types";
import { getAidboxBaseURL } from "../utils";

const mainMenuItems: {
	link: React.JSX.Element;
	url: string;
	title: string;
	key?: string;
}[] = [
	{
		url: "/resource",
		title: "Resource browser",
		link: (
			<Link to="/resource" search={{ q: undefined }}>
				<Columns3Cog />
				Resource browser
			</Link>
		),
	},
	{
		url: "/rest",
		title: "REST console",
		link: (
			<Link to="/rest">
				<SquareTerminal />
				REST console
			</Link>
		),
	},
	{
		url: "/db-console",
		title: "SQL console",
		link: (
			<Link to="/db-console">
				<Database />
				SQL console
			</Link>
		),
	},
	{
		url: "/ig",
		title: "FHIR packages",
		link: (
			<Link to="/ig" search={{ q: undefined, sort: undefined }}>
				<Package />
				FHIR packages
			</Link>
		),
	},
	{
		url: `${getAidboxBaseURL()}/ui/sdc`,
		title: "Aidbox Forms",
		link: (
			<a
				href={`${getAidboxBaseURL()}/ui/sdc`}
				target="_blank"
				rel="noopener noreferrer"
			>
				<ClipboardList />
				Aidbox Forms
				<SquareArrowOutUpRight className="ml-auto size-3.5 opacity-50" />
			</a>
		),
	},
	{
		url: "/audit-events",
		title: "Audit events",
		key: "audit-events",
		link: (
			<Link to="/audit-events">
				<ShieldUser />
				Audit events
			</Link>
		),
	},
];

const isActiveNavItem = (item: { url: string }, currentPath: string) => {
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
	const { data: auditLogEnabled } = useAuditLogEnabled();
	const { data: boxInfo } = useBoxInfo();

	const visibleMenuItems = mainMenuItems.filter(
		(item) => item.key !== "audit-events" || auditLogEnabled,
	);

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
							{visibleMenuItems.map((item) => (
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
									asChild
									isActive={isActiveNavItem({ url: "/settings" }, currentPath)}
									tooltip={{ sideOffset: 16, children: "Settings" }}
									className="text-nowrap"
								>
									<Link to="/settings">
										<Settings />
										Settings
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
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
									{boxInfo?.about?.version ?? ""}
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarFooter>
		</Sidebar>
	);
}
