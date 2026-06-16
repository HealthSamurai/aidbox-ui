import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/analytics/queries/")({
	beforeLoad: () => {
		throw redirect({ to: "/analytics" });
	},
});
