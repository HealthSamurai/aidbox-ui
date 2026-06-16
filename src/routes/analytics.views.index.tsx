import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/analytics/views/")({
	beforeLoad: () => {
		throw redirect({ to: "/analytics" });
	},
});
