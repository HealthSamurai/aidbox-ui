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
	const day = Math.floor(hr / 24);
	if (day < 30) return `${day}d ago`;
	return new Date(t).toISOString().slice(0, 10);
}
