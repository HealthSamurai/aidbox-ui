import * as HSComp from "@health-samurai/react-components";
import { Outlet } from "@tanstack/react-router";
import { DataLineageSidebar } from "./sidebar";

export function DataLineagePage() {
	return (
		<HSComp.ResizablePanelGroup
			direction="horizontal"
			autoSaveId="data-lineage-sidebar"
			className="h-full"
		>
			<HSComp.ResizablePanel defaultSize={18} minSize={12} maxSize={40}>
				<DataLineageSidebar />
			</HSComp.ResizablePanel>
			<HSComp.ResizableHandle />
			<HSComp.ResizablePanel minSize={40}>
				<Outlet />
			</HSComp.ResizablePanel>
		</HSComp.ResizablePanelGroup>
	);
}
