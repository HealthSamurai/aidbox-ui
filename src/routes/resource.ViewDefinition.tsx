import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/resource/ViewDefinition")({
	component: () => <Outlet />,
	staticData: {
		title: "ViewDefinition",
	},
});
