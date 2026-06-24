import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/database")({
	staticData: { title: "Database" },
	loader: () => ({ breadCrumb: "Database" }),
	component: () => <Outlet />,
});
