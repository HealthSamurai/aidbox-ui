import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/data-lineage/queries")({
	staticData: { title: "Queries" },
	loader: () => ({ breadCrumb: "Queries" }),
	component: () => <Outlet />,
});
