export type AsyncOperationStatus =
	| "in-progress"
	| "completed"
	| "failed"
	| "cancelled";

export interface AsyncOperationSummary {
	"operation-id": string;
	status: AsyncOperationStatus;
	"task-name": string | null;
	total: number;
	active: number;
	succeeded: number;
	failed: number;
	"created-at": string | null;
	"last-updated": string | null;
}

export interface AsyncOperationsListResponse {
	operations: AsyncOperationSummary[];
	total: number;
	"task-names": string[];
}

export interface AsyncOperationTask {
	task_name: string;
	task_instance: string;
	task_data: Record<string, unknown> | null;
	task_outcome: Record<string, unknown> | null;
	success?: boolean | null;
	time_started?: string | null;
	time_done?: string | null;
	attempt?: number | null;
	executed_by?: string | null;
	priority?: number | null;
	execution_time?: string | null;
	picked?: boolean | null;
	picked_by?: string | null;
	last_heartbeat?: string | null;
	last_success?: string | null;
	last_failure?: string | null;
	consecutive_failures?: number | null;
	version?: number | null;
}

export interface AsyncOperationCounts {
	total: number;
	succeeded: number;
	failed: number;
	running: number;
	pending: number;
}

export interface AsyncOperationFailure {
	"task-instance": string;
	message: string;
}

export interface AsyncOperationStatusResponse {
	"operation-id": string;
	status: AsyncOperationStatus | "not-found";
	tasks: AsyncOperationTask[];
	total: number;
	counts?: AsyncOperationCounts;
	"task-name": string | null;
	"created-at": string | null;
	"last-updated": string | null;
	failure: AsyncOperationFailure | null;
}

export const STATUS_FILTER_OPTIONS: {
	value: AsyncOperationStatus | "all";
	label: string;
}[] = [
	{ value: "all", label: "All" },
	{ value: "in-progress", label: "In progress" },
	{ value: "completed", label: "Completed" },
	{ value: "cancelled", label: "Cancelled" },
	{ value: "failed", label: "Failed" },
];

export const STATUS_LABEL: Record<AsyncOperationStatus, string> = {
	"in-progress": "In progress",
	completed: "Completed",
	failed: "Failed",
	cancelled: "Cancelled",
};

export const STATUS_TEXT_COLOR: Record<AsyncOperationStatus, string> = {
	"in-progress": "text-utility-blue",
	completed: "text-utility-green",
	failed: "text-utility-red",
	cancelled: "text-utility-yellow",
};

export type SortField = "created-at" | "last-updated";
export type SortOrder = "asc" | "desc";

export interface ListQuery {
	statusFilter: AsyncOperationStatus | "all";
	taskName: string;
	sortField: SortField;
	sortOrder: SortOrder;
	page: number;
	pageSize: number;
}

export const DEFAULT_LIST_QUERY: ListQuery = {
	statusFilter: "all",
	taskName: "",
	sortField: "created-at",
	sortOrder: "desc",
	page: 1,
	pageSize: 30,
};

export interface StatusQuery {
	page: number;
	pageSize: number;
	sortField: string;
	sortOrder: SortOrder;
}
