import { createFileRoute } from "@tanstack/react-router";
import { Browser } from "../components/ResourceBrowser/browser";

export const Route = createFileRoute("/_resource/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <Browser />;
}
