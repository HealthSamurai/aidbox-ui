export function isArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

export function hasProperty<T extends string>(
	value: object,
	property: T,
): value is { [K in T]: unknown } {
	return Object.hasOwn(value, property);
}
