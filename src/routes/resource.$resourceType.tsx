import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/resource/$resourceType")({
	component: () => <Outlet />,
	loader: (cx) => ({ breadCrumb: cx.params.resourceType }),
});
