import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/vaiv")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/vaiv"!</div>;
}
