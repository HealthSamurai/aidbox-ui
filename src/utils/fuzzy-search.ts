import Fuse, { type IFuseOptions } from "fuse.js";

export function createFuzzySearch<T>(
	items: T[],
	options: IFuseOptions<T>,
): (query: string) => T[] {
	const fuse = new Fuse(items, {
		shouldSort: true,
		threshold: 0.5,
		ignoreLocation: true,
		useExtendedSearch: true,
		...options,
	});

	return (query: string) => {
		if (!query.trim()) return items;
		return fuse.search(query).map((r) => r.item);
	};
}
