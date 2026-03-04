import {
	SidebarInset,
	SidebarProvider,
	Toaster,
} from "@health-samurai/react-components";
import { type PropsWithChildren, useEffect } from "react";
import { useUserInfo } from "../api/auth";
import { useLocalStorage } from "../hooks";
import { SIDEBAR_MODE_KEY } from "../shared/const";
import type { SidebarMode } from "../shared/types";
import {
	useWebMCPNavigation,
	useWebMCPPackages,
	useWebMCPResources,
	useWebMCPRest,
} from "../webmcp";
import { Navbar } from "./navbar";
import { AidboxSidebar } from "./sidebar";

function Layout({ children }: PropsWithChildren) {
	useUserInfo();
	useWebMCPNavigation();
	useWebMCPPackages();
	useWebMCPResources();
	useWebMCPRest();

	useEffect(() => {
		document.getElementById("sk")?.remove();
	}, []);

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
				<SidebarInset className="min-w-0">{children}</SidebarInset>
			</SidebarProvider>
			<Toaster
				position="top-center"
				toastOptions={{
					style: {
						width: "fit-content",
						minWidth: "auto",
						maxWidth: "90vw",
						textAlign: "center",
					},
				}}
			/>
		</div>
	);
}

export { Layout };
