export type ResourceSearchAncestor = { key: string; label: string };

export type ResourceSearchNode<T> = ResourceSearchAncestor & {
	item?: T;
	children: Map<string, ResourceSearchNode<T>>;
};

/** Keep choices in document order, with their full ancestor paths. */
export function resourceSearchTree<T>(
	items: T[],
	{
		getKey,
		getLabel,
		getAncestors,
	}: {
		getKey: (item: T) => string;
		getLabel: (item: T) => string;
		getAncestors: (item: T) => ResourceSearchAncestor[];
	},
): Map<string, ResourceSearchNode<T>> {
	const roots = new Map<string, ResourceSearchNode<T>>();
	for (const item of items) {
		const ancestors = getAncestors(item);
		const key = getKey(item);
		const label = getLabel(item);
		let siblings = roots;
		for (const entry of [...ancestors, { key, label }]) {
			let node = siblings.get(entry.key);
			if (!node) {
				node = { ...entry, children: new Map() };
				siblings.set(entry.key, node);
			}
			if (entry.key === key) node.item = item;
			siblings = node.children;
		}
	}
	return roots;
}
