import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "../components/empty-state";

function DataLineageIndex() {
	return (
		<EmptyState
			title="Analytics"
			description="Select a view or query from the sidebar, or create a new one."
		/>
	);
}

export const Route = createFileRoute("/analytics/")({
	component: DataLineageIndex,
});
