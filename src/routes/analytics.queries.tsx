import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/analytics/queries")({
	staticData: { title: "Queries" },
	loader: () => ({ breadCrumb: "Queries" }),
	component: () => <Outlet />,
});
