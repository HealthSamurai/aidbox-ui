import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@health-samurai/react-components";
import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, BarChart3, Table2 } from "lucide-react";

const items = [
	{
		url: "/database/schema",
		title: "Schema explorer",
		icon: Table2,
	},
	{
		url: "/database/queries",
		title: "Running queries",
		icon: Activity,
	},
	{
		url: "/database/search-params",
		title: "Search params stats",
		icon: BarChart3,
	},
] as const;

export function DatabaseLeftMenu() {
	const path = useRouterState().location.pathname;
	return (
		<div className="h-full border-r border-border-secondary bg-bg-secondary">
			<div className="px-3 py-3 border-b border-border-secondary">
				<h2 className="typo-label-md text-text-primary">Database</h2>
			</div>
			<SidebarMenu className="p-2 gap-0.5">
				{items.map((item) => {
					const Icon = item.icon;
					const active = path === item.url || path.startsWith(`${item.url}/`);
					return (
						<SidebarMenuItem key={item.url}>
							<SidebarMenuButton asChild isActive={active}>
								<Link to={item.url}>
									<Icon className="size-4" />
									{item.title}
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					);
				})}
			</SidebarMenu>
		</div>
	);
}
