import {
	SidebarInset,
	SidebarProvider,
} from "@panthevm_original/react-components";
import type { PropsWithChildren } from "react";
import { useLocalStorage } from "../../hooks";
import { SIDEBAR_MODE_KEY } from "../../shared/const";
import type { SidebarMode } from "../../shared/types";
import { SidebarInner } from "./sidebar";

export const AidboxSidebar = ({ children }: PropsWithChildren) => {
	const [sidebarMode, setSidebarMode] = useLocalStorage<SidebarMode>({
		key: SIDEBAR_MODE_KEY,
		defaultValue: "expanded",
	});

	return (
		<SidebarProvider
			className="grow min-h-0"
			defaultOpen={sidebarMode === "expanded"}
		>
			<SidebarInner sidebarMode={sidebarMode} setSidebarMode={setSidebarMode} />
			<SidebarInset className="peer-has-data-[sidebar-mode=hover]:fixed peer-has-data-[sidebar-mode=hover]:h-full peer-has-data-[sidebar-mode=hover]:grow peer-has-data-[sidebar-mode=hover]:left-(--sidebar-width-icon)">
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
};
