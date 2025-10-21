type DiffResult<T> = [T | null, T | null, T | null];

function isPrimitive(value: unknown): boolean {
	return value !== Object(value);
}

function isArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !isArray(value);
}

function diffArrays(a: unknown[], b: unknown[]): DiffResult<unknown[]> {
	const maxLen = Math.max(a.length, b.length);
	const onlyA: unknown[] = [];
	const onlyB: unknown[] = [];
	const both: unknown[] = [];

	let hasOnlyA = false;
	let hasOnlyB = false;
	let hasBoth = false;

	for (let i = 0; i < maxLen; i++) {
		const [diffA, diffB, diffBoth] = diff(a[i], b[i]);

		if (diffA !== undefined) {
			onlyA[i] = diffA;
			if (diffA !== null) hasOnlyA = true;
		}

		if (diffB !== undefined) {
			onlyB[i] = diffB;
			if (diffB !== null) hasOnlyB = true;
		}

		if (diffBoth !== undefined) {
			both[i] = diffBoth;
			if (diffBoth !== null) hasBoth = true;
		}
	}

	return [
		hasOnlyA ? onlyA : null,
		hasOnlyB ? onlyB : null,
		hasBoth ? both : null,
	];
}

function diffObjects(
	a: Record<string, unknown>,
	b: Record<string, unknown>,
): DiffResult<Record<string, unknown>> {
	const keysA = Object.keys(a);
	const keysB = Object.keys(b);
	const allKeys = new Set([...keysA, ...keysB]);

	const onlyA: Record<string, unknown> = {};
	const onlyB: Record<string, unknown> = {};
	const both: Record<string, unknown> = {};

	let hasOnlyA = false;
	let hasOnlyB = false;
	let hasBoth = false;

	for (const key of allKeys) {
		const hasA = key in a;
		const hasB = key in b;

		if (hasA && hasB) {
			const [diffA, diffB, diffBoth] = diff(a[key], b[key]);

			if (diffA !== null) {
				onlyA[key] = diffA;
				hasOnlyA = true;
			}

			if (diffB !== null) {
				onlyB[key] = diffB;
				hasOnlyB = true;
			}

			if (diffBoth !== null) {
				both[key] = diffBoth;
				hasBoth = true;
			}
		} else if (hasA) {
			onlyA[key] = a[key];
			hasOnlyA = true;
		} else {
			onlyB[key] = b[key];
			hasOnlyB = true;
		}
	}

	return [
		hasOnlyA ? onlyA : null,
		hasOnlyB ? onlyB : null,
		hasBoth ? both : null,
	];
}

export function diff<T>(a: T, b: T): DiffResult<T> {
	if (isPrimitive(a) || isPrimitive(b)) {
		if (a === b) {
			return [null, null, a];
		}
		return [a, b, null];
	}

	if (isArray(a) && isArray(b)) {
		return diffArrays(a, b) as DiffResult<T>;
	}

	if (isObject(a) && isObject(b)) {
		return diffObjects(a, b) as DiffResult<T>;
	}

	return [a, b, null];
}
