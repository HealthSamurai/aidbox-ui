import {
	SidebarInset,
	SidebarProvider,
} from "@health-samurai/react-components";
import type { PropsWithChildren } from "react";
import { useLocalStorage } from "../hooks";
import { SIDEBAR_MODE_KEY } from "../shared/const";
import type { SidebarMode } from "../shared/types";
import { Navbar } from "./navbar";
import { AidboxSidebar } from "./sidebar";

function Layout({ children }: PropsWithChildren) {
	const [sidebarMode, setSidebarMode] = useLocalStorage<SidebarMode>({
		key: SIDEBAR_MODE_KEY,
		getInitialValueInEffect: false,
		defaultValue: "expanded",
	});

	return (
		<div className="flex flex-col h-screen">
			<Navbar />
			<SidebarProvider
				className="grow min-h-0"
				defaultOpen={sidebarMode === "expanded"}
			>
				<AidboxSidebar
					sidebarMode={sidebarMode}
					setSidebarMode={setSidebarMode}
				/>
				<SidebarInset>{children}</SidebarInset>
			</SidebarProvider>
		</div>
	);
}

export { Layout };
