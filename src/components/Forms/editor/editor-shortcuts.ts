import type { KeyboardEvent } from "react";

/** Bind only within the active editor; a modal or composing input owns its keys. */
export function editorShortcutHandler({
	primary,
	format,
	disabled,
}: {
	primary?: () => void;
	format?: () => void;
	disabled?: boolean;
}) {
	return (event: KeyboardEvent<HTMLElement>) => {
		const dialog = Array.from(
			document.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
		).at(-1);
		if (
			disabled ||
			event.defaultPrevented ||
			event.repeat ||
			event.nativeEvent.isComposing ||
			event.altKey ||
			!(event.metaKey || event.ctrlKey) ||
			!event.currentTarget.contains(event.target as Node) ||
			(dialog && !dialog.contains(event.currentTarget))
		)
			return;
		const key = event.key.toLowerCase();
		const action =
			key === "enter" && !event.shiftKey
				? primary
				: key === "f" && event.shiftKey
					? format
					: undefined;
		if (!action) return;
		event.preventDefault();
		event.stopPropagation();
		action();
	};
}
