import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/forms/packages/$packageId")({
	staticData: { title: "Package" },
	loader: () => ({ breadCrumb: "Package" }),
});
