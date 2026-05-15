/**
 * Display helpers for search-parameter usage stats. Used by the SP table in
 * Resource Browser and the Stats tab in the SP Builder.
 */

export function formatCount(n: number): string {
	return n.toLocaleString();
}

export function formatMs(ms: number | null | undefined): string {
	if (ms == null) return "—";
	if (ms < 1) return ms.toFixed(2);
	if (ms < 100) return ms.toFixed(1);
	return Math.round(ms).toString();
}

export function formatBytes(n: number | null | undefined): string {
	if (n == null) return "—";
	if (n < 1024) return `${n} B`;
	const units = ["KB", "MB", "GB", "TB"];
	let v = n / 1024;
	let u = 0;
	while (v >= 1024 && u < units.length - 1) {
		v /= 1024;
		u++;
	}
	return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[u]}`;
}

function pad2(n: number): string {
	return n < 10 ? `0${n}` : String(n);
}

export function formatRelativeTime(iso: string | null | undefined): string {
	if (!iso) return "—";
	const t = Date.parse(iso);
	if (Number.isNaN(t)) return "—";
	const diff = Date.now() - t;
	const sec = Math.floor(diff / 1000);
	if (sec < 5) return "just now";
	if (sec < 60) return `${sec}s ago`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hr = Math.floor(min / 60);
	if (hr < 24) return `${hr}h ago`;
	// ≥ 24h: switch to an absolute timestamp in local time. "5h ago" was
	// useful while the event was in living memory; once you cross a day the
	// reader needs a concrete date.
	const d = new Date(t);
	return (
		`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
		`${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
	);
}
