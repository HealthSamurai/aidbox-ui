import type { PropsWithChildren } from "react";
import { Navbar } from "./navbar";
import { AidboxSidebar } from "./sidebar";

function Layout({ children }: PropsWithChildren) {
	return (
		<div className="flex flex-col h-screen">
			<Navbar />
			<AidboxSidebar>{children}</AidboxSidebar>
		</div>
	);
}

export { Layout };
