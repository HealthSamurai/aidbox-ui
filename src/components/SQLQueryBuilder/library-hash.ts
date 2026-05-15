import type { SQLLibrary } from "./types";

function cleanEmptyValues<T>(obj: T): T {
	if (Array.isArray(obj)) {
		const cleanedArray = obj
			.map((item) => cleanEmptyValues(item))
			.filter((item) => {
				if (item === null || item === undefined) return false;
				if (typeof item === "string" && item === "") return false;
				if (Array.isArray(item) && item.length === 0) return false;
				if (
					typeof item === "object" &&
					!Array.isArray(item) &&
					Object.keys(item as Record<string, unknown>).length === 0
				)
					return false;
				return true;
			});
		return cleanedArray as T;
	}
	if (obj !== null && typeof obj === "object") {
		const cleanedObj: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			const cleanedValue = cleanEmptyValues(value);
			if (cleanedValue === null || cleanedValue === undefined) continue;
			if (typeof cleanedValue === "string" && cleanedValue === "") continue;
			if (Array.isArray(cleanedValue) && cleanedValue.length === 0) continue;
			if (
				typeof cleanedValue === "object" &&
				!Array.isArray(cleanedValue) &&
				Object.keys(cleanedValue as Record<string, unknown>).length === 0
			)
				continue;
			cleanedObj[key] = cleanedValue;
		}
		return cleanedObj as T;
	}
	return obj;
}

export function computeLibraryHash(lib: SQLLibrary): string {
	return JSON.stringify(cleanEmptyValues(lib));
}
