const MAX_ENTRIES = 20;

export function readUrlHistory(key: string): string[] {
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) {
			return parsed.filter((x): x is string => typeof x === "string");
		}
	} catch {
		// ignore
	}
	return [];
}

export function addUrlToHistory(
	key: string,
	url: string | undefined | null,
): void {
	if (!url) return;
	try {
		const current = readUrlHistory(key);
		const next = [url, ...current.filter((u) => u !== url)].slice(
			0,
			MAX_ENTRIES,
		);
		window.localStorage.setItem(key, JSON.stringify(next));
	} catch {
		// ignore
	}
}
