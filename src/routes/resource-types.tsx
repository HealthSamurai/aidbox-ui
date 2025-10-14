import { createFileRoute, Outlet } from "@tanstack/react-router";

function RouteComponent() {
	return <Outlet />;
}

export const Route = createFileRoute("/resource-types")({
	component: RouteComponent,
	staticData: {
		title: "Resources",
	},
});
