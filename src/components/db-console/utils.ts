export type TableEntry = { name: string; type: "table" | "view" };
export type SchemaMap = Record<string, TableEntry[]>;

export const LIMIT_PRESETS = [10, 100, 1000];

export function splitSqlStatements(query: string): string[] {
	return query
		.split(/----|\s*;\s*/)
		.map((s) => s.trim())
		.filter(Boolean);
}

export function isAidboxError(
	err: unknown,
): err is { response: { text(): Promise<string> } } {
	return (
		typeof err === "object" &&
		err !== null &&
		"response" in err &&
		typeof (err as { response?: { text?: unknown } }).response?.text ===
			"function"
	);
}
