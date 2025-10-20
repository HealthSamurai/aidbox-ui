type Path = (string | number)[];

type WalkerFn<T> = (acc: T, value: unknown, path: Path) => T;

function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function traverseTree<T>(f: WalkerFn<T>, acc: T, root: unknown): T {
	function walker(acc: T, x: unknown, path: Path): T {
		if (isObject(x)) {
			// Process the object first, then reduce over its key-value pairs
			const newAcc = f(acc, x, path);
			return Object.entries(x).reduce(
				(a, [k, v]) => walker(a, v, [...path, k]),
				newAcc,
			);
		} else if (Array.isArray(x)) {
			// Process the collection first, then reduce over its values
			const newAcc = f(acc, x, path);
			return x.reduce((a, v, index) => walker(a, v, [...path, index]), newAcc);
		} else {
			// Leaf node
			return f(acc, x, path);
		}
	}

	return walker(acc, root, []);
}
