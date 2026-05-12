/**
 * Shapes returned by `aidbox.index/get-search-param-stats`.
 */

/** Index returned by `aidbox.index/list-search-param-indexes`. */
export type SearchParamIndex = {
	base: string;
	name: string;
	definition: string;
	/** `:subtypes` from suggest-index, e.g. ["eq","exact"] or [null]. */
	subtypes: (string | null)[];
	exists: boolean;
	scans: number;
	tuples_read: number;
	tuples_fetched: number;
	size_bytes: number;
};

/** One row per `(resource_type, search_params)`, returned with `:by :shape`. */
export type SearchParamShape = {
	resource_type: string;
	search_params: string[];
	calls: number;
	total_time_ms: number;
	min_time_ms: number | null;
	max_time_ms: number | null;
	mean_time_ms: number;
	last_used_at: string | null;
};

/**
 * One row per `(resource_type, single SP)`, returned with `:by :param`.
 * Aggregates over all shapes that contain the SP. `has_index` is computed
 * server-side from `pg_indexes`.
 */
export type SearchParamStat = {
	resource_type: string;
	search_param: string;
	calls: number;
	total_time_ms: number;
	min_time_ms: number | null;
	max_time_ms: number | null;
	mean_time_ms: number;
	last_used_at: string | null;
	has_index: boolean;
};
