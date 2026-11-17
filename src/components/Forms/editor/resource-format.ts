import { dump, JSON_SCHEMA, load } from "js-yaml";

export type ResourceFormat = "json" | "yaml";

export function parseResourceText(
	text: string,
	format: ResourceFormat,
): unknown {
	if (format === "json") return JSON.parse(text);
	// FHIR dates stay strings; YAML timestamps must not become JavaScript Dates.
	const value: unknown = load(text, { schema: JSON_SCHEMA });
	if (value === undefined) throw new Error("Enter a YAML value");
	// Reject values that cannot be sent as JSON, including cyclic aliases and NaN.
	JSON.stringify(value, (_key, item: unknown) => {
		if (typeof item === "number" && !Number.isFinite(item))
			throw new Error("YAML numbers must be finite JSON numbers");
		return item;
	});
	return value;
}

export function serializeResource(
	value: unknown,
	format: ResourceFormat,
): string {
	return format === "yaml"
		? dump(value, {
				schema: JSON_SCHEMA,
				indent: 2,
				lineWidth: -1,
				noRefs: true,
			})
		: JSON.stringify(value, null, 2);
}

export function convertResourceText(
	text: string,
	from: ResourceFormat,
	to: ResourceFormat,
): string {
	return text.trim()
		? serializeResource(parseResourceText(text, from), to)
		: text;
}
