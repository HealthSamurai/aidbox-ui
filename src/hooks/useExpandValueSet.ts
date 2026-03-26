import { useCallback, useRef } from "react";
import { type AidboxClientR5, useAidboxClient } from "../AidboxClient";

interface ValueSetExpansionContains {
	code: string;
	display?: string;
	system?: string;
}

interface ValueSetExpansion {
	expansion?: {
		contains?: ValueSetExpansionContains[];
	};
}

type CacheEntry = {
	codes: ValueSetExpansionContains[];
	isComplete: boolean; // true if returned less than count (all codes fetched)
};

const COUNT = 20;

export function useExpandValueSet() {
	const client = useAidboxClient();
	const clientRef = useRef<AidboxClientR5>(client);
	clientRef.current = client;

	// Cache: vsUrl → initial expand result (no filter)
	const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
	const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const pendingRef = useRef<
		| {
				resolve: (v: ValueSetExpansionContains[]) => void;
				url: string;
				filter: string;
		  }
		| undefined
	>(undefined);

	const doExpand = useCallback(
		async (
			url: string,
			filter: string,
		): Promise<ValueSetExpansionContains[]> => {
			const pipeIdx = url.indexOf("|");
			const params: [string, string][] =
				pipeIdx !== -1
					? [
							["url", url.slice(0, pipeIdx)],
							["valueSetVersion", url.slice(pipeIdx + 1)],
						]
					: [["url", url]];
			if (filter) params.push(["filter", filter]);
			params.push(["count", String(COUNT)]);

			const result = await clientRef.current.request<ValueSetExpansion>({
				method: "GET",
				url: "/fhir/ValueSet/$expand",
				params,
			});
			if (result.isErr()) return [];
			return result.value.resource.expansion?.contains ?? [];
		},
		[],
	);

	return useCallback(
		(
			url: string,
			filter: string,
		): Promise<{ code: string; display?: string; system?: string }[]> => {
			const cache = cacheRef.current;
			const cached = cache.get(url);

			// Initial load (no filter) — fetch and cache
			if (!filter) {
				if (cached) return Promise.resolve(cached.codes);
				return doExpand(url, "").then((codes) => {
					cache.set(url, { codes, isComplete: codes.length < COUNT });
					return codes;
				});
			}

			// With filter — try client-side filtering first
			if (cached) {
				const lf = filter.toLowerCase();
				const clientFiltered = cached.codes.filter(
					(c) =>
						c.code.toLowerCase().includes(lf) ||
						(c.display?.toLowerCase().includes(lf) ?? false),
				);
				// If initial result had all codes, client-side filter is sufficient
				if (cached.isComplete) return Promise.resolve(clientFiltered);
				// If client-side found results, use them
				if (clientFiltered.length > 0) return Promise.resolve(clientFiltered);
			}

			// Server-side filter with debounce
			return new Promise((resolve) => {
				pendingRef.current = { resolve, url, filter };
				if (debounceRef.current) clearTimeout(debounceRef.current);
				debounceRef.current = setTimeout(() => {
					const pending = pendingRef.current;
					if (!pending) return;
					pendingRef.current = undefined;
					doExpand(pending.url, pending.filter)
						.then(pending.resolve)
						.catch(() => pending.resolve([]));
				}, 300);
			});
		},
		[doExpand],
	);
}
