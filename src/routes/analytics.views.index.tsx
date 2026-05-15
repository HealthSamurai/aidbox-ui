import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "../components/empty-state";

function ViewsPlaceholder() {
	return (
		<EmptyState
			title="Pick a view"
			description="Select a view from the sidebar or create a new one."
		/>
	);
}

export const Route = createFileRoute("/analytics/views/")({
	staticData: { title: "Views" },
	component: ViewsPlaceholder,
});
