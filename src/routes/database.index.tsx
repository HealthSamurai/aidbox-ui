import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/database/")({
	beforeLoad: () => {
		throw redirect({ to: "/database/schema" });
	},
});
