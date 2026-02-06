import { useEffect, useRef } from "react";

interface InfiniteScrollSentinelProps {
	/** Callback to load more items. */
	onLoadMore: () => void;
	/** Whether there are more items to load. */
	hasMore: boolean;
	/** Whether a load is currently in progress. */
	isLoading?: boolean;
	/**
	 * Ref to a container element. The component will search for the nearest
	 * scrollable element — either a scrollable descendant of `root`, or
	 * a scrollable ancestor of the rendered sentinel element.
	 */
	root?: React.RefObject<HTMLElement | null>;
	/** Distance from the bottom (in px) at which to trigger loading. */
	threshold?: number;
}

function isScrollable(el: HTMLElement): boolean {
	const { overflow, overflowY } = getComputedStyle(el);
	return (
		(overflow === "auto" ||
			overflow === "scroll" ||
			overflowY === "auto" ||
			overflowY === "scroll") &&
		el.scrollHeight > el.clientHeight
	);
}

function findScrollableDescendant(root: HTMLElement): HTMLElement | null {
	if (isScrollable(root)) return root;

	const elements = root.querySelectorAll("*");
	for (const el of elements) {
		if (el instanceof HTMLElement && isScrollable(el)) {
			return el;
		}
	}
	return null;
}

function findScrollParent(element: HTMLElement): HTMLElement | null {
	let parent = element.parentElement;
	while (parent) {
		if (isScrollable(parent)) return parent;
		parent = parent.parentElement;
	}
	return null;
}

export function InfiniteScrollSentinel({
	onLoadMore,
	hasMore,
	isLoading = false,
	root,
	threshold = 200,
}: InfiniteScrollSentinelProps) {
	const sentinelRef = useRef<HTMLDivElement>(null);
	const onLoadMoreRef = useRef(onLoadMore);

	useEffect(() => {
		onLoadMoreRef.current = onLoadMore;
	}, [onLoadMore]);

	useEffect(() => {
		if (!hasMore || isLoading) return;

		let scrollEl: HTMLElement | null = null;
		if (root?.current) {
			scrollEl = findScrollableDescendant(root.current);
		} else if (sentinelRef.current) {
			scrollEl = findScrollParent(sentinelRef.current);
		}

		if (!scrollEl) return;

		const handleScroll = () => {
			const { scrollTop, scrollHeight, clientHeight } = scrollEl!;
			if (scrollHeight - scrollTop - clientHeight < threshold) {
				onLoadMoreRef.current();
			}
		};

		handleScroll();

		scrollEl.addEventListener("scroll", handleScroll, { passive: true });
		return () => scrollEl!.removeEventListener("scroll", handleScroll);
	}, [hasMore, isLoading, root, threshold]);

	if (!hasMore) return null;
	return <div ref={sentinelRef} className="h-px" />;
}
