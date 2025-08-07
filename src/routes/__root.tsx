import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
} from "@panthevm_original/react-components";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import * as React from "react";

export const Route = createRootRoute({
	component: RootComponent,
});

function Layout({ children }: { children: React.ReactNode }) {
	const mainMenuItems = [{ title: "REST Console", url: "/rest-console" }];
	return (
		<SidebarProvider defaultOpen={false}>
			<Sidebar collapsible="expanded">
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupLabel>Aidbox</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{mainMenuItems.map((item) => (
									<SidebarMenuItem key={item.title}>
										<SidebarMenuButton asChild>
											<Link to={item.url}> {item.title} </Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
			</Sidebar>
			<SidebarInset>{children}</SidebarInset>
		</SidebarProvider>
	);
}

function RootComponent() {
	return (
		<React.Fragment>
			<Layout>
				<Outlet />
			</Layout>
			{/* <TanStackRouterDevtools /> */}
			{/* <ReactQueryDevtools /> */}
		</React.Fragment>
	);
}
