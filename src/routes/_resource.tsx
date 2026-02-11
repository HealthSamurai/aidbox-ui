import { createFileRoute, Outlet } from "@tanstack/react-router";

const TITLE = "Resources";

export const Route = createFileRoute("/_resource")({
	component: () => <Outlet />,
	staticData: {
		title: TITLE,
	},
	loader: () => ({ breadCrumb: TITLE }),
});
