import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/resource-types/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>TODO</div>;
}
