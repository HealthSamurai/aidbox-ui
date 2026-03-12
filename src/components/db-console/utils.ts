import type * as AidboxTypes from "@health-samurai/aidbox-client";

export type SchemaMap = Record<string, string[]>;

export const LIMIT_PRESETS = [10, 100, 1000];

export function splitSqlStatements(query: string): string[] {
	return query
		.split(/----|\s*;\s*/)
		.map((s) => s.trim())
		.filter(Boolean);
}

export function isAidboxError(err: unknown): err is AidboxTypes.ErrorResponse {
	return (
		typeof err === "object" &&
		err !== null &&
		"response" in err &&
		typeof (err as AidboxTypes.ErrorResponse).response?.text === "function"
	);
}
