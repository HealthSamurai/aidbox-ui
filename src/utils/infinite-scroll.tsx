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
		// The subtree that holds the items; with `root` it is also their viewport.
		const content = root?.current ?? sentinelRef.current?.parentElement;
		if (!content) return;

		const findScrollElement = () => {
			if (root?.current) return findScrollableDescendant(root.current);
			if (sentinelRef.current) return findScrollParent(sentinelRef.current);
			return null;
		};

		// One load per observed change: a scroll or resize that lands before
		// React has committed the previous load must not request it again.
		let armed = true;
		const check = () => {
			if (!armed) return;
			const scrollElement = findScrollElement();
			if (scrollElement) {
				const { scrollTop, scrollHeight, clientHeight } = scrollElement;
				if (scrollHeight - scrollTop - clientHeight >= threshold) return;
			} else if (content.clientHeight === 0) {
				return;
			}
			// Near the bottom — or nothing scrolls yet because the items are
			// shorter than their viewport, so no scroll event would ever come.
			armed = false;
			onLoadMoreRef.current();
		};

		let frame = 0;
		const schedule = () => {
			if (frame !== 0) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				check();
			});
		};
		const onContentChange = () => {
			armed = true;
			schedule();
		};

		const resizeObserver = new ResizeObserver(onContentChange);
		resizeObserver.observe(content);
		const mutationObserver = new MutationObserver(onContentChange);
		mutationObserver.observe(content, { childList: true, subtree: true });
		// Scroll events do not bubble, but they do pass through the capture phase.
		document.addEventListener("scroll", schedule, {
			capture: true,
			passive: true,
		});
		schedule();

		return () => {
			cancelAnimationFrame(frame);
			resizeObserver.disconnect();
			mutationObserver.disconnect();
			document.removeEventListener("scroll", schedule, { capture: true });
		};
	}, [hasMore, isLoading, root, threshold]);

	if (!hasMore) return null;
	// When root is provided, don't render the sentinel div — it's not needed
	// for scroll detection and would make the root container barely scrollable,
	// causing findScrollableDescendant to pick the root instead of a deeper
	// scroll container (e.g. Table with stickyHeader).
	if (root) return null;
	return <div ref={sentinelRef} className="h-px" />;
}
