import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/resource-types")({
	component: () => <Outlet />,
	staticData: {
		title: "Resources",
	},
});
