import {
	SidebarInset,
	SidebarProvider,
} from "@panthevm_original/react-components";
import type React from "react";
import { Navbar } from "./navbar";
import { AidboxSidebar } from "./sidebar";

function Layout({ children }: { children: React.ReactNode }) {

	return (
		<div className="flex flex-col h-screen">
			<Navbar></Navbar>
			<SidebarProvider  className="grow min-h-0">
				<AidboxSidebar ></AidboxSidebar>
				<SidebarInset className="peer-has-data-[sidebar-mode=hover]:fixed peer-has-data-[sidebar-mode=hover]:h-full peer-has-data-[sidebar-mode=hover]:grow peer-has-data-[sidebar-mode=hover]:left-(--sidebar-width-icon)">
					{children}
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}

export { Layout };
