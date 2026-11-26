import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/forms")({
	staticData: { title: "Forms" },
	loader: () => ({ breadCrumb: "Forms" }),
	component: Outlet,
});
