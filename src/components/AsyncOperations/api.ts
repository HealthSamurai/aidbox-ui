import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAidboxClient } from "../../AidboxClient";
import type {
	AsyncOperationStatusResponse,
	AsyncOperationsListResponse,
	ListQuery,
} from "./types";

const LIST_KEY = ["async-operations", "list"] as const;
const STATUS_KEY = (id: string) => ["async-operations", "status", id] as const;

function buildListUrl(q: ListQuery): string {
	const params = new URLSearchParams();
	if (q.statusFilter !== "all") params.set("status", q.statusFilter);
	if (q.taskName.trim()) params.set("task-name", q.taskName.trim());
	params.set("sort", q.sortField);
	params.set("order", q.sortOrder);
	const qs = params.toString();
	return qs ? `/$async-operations?${qs}` : "/$async-operations";
}

export function useAsyncOperationsList(query: ListQuery) {
	const client = useAidboxClient();

	return useQuery({
		queryKey: [
			...LIST_KEY,
			query.statusFilter,
			query.taskName.trim(),
			query.sortField,
			query.sortOrder,
		],
		queryFn: async () => {
			const result = await client.request<AsyncOperationsListResponse>({
				method: "GET",
				url: buildListUrl(query),
			});
			if (result.isOk()) {
				return result.value.resource;
			}
			throw new Error("Failed to fetch async operations");
		},
		refetchInterval: 10_000,
		refetchOnWindowFocus: false,
	});
}

export function useAsyncOperationStatus(operationId: string | undefined) {
	const client = useAidboxClient();

	return useQuery({
		queryKey: operationId
			? STATUS_KEY(operationId)
			: ["async-operations", "status", "none"],
		enabled: !!operationId,
		queryFn: async () => {
			const result = await client.request<AsyncOperationStatusResponse>({
				method: "GET",
				url: `/$async-operations/${encodeURIComponent(operationId ?? "")}`,
			});
			if (result.isOk()) {
				return result.value.resource;
			}
			throw new Error("Failed to fetch async operation status");
		},
		refetchInterval: (query) => {
			const data = query.state.data as AsyncOperationStatusResponse | undefined;
			return data?.status === "in-progress" ? 5_000 : false;
		},
		refetchOnWindowFocus: false,
	});
}

export function useCancelAsyncOperation() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (operationId: string) => {
			const result = await client.request<unknown>({
				method: "POST",
				url: `/$async-operations/${encodeURIComponent(operationId)}/$cancel`,
				body: "{}",
			});
			if (result.isOk()) return result.value.resource;
			throw new Error("Failed to cancel async operation");
		},
		onSuccess: (_data, operationId) => {
			queryClient.invalidateQueries({ queryKey: LIST_KEY });
			queryClient.invalidateQueries({ queryKey: STATUS_KEY(operationId) });
		},
	});
}
