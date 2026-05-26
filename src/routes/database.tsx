import * as HSComp from "@health-samurai/react-components";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DatabaseLeftMenu } from "../components/database/left-menu";

function DatabasePage() {
	return (
		<HSComp.ResizablePanelGroup
			direction="horizontal"
			autoSaveId="database-sidebar"
			className="h-full"
		>
			<HSComp.ResizablePanel defaultSize={18} minSize={12} maxSize={40}>
				<DatabaseLeftMenu />
			</HSComp.ResizablePanel>
			<HSComp.ResizableHandle />
			<HSComp.ResizablePanel minSize={40}>
				<Outlet />
			</HSComp.ResizablePanel>
		</HSComp.ResizablePanelGroup>
	);
}

export const Route = createFileRoute("/database")({
	staticData: { title: "Database" },
	loader: () => ({ breadCrumb: "Database" }),
	component: DatabasePage,
});
