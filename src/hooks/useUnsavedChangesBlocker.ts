import { useBlocker } from "@tanstack/react-router";
import React from "react";

export function useUnsavedChangesBlocker() {
	const [isDirty, _setIsDirty] = React.useState(false);
	const isDirtyRef = React.useRef(false);
	const setIsDirty = React.useCallback(
		(value: boolean | ((prev: boolean) => boolean)) => {
			_setIsDirty((prev) => {
				const next = typeof value === "function" ? value(prev) : value;
				isDirtyRef.current = next;
				return next;
			});
		},
		[],
	);

	const { proceed, reset, status } = useBlocker({
		shouldBlockFn: ({ current, next }) => {
			if (!isDirtyRef.current) return false;
			const currentTab = (current.search as Record<string, unknown>).tab;
			const nextTab = (next.search as Record<string, unknown>).tab;
			if (current.pathname === next.pathname && currentTab === nextTab) {
				return false;
			}
			return true;
		},
		enableBeforeUnload: () => isDirtyRef.current,
		withResolver: true,
	});

	return { isDirty, setIsDirty, proceed, reset, status };
}
