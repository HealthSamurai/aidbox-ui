import {
	SQL_QUERY_TYPE_SYSTEM,
	type SQLLibrary,
	sqlLibraryKindMeta,
} from "./types";

export function ensureSqlLibraryShape(lib: SQLLibrary): SQLLibrary {
	const kindMeta = sqlLibraryKindMeta(lib);
	const profiles = lib.meta?.profile ?? [];
	const hasProfile = profiles.includes(kindMeta.profile);
	const hasType = lib.type?.coding?.some(
		(c) => c.system === SQL_QUERY_TYPE_SYSTEM && c.code === kindMeta.typeCode,
	);
	return {
		...lib,
		resourceType: "Library",
		meta: hasProfile
			? lib.meta
			: { ...(lib.meta ?? {}), profile: [...profiles, kindMeta.profile] },
		type: hasType
			? lib.type
			: {
					coding: [{ system: SQL_QUERY_TYPE_SYSTEM, code: kindMeta.typeCode }],
				},
		status: lib.status ?? "active",
	};
}

function capitalizeFirstLetter(s: string): string {
	return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

function buildParamValueEntry(
	name: string,
	type: string,
	raw: string,
): Record<string, unknown> | null {
	if (raw === "" && type !== "boolean") return null;
	const valueField = `value${capitalizeFirstLetter(type)}`;
	let value: unknown = raw;
	if (type === "integer") {
		const n = Number.parseInt(raw, 10);
		if (Number.isNaN(n)) return null;
		value = n;
	} else if (type === "decimal") {
		const n = Number.parseFloat(raw);
		if (Number.isNaN(n)) return null;
		value = n;
	} else if (type === "boolean") {
		value = raw === "true";
	}
	return { name, [valueField]: value };
}

export function buildAllParamEntries(
	library: SQLLibrary,
	inheritedTypes: Map<string, string>,
	paramValues: Record<string, string>,
): Record<string, unknown>[] {
	const types = new Map<string, string>();
	for (const p of library.parameter ?? []) {
		if (p.name) types.set(p.name, p.type ?? "string");
	}
	for (const [name, type] of inheritedTypes) {
		if (!types.has(name)) types.set(name, type);
	}
	const entries: Record<string, unknown>[] = [];
	for (const [name, type] of types) {
		let raw = paramValues[name];
		if (raw === undefined) {
			if (type !== "boolean") continue;
			raw = "";
		}
		const entry = buildParamValueEntry(name, type, raw);
		if (entry) entries.push(entry);
	}
	return entries;
}

export function buildRunPayload(
	library: SQLLibrary,
	inheritedTypes: Map<string, string>,
	paramValues: Record<string, string>,
): { resourceType: "Parameters"; parameter: Record<string, unknown>[] } {
	const payload = ensureSqlLibraryShape(library);
	const valueEntries = buildAllParamEntries(
		payload,
		inheritedTypes,
		paramValues,
	);
	const topLevelParameters: Record<string, unknown>[] = [
		{ name: "_format", valueCode: "fhir" },
		{ name: "queryResource", resource: payload },
	];
	if (valueEntries.length > 0) {
		topLevelParameters.push({
			name: "parameters",
			resource: {
				resourceType: "Parameters",
				parameter: valueEntries,
			},
		});
	}
	return {
		resourceType: "Parameters",
		parameter: topLevelParameters,
	};
}
