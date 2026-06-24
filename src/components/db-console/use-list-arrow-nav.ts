import {
	type KeyboardEvent as ReactKeyboardEvent,
	type RefObject,
	useCallback,
	useEffect,
} from "react";

export function useListArrowNav(
	listRef: RefObject<HTMLDivElement | null>,
	itemSelector: string,
	resetKey: string,
) {
	const moveActiveTo = useCallback(
		(next: HTMLElement | null) => {
			const list = listRef.current;
			if (!list) return;
			for (const el of list.querySelectorAll<HTMLElement>("[data-active]")) {
				el.removeAttribute("data-active");
			}
			if (next) {
				next.setAttribute("data-active", "");
				next.scrollIntoView({ block: "nearest" });
			}
		},
		[listRef],
	);

	useEffect(() => {
		const list = listRef.current;
		if (!list) return;
		moveActiveTo(
			resetKey ? list.querySelector<HTMLElement>(itemSelector) : null,
		);
	}, [listRef, resetKey, itemSelector, moveActiveTo]);

	return useCallback(
		(e: ReactKeyboardEvent) => {
			const list = listRef.current;
			if (!list) return;
			const items = Array.from(
				list.querySelectorAll<HTMLElement>(itemSelector),
			);
			if (items.length === 0) return;
			const current = items.findIndex((el) => el.hasAttribute("data-active"));

			if (e.key === "Enter") {
				const active = items[current];
				if (active) {
					e.preventDefault();
					active.click();
				}
				return;
			}

			if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
			e.preventDefault();
			const next =
				e.key === "ArrowDown"
					? Math.min(current + 1, items.length - 1)
					: Math.max(current - 1, 0);
			moveActiveTo(items[next] ?? null);
		},
		[listRef, itemSelector, moveActiveTo],
	);
}
