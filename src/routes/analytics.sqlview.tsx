import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/analytics/sqlview")({
	staticData: { title: "SQLView" },
	loader: () => ({ breadCrumb: "SQLView" }),
	component: () => <Outlet />,
});
