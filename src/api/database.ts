import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { type AidboxClientR5, useAidboxClient } from "../AidboxClient";

async function rpc<T>(
	client: AidboxClientR5,
	method: string,
	params: Record<string, unknown> = {},
): Promise<T> {
	const res = await client.rawRequest({
		method: "POST",
		url: `/rpc?_m=${method}`,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ method, params }),
	});
	const json = await res.response.json();
	if (json.error) {
		throw new Error(json.error.message ?? `RPC ${method} failed`);
	}
	return json.result as T;
}

// All FHIR resource types, fetched once and reused (drives the stats filter
// dropdown). `/$resource-types` returns an object keyed by resource type.
export function useResourceTypes() {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["database", "resource-types"],
		staleTime: 5 * 60_000,
		refetchOnWindowFocus: false,
		queryFn: async () => {
			const res = await client.rawRequest({
				method: "GET",
				url: "/$resource-types",
				headers: { Accept: "application/json" },
			});
			const json = (await res.response.json()) as Record<string, unknown>;
			return Object.keys(json).sort();
		},
	});
}

// Schema explorer

export type PgTableRow = {
	table_schema: string;
	table_name: string;
	num_rows: number;
	total: string;
	total_size: number;
	index: string;
	index_size: number;
	index_part: number;
	toast_size: number;
	toast: string;
	toast_part: number;
	options: string[] | null;
	last_autovacuum: number | null;
	last_vacuum: number | null;
	last_analyze: number | null;
	last_autoanalyze: number | null;
};

export type PgIndexRow = {
	index_name: string;
	index_size: string;
	unique: "Y" | "N";
	/** pg_am.amname — `btree`, `hash`, `gin`, `gist`, `spgist`, `brin`. */
	index_type: string | null;
	/** `pg_get_indexdef` — full CREATE INDEX statement. */
	index_def: string | null;
	number_of_scans: number;
	tuples_read: number;
	tuples_fetched: number;
};

export type PgTableDetails = {
	table: PgTableRow;
	indexes: PgIndexRow[];
	row: Record<string, unknown> | null;
	offset: number;
};

export type PgTablesParams = {
	q?: string;
	limit?: number;
	schema?: string;
	schemas?: string[];
	/**
	 * When true (and no specific schema is given), list tables across every
	 * user schema instead of the legacy `public`-only default that the old
	 * console relies on.
	 */
	allSchemas?: boolean;
};

export function usePgTables(opts: PgTablesParams = {}) {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["database", "pg-tables", opts],
		queryFn: () => {
			const { allSchemas, ...rest } = opts;
			const params: Record<string, unknown> = { ...rest };
			if (allSchemas) params["all-schemas"] = true;
			return rpc<PgTableRow[]>(client, "aidbox.pg/tables", params);
		},
		refetchOnWindowFocus: false,
	});
}

export type TableRef = { schema: string; table: string };

export function usePgTable(ref: TableRef | null) {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["database", "pg-table", ref],
		queryFn: () =>
			rpc<PgTableDetails>(client, "aidbox.pg/get-table", {
				schema: ref?.schema ?? "public",
				table: ref?.table ?? "",
			}),
		enabled: !!ref?.table,
		refetchOnWindowFocus: false,
	});
}

function invalidateTables(qc: QueryClient) {
	qc.invalidateQueries({ queryKey: ["database", "pg-tables"] });
	qc.invalidateQueries({ queryKey: ["database", "pg-table"] });
}

export function useVacuumTable() {
	const client = useAidboxClient();
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (vars: TableRef & { analyze?: boolean }) =>
			rpc(client, "aidbox.pg/vacuum-table", {
				schema: vars.schema,
				table: vars.table,
				analyze: vars.analyze ? { analyze: true } : false,
			}),
		onSuccess: () => invalidateTables(qc),
	});
}

export function useAnalyzeTable() {
	const client = useAidboxClient();
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (vars: TableRef) =>
			rpc(client, "aidbox.pg/analyze-table", {
				schema: vars.schema,
				table: vars.table,
			}),
		onSuccess: () => invalidateTables(qc),
	});
}

export function useReindexTable() {
	const client = useAidboxClient();
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (vars: TableRef) =>
			rpc(client, "aidbox.pg/reindex-table", {
				schema: vars.schema,
				table: vars.table,
			}),
		onSuccess: () => invalidateTables(qc),
	});
}

export function useTruncateTable() {
	const client = useAidboxClient();
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (vars: TableRef) =>
			rpc(client, "aidbox.pg/truncate-table", {
				schema: vars.schema,
				table: vars.table,
			}),
		onSuccess: () => invalidateTables(qc),
	});
}

// Active queries

export type ActiveQueryRow = {
	pid: number;
	query: string;
	state: string;
	duration: number;
	usename: string | null;
	wait_event_type: string | null;
	wait_event: string | null;
	query_start: string;
	application_name?: string | null;
};

