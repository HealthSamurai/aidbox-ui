import type {
	ExpandedCode,
	ExpandValueSet,
	ValueSetExpansion,
} from "@health-samurai/react-components";
import { useCallback, useRef } from "react";
import { type AidboxClientR5, useAidboxClient } from "../AidboxClient";

interface ValueSetExpansionResource {
	expansion?: {
		total?: number;
		contains?: ExpandedCode[];
	};
}

const COUNT = 20;

const NO_CODES: ValueSetExpansion = { codes: [], complete: false };

export function useExpandValueSet(): ExpandValueSet {
	const client = useAidboxClient();
	const clientRef = useRef<AidboxClientR5>(client);
	clientRef.current = client;

	// Cache: vsUrl → initial expand result (no filter)
	const cacheRef = useRef<Map<string, ValueSetExpansion>>(new Map());
	const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const pendingRef = useRef<
		| {
				resolve: (v: ValueSetExpansion) => void;
				url: string;
				filter: string;
		  }
		| undefined
	>(undefined);

	// null when the request fails, so that a failure is not cached
	const doExpand = useCallback(
		async (url: string, filter: string): Promise<ValueSetExpansion | null> => {
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

			const result = await clientRef.current.request<ValueSetExpansionResource>(
				{
					method: "GET",
					url: "/fhir/ValueSet/$expand",
					params,
				},
			);
			if (result.isErr()) return null;
			const expansion = result.value.resource.expansion;
			const codes = expansion?.contains ?? [];
			// The server reports how many codes match; without the total a page
			// shorter than requested is the whole list
			const complete =
				expansion?.total !== undefined
					? codes.length >= expansion.total
					: codes.length < COUNT;
			return { codes, complete };
		},
		[],
	);

	return useCallback(
		(url: string, filter: string): Promise<ValueSetExpansion> => {
			const cache = cacheRef.current;
			const cached = cache.get(url);

			// Initial load (no filter) — fetch and cache
			if (!filter) {
				if (cached) return Promise.resolve(cached);
				return doExpand(url, "").then((expansion) => {
					if (!expansion) return NO_CODES;
					cache.set(url, expansion);
					return expansion;
				});
			}

			// With filter — try client-side filtering first
			if (cached) {
				const lf = filter.toLowerCase();
				const codes = cached.codes.filter(
					(c) =>
						c.code.toLowerCase().includes(lf) ||
						(c.display?.toLowerCase().includes(lf) ?? false),
				);
				// If initial result had all codes, client-side filter is sufficient
				if (cached.complete) return Promise.resolve({ codes, complete: true });
				// If client-side found results, use them
				if (codes.length > 0)
					return Promise.resolve({ codes, complete: false });
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
						.then((expansion) => pending.resolve(expansion ?? NO_CODES))
						.catch(() => pending.resolve(NO_CODES));
				}, 300);
			});
		},
		[doExpand],
	);
}
