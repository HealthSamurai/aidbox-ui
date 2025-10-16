import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/resource")({
	component: () => <Outlet />,
	staticData: {
		title: "Resources",
	},
});
