const paramStorageKey = (id: string) => `sqlquery-builder:param-values:${id}`;

export function readStoredParamValues(id: string): Record<string, string> {
	try {
		const raw = window.localStorage.getItem(paramStorageKey(id));
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === "object") {
			return parsed as Record<string, string>;
		}
	} catch {
		// ignore
	}
	return {};
}

export function persistParamValues(id: string, values: Record<string, string>) {
	try {
		window.localStorage.setItem(paramStorageKey(id), JSON.stringify(values));
	} catch {
		// ignore
	}
}
