import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAidboxClient } from "../../AidboxClient";
import type {
	AsyncOperationStatusResponse,
	AsyncOperationsListResponse,
	ListQuery,
	StatusQuery,
} from "./types";

const LIST_KEY = ["async-operations", "list"] as const;
const STATUS_KEY = (id: string) => ["async-operations", "status", id] as const;

function buildListUrl(q: ListQuery): string {
	const params = new URLSearchParams();
	if (q.statusFilter !== "all") params.set("status", q.statusFilter);
	if (q.taskName.trim()) params.set("task-name", q.taskName.trim());
	params.set("sort", q.sortField);
	params.set("order", q.sortOrder);
	params.set("_count", String(q.pageSize));
	params.set("_offset", String((q.page - 1) * q.pageSize));
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
			query.page,
			query.pageSize,
		],
		placeholderData: (previousData) => previousData,
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

function buildStatusUrl(operationId: string, q: StatusQuery): string {
	const params = new URLSearchParams();
	params.set("_count", String(q.pageSize));
	params.set("_offset", String((q.page - 1) * q.pageSize));
	params.set("sort", q.sortField);
	params.set("order", q.sortOrder);
	return `/$async-operations/${encodeURIComponent(operationId)}?${params.toString()}`;
}

export function useAsyncOperationStatus(
	operationId: string | undefined,
	query: StatusQuery,
) {
	const client = useAidboxClient();

	return useQuery({
		queryKey: operationId
			? [
					...STATUS_KEY(operationId),
					query.page,
					query.pageSize,
					query.sortField,
					query.sortOrder,
				]
			: ["async-operations", "status", "none"],
		enabled: !!operationId,
		placeholderData: (previousData, previousQuery) =>
			previousQuery?.queryKey[2] === operationId ? previousData : undefined,
		queryFn: async () => {
			const result = await client.request<AsyncOperationStatusResponse>({
				method: "GET",
				url: buildStatusUrl(operationId ?? "", query),
			});
			if (result.isOk()) {
				return result.value.resource;
			}
			throw new Error("Failed to fetch async operation status");
		},
		refetchInterval: (q) => {
			const data = q.state.data as AsyncOperationStatusResponse | undefined;
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
