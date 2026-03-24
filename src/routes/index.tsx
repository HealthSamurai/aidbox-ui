import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "../components/Home";

export const Route = createFileRoute("/")({
	component: HomePage,
});
