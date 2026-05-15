import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/data-lineage/views")({
	staticData: { title: "Views" },
	loader: () => ({ breadCrumb: "Views" }),
	component: () => <Outlet />,
});
