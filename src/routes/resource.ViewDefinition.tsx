import { createFileRoute, Outlet } from "@tanstack/react-router";

const TITLE = "ViewDefinition";

export const Route = createFileRoute("/resource/ViewDefinition")({
	component: () => <Outlet />,
	staticData: {
		title: TITLE,
	},
	loader: () => ({ breadCrumb: TITLE }),
});
