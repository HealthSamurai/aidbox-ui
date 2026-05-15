import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/analytics/views")({
	staticData: { title: "Views" },
	loader: () => ({ breadCrumb: "Views" }),
	component: () => <Outlet />,
});
