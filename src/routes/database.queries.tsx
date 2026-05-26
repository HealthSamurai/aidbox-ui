import { createFileRoute } from "@tanstack/react-router";
import { RunningQueries } from "../components/database/running-queries";

export const Route = createFileRoute("/database/queries")({
	staticData: { title: "Running queries" },
	loader: () => ({ breadCrumb: "Running queries" }),
	component: RunningQueries,
});