export function useActiveQueries(pollMs: number | false = 5000) {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["database", "active-queries"],
		queryFn: () => rpc<ActiveQueryRow[]>(client, "aidbox.pg/active-queries"),
		refetchInterval: pollMs === false ? false : pollMs,
		refetchOnWindowFocus: false,
	});
}

export function useCancelQuery() {
	const client = useAidboxClient();
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (pid: number) => rpc(client, "aidbox.pg/cancel-query", { pid }),
		onSuccess: () =>
			qc.invalidateQueries({ queryKey: ["database", "active-queries"] }),
	});
}

export function useTerminateQuery() {
	const client = useAidboxClient();
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (pid: number) =>
			rpc(client, "aidbox.pg/terminate-query", { pid }),
		onSuccess: () =>
			qc.invalidateQueries({ queryKey: ["database", "active-queries"] }),
	});
}

// Search param stats

export type SearchParamStatRow = {
	resource_type: string;
	search_param?: string;
	search_params?: string[];
	calls: number;
	total_time_ms: number;
	min_time_ms: number | null;
	max_time_ms: number | null;
	mean_time_ms: number | null;
	last_used_at: string | null;
	has_index?: boolean;
};

export type SearchParamStatsBy = "param" | "shape";

export type SearchParamStatsOrderBy =
	| "calls"
	| "last-used"
	| "mean-time-ms"
	| "total-time-ms"
	| "min-time-ms"
	| "max-time-ms"
	| "resource-type"
	| "search-param";

export type SortDir = "asc" | "desc";

export type SearchParamStatsParams = {
	by?: SearchParamStatsBy;
	resourceType?: string;
	searchParam?: string;
	/** Case-insensitive `ILIKE '%q%'` substring filters (UI search box). */
	resourceTypeLike?: string;
	searchParamLike?: string;
	limit?: number;
	offset?: number;
	orderBy?: SearchParamStatsOrderBy;
	orderDir?: SortDir;
};

function buildSpStatsParams(
	opts: SearchParamStatsParams,
): Record<string, unknown> {
	const params: Record<string, unknown> = {
		by: opts.by ?? "param",
		limit: opts.limit ?? 30,
		offset: opts.offset ?? 0,
	};
	if (opts.resourceType) params["resource-type"] = opts.resourceType;
	if (opts.searchParam) params["search-param"] = opts.searchParam;
	if (opts.resourceTypeLike)
		params["resource-type-like"] = opts.resourceTypeLike;
	if (opts.searchParamLike) params["search-param-like"] = opts.searchParamLike;
	if (opts.orderBy) params["order-by"] = opts.orderBy;
	if (opts.orderDir) params["order-dir"] = opts.orderDir;
	return params;
}

export function useSearchParamStats(opts: SearchParamStatsParams = {}) {
	const client = useAidboxClient();
	const params = buildSpStatsParams(opts);
	return useQuery({
		queryKey: ["database", "search-param-stats", "rows", params],
		queryFn: () =>
			rpc<SearchParamStatRow[]>(
				client,
				"aidbox.index/get-search-param-stats",
				params,
			),
		refetchOnWindowFocus: false,
		placeholderData: (prev) => prev,
	});
}

export function useSearchParamStatsCount(
	opts: Pick<
		SearchParamStatsParams,
		| "by"
		| "resourceType"
		| "searchParam"
		| "resourceTypeLike"
		| "searchParamLike"
	> = {},
) {
	const client = useAidboxClient();
	const params: Record<string, unknown> = { by: opts.by ?? "param" };
	if (opts.resourceType) params["resource-type"] = opts.resourceType;
	if (opts.searchParam) params["search-param"] = opts.searchParam;
	if (opts.resourceTypeLike)
		params["resource-type-like"] = opts.resourceTypeLike;
	if (opts.searchParamLike) params["search-param-like"] = opts.searchParamLike;
	return useQuery({
		queryKey: ["database", "search-param-stats", "count", params],
		queryFn: () =>
			rpc<{ total: number }>(
				client,
				"aidbox.index/count-search-param-stats",
				params,
			),
		refetchOnWindowFocus: false,
		placeholderData: (prev) => prev,
	});
}

export function useResetSearchParamStats() {
	const client = useAidboxClient();
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => rpc(client, "aidbox.index/reset-search-param-stats"),
		onSuccess: () =>
			qc.invalidateQueries({ queryKey: ["database", "search-param-stats"] }),
	});
}

// Drop stats for specific (resource_type, search_param) rows. The backend
// resets one filter per call, so we loop client-side (selection is UI-bound,
// so N stays small).
export function useResetSearchParamStatsRows() {
	const client = useAidboxClient();
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (
			rows: { resourceType: string; searchParam: string }[],
		) => {
			for (const row of rows) {
				await rpc(client, "aidbox.index/reset-search-param-stats", {
					"resource-type": row.resourceType,
					"search-param": row.searchParam,
				});
			}
		},
		onSuccess: () =>
			qc.invalidateQueries({ queryKey: ["database", "search-param-stats"] }),
	});
}
