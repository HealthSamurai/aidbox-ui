import {
	SidebarInset,
	SidebarProvider,
} from "@panthevm_original/react-components";
import type React from "react";
import { useState } from "react";
import { Navbar } from "./navbar";
import { AidboxSidebar, getSidebarMode, type SidebarMode } from "./sidebar";

function Layout({ children }: { children: React.ReactNode }) {
	const savedMode = getSidebarMode();
	const defaultOpen = savedMode === "expanded";
	const [currentMode, setCurrentMode] = useState<SidebarMode>(savedMode);

	return (
		<div className="flex flex-col h-screen">
			<Navbar></Navbar>
			<SidebarProvider defaultOpen={defaultOpen} className="grow min-h-0">
				<AidboxSidebar onModeChange={setCurrentMode}></AidboxSidebar>
				<SidebarInset
					className={
						currentMode === "hover"
							? "fixed h-full grow ml-(--sidebar-width-icon)"
							: ""
					}
				>
					{children}
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}

export { Layout };
