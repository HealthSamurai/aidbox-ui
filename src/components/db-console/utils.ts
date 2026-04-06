export type TableEntry = { name: string; type: "table" | "view" };
export type SchemaMap = Record<string, TableEntry[]>;

export type FunctionEntry = {
	name: string;
	arguments: string;
	return_type: string;
	function_type: string;
};
export type FunctionsMap = Record<string, FunctionEntry[]>;

export const LIMIT_PRESETS = [10, 100, 1000];

export function splitSqlStatements(query: string): string[] {
	return query
		.split(/\n----\n/)
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
