import { createFileRoute } from "@tanstack/react-router";
import { AsyncOperationsPage } from "../components/AsyncOperations/page";

export const Route = createFileRoute("/async-operations/")({
	component: AsyncOperationsPage,
});
