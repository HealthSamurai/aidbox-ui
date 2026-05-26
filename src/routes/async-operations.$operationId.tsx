import { createFileRoute } from "@tanstack/react-router";
import { AsyncOperationDetail } from "../components/AsyncOperations/detail";

export const Route = createFileRoute("/async-operations/$operationId")({
	component: RouteComponent,
});

function RouteComponent() {
	const { operationId } = Route.useParams();
	return <AsyncOperationDetail operationId={operationId} />;
}
