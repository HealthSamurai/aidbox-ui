import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "../components/empty-state";

function DataLineageIndex() {
	return (
		<EmptyState
			title="Data Lineage"
			description="Select a view or query from the sidebar, or create a new one."
		/>
	);
}

export const Route = createFileRoute("/data-lineage/")({
	component: DataLineageIndex,
});
