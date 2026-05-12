import * as HSComp from "@health-samurai/react-components";
import { Link, useRouterState } from "@tanstack/react-router";
import { FileCode2, Table } from "lucide-react";

const items = [
	{ to: "/data-lineage/views", label: "Views", icon: Table },
	{ to: "/data-lineage/queries", label: "Queries", icon: FileCode2 },
] as const;

export function DataLineageSidebar() {
	const routerState = useRouterState();
	const currentPath = routerState.location.pathname;

	return (
		<HSComp.Sidebar collapsible="none">
			<HSComp.SidebarContent>
				<HSComp.SidebarMenu>
					{items.map(({ to, label, icon: Icon }) => {
						const isActive = currentPath.startsWith(to);
						return (
							<HSComp.SidebarMenuItem key={to}>
								<HSComp.SidebarMenuButton isActive={isActive} asChild>
									<Link
										to={to}
										search={{
											q: undefined,
											page: undefined,
											pageSize: undefined,
										}}
									>
										<Icon />
										<span>{label}</span>
									</Link>
								</HSComp.SidebarMenuButton>
							</HSComp.SidebarMenuItem>
						);
					})}
				</HSComp.SidebarMenu>
			</HSComp.SidebarContent>
		</HSComp.Sidebar>
	);
}
