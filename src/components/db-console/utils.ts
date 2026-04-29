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

export const TIMEOUT_PRESETS: { value: number | null; label: string }[] = [
	{ value: 5, label: "5s" },
	{ value: 30, label: "30s" },
	{ value: 60, label: "1m" },
	{ value: 300, label: "5m" },
	{ value: 900, label: "15m" },
	{ value: null, label: "No timeout" },
];

export const DEFAULT_TIMEOUT_SEC = 60;

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
