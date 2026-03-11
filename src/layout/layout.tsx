import {
	SidebarInset,
	SidebarProvider,
	Toaster,
} from "@health-samurai/react-components";
import { lazy, type PropsWithChildren, Suspense, useEffect } from "react";
import { useUserInfo } from "../api/auth";
import { useLocalStorage } from "../hooks";
import { SIDEBAR_MODE_KEY } from "../shared/const";
import type { SidebarMode } from "../shared/types";
import "../webmcp";
import { Navbar } from "./navbar";
import { AidboxSidebar } from "./sidebar";

const ChatProvider = import.meta.env.DEV
	? lazy(() =>
			import("../components/claude-chat/chat-context").then((m) => ({
				default: m.ChatProvider,
			})),
		)
	: ({ children }: PropsWithChildren) => children;

const ClaudeChatWidget = import.meta.env.DEV
	? lazy(() => import("../components/claude-chat/chat-widget"))
	: () => null;

function Layout({ children }: PropsWithChildren) {
	useUserInfo();
	useEffect(() => {
		document.getElementById("sk")?.remove();
	}, []);

	const [sidebarMode, setSidebarMode] = useLocalStorage<SidebarMode>({
		key: SIDEBAR_MODE_KEY,
		getInitialValueInEffect: false,
		defaultValue: "expanded",
	});

	return (
		<Suspense>
			<ChatProvider>
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
					{import.meta.env.DEV && (
						<Suspense>
							<ClaudeChatWidget />
						</Suspense>
					)}
				</div>
			</ChatProvider>
		</Suspense>
	);
}

export { Layout };
