import { Outlet } from "@tanstack/react-router";
import { DataLineageSidebar } from "./sidebar";

export function DataLineagePage() {
	return (
		<div className="flex h-full">
			<DataLineageSidebar />
			<div className="flex-1 min-w-0">
				<Outlet />
			</div>
		</div>
	);
}
