import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/resource/$resourceType")({
	component: () => <Outlet />,
});
