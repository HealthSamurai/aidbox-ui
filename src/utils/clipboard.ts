// navigator.clipboard exists only in secure contexts (HTTPS / localhost).
// On plain HTTP it is undefined, which is why writeText throws
// "Cannot read properties of undefined (reading 'writeText')".
//
// The fallback path is tricky because:
//   1. document.execCommand("copy") copies the current window selection,
//      not whatever element you focused — and Radix DropdownMenu's
//      FocusScope can yank focus away from a hidden textarea.
//   2. CodeMirror (used in the db-console SQL editor) installs its own
//      "copy" listener that rewrites clipboardData with its own selection.
//
// To beat both we (a) drive selection via the Range/Selection API on a
// detached span — no focus dance required — and (b) intercept the copy
// event in the capture phase with stopImmediatePropagation so CodeMirror's
// listener never runs.
export async function copyToClipboard(text: string): Promise<boolean> {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// fall through to execCommand fallback
		}
	}

	let listenerFired = false;
	const onCopy = (event: ClipboardEvent) => {
		event.preventDefault();
		event.stopImmediatePropagation();
		event.clipboardData?.setData("text/plain", text);
		listenerFired = true;
	};
	document.addEventListener("copy", onCopy, { capture: true, once: true });

	const span = document.createElement("span");
	span.textContent = text;
	span.style.whiteSpace = "pre";
	span.style.position = "absolute";
	span.style.left = "-9999px";
	span.style.top = "0";
	document.body.appendChild(span);

	const selection = window.getSelection();
	const previousRange =
		selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

	const range = document.createRange();
	range.selectNodeContents(span);
	selection?.removeAllRanges();
	selection?.addRange(range);

	let ok = false;
	try {
		ok = document.execCommand("copy");
	} catch {
		ok = false;
	}

	document.body.removeChild(span);
	selection?.removeAllRanges();
	if (previousRange && selection) selection.addRange(previousRange);
	// `once: true` removes the listener automatically when it fires; this
	// removeEventListener is a no-op cleanup in case execCommand never
	// dispatched a copy event (e.g. permission denied).
	document.removeEventListener("copy", onCopy, { capture: true });

	return ok && listenerFired;
}
