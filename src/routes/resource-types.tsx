import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/resource-types")({
	component: RouteComponent,
	staticData: {
		title: "Resources",
	},
});

function RouteComponent() {
	return <Outlet />;
}
