import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/notebooks")({
	staticData: { title: "Notebooks" },
	loader: () => ({ breadCrumb: "Notebooks" }),
	component: () => <Outlet />,
});
