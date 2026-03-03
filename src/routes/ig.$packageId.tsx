import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/ig/$packageId")({
	component: () => <Outlet />,
	loader: (cx) => ({ breadCrumb: cx.params.packageId }),
});
