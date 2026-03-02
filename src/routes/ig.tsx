import { createFileRoute, Outlet } from "@tanstack/react-router";

const TITLE = "FHIR Packages";

export const Route = createFileRoute("/ig")({
	component: () => <Outlet />,
	staticData: {
		title: TITLE,
	},
	loader: () => ({ breadCrumb: TITLE }),
});
