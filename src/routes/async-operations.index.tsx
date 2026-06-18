import { createFileRoute } from "@tanstack/react-router";
import { AsyncOperationsPage } from "../components/AsyncOperations/page";
import type { AsyncOperationStatus } from "../components/AsyncOperations/types";

export const Route = createFileRoute("/async-operations/")({
	component: AsyncOperationsPage,
	validateSearch: (search) => {
		const res: { status?: AsyncOperationStatus | "all"; task?: string } = {};
		if (typeof search.status === "string") {
			res.status = search.status as AsyncOperationStatus | "all";
		}
		if (typeof search.task === "string") {
			res.task = search.task;
		}
		return res;
	},
});
