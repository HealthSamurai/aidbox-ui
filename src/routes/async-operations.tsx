import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/async-operations")({
	staticData: { title: "Async operations" },
	loader: () => ({ breadCrumb: "Async operations" }),
	component: () => <Outlet />,
});
