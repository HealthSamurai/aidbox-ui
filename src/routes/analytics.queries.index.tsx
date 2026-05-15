import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "../components/empty-state";

function QueriesPlaceholder() {
	return (
		<EmptyState
			title="Pick a query"
			description="Select a query from the sidebar or create a new one."
		/>
	);
}

export const Route = createFileRoute("/analytics/queries/")({
	staticData: { title: "Queries" },
	component: QueriesPlaceholder,
});
