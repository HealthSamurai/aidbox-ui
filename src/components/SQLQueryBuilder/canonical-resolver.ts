import type {
	Bundle,
	BundleEntry,
	Resource,
} from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { AidboxClientR5 } from "../../AidboxClient";

// A depends-on canonical gives no hint of what it points to, so it is looked
// up across every kind a SQL library may depend on.
export type CanonicalKind =
	| "Library"
	| "ViewDefinition"
	| "ValueSet"
	| "ConceptMap";

export type CanonicalResource = {
	resourceType: CanonicalKind;
	id: string;
	url?: string;
	version?: string;
	name?: string;
	title?: string;
	description?: string;
	[key: string]: unknown;
};

// Priority order when one url matches resources of several kinds.
const KINDS: CanonicalKind[] = [
	"Library",
	"ViewDefinition",
	"ValueSet",
	"ConceptMap",
];

// ValueSets and ConceptMaps carry whole compose / group sections; only their
// header is ever needed here.
const SUMMARY_ELEMENTS = "id,url,version,name,title,description,status";

const KIND_PARAMS: Record<CanonicalKind, string> = {
	Library: "",
	ViewDefinition: "",
	ValueSet: `&_elements=${SUMMARY_ELEMENTS}`,
	ConceptMap: `&_elements=${SUMMARY_ELEMENTS}`,
};

const RELATIVE_REF =
	/^(Library|ViewDefinition|ValueSet|ConceptMap)\/([^/?#|]+)$/;

function isCanonicalKind(value: unknown): value is CanonicalKind {
	return KINDS.includes(value as CanonicalKind);
}

function splitCanonical(canonical: string): { url: string; version?: string } {
	const idx = canonical.indexOf("|");
	if (idx < 0) return { url: canonical };
	return { url: canonical.slice(0, idx), version: canonical.slice(idx + 1) };
}

// `:` and `/` are legal in a query string, so canonical urls stay readable.
function encodeQueryValue(value: string): string {
	return encodeURIComponent(value).replace(/%3A/gi, ":").replace(/%2F/gi, "/");
}

/** A canonical to resolve, and the kinds it is allowed to resolve to. */
type Lookup = { canonical: string; kinds: readonly CanonicalKind[] };

// Room for several versions of one url.
const VERSIONS_PER_URL = 20;

function buildRequests(lookups: Lookup[]): BundleEntry[] {
	const reads = new Set<string>();
	const kindsByUrl = new Map<string, Set<CanonicalKind>>();
	for (const { canonical, kinds } of lookups) {
		const relative = canonical.match(RELATIVE_REF);
		if (relative) {
			if (kinds.includes(relative[1] as CanonicalKind)) reads.add(canonical);
			continue;
		}
		const { url } = splitCanonical(canonical);
		const urlKinds = kindsByUrl.get(url) ?? new Set();
		for (const kind of kinds) urlKinds.add(kind);
		kindsByUrl.set(url, urlKinds);
	}
	const entries: BundleEntry[] = [...reads].map((ref) => ({
		request: { method: "GET", url: ref },
	}));
	// One search per url and kind: Aidbox does not OR comma-separated values
	// of `url` (`url=a,b` matches nothing), so urls cannot share a search.
	for (const [url, urlKinds] of kindsByUrl) {
		const urlParam = encodeQueryValue(url);
		for (const kind of KINDS) {
			if (!urlKinds.has(kind)) continue;
			entries.push({
				request: {
					method: "GET",
					url: `${kind}?url=${urlParam}&_count=${VERSIONS_PER_URL}${KIND_PARAMS[kind]}`,
				},
			});
		}
	}
	return entries;
}

function collectResources(entries: BundleEntry[]): CanonicalResource[] {
	const out: CanonicalResource[] = [];
	const push = (r: unknown) => {
		const res = r as CanonicalResource | undefined;
		if (res && isCanonicalKind(res.resourceType)) out.push(res);
	};
	for (const entry of entries) {
		const resource = entry.resource as
			| { resourceType?: string; entry?: Array<{ resource?: unknown }> }
			| undefined;
		if (resource?.resourceType === "Bundle") {
			for (const inner of resource.entry ?? []) push(inner.resource);
		} else {
			push(resource);
		}
	}
	return out;
}

function pickMatch(
	{ canonical, kinds }: Lookup,
	found: CanonicalResource[],
): CanonicalResource | null {
	const relative = canonical.match(RELATIVE_REF);
	if (relative) {
		return (
			found.find(
				(r) =>
					r.resourceType === relative[1] &&
					r.id === relative[2] &&
					kinds.includes(r.resourceType),
			) ?? null
		);
	}
	const { url, version } = splitCanonical(canonical);
	const firstByKind = (pred: (r: CanonicalResource) => boolean) => {
		for (const kind of KINDS) {
			if (!kinds.includes(kind)) continue;
			const match = found.find((r) => r.resourceType === kind && pred(r));
			if (match) return match;
		}
		return null;
	};
	// The pinned version when it exists, otherwise whatever the url holds:
	// depends-on often pins a version the stored resource does not declare.
	const exact =
		version === undefined
			? null
			: firstByKind((r) => r.url === url && r.version === version);
	return exact ?? firstByKind((r) => r.url === url);
}

/** One FHIR batch; null when the server rejects it or answers unexpectedly. */
async function sendBatch(
	client: AidboxClientR5,
	entry: BundleEntry[],
): Promise<BundleEntry[] | null> {
	// Use client.request instead of client.batch to avoid the _format query
	// parameter that client.batch appends — the server propagates it into each
	// sub-request where it is rejected as an unsupported search parameter.
	const result = await client
		.request<Bundle>({
			method: "POST",
			url: "/fhir",
			body: JSON.stringify({
				resourceType: "Bundle",
				type: "batch",
				entry,
			}),
			headers: { "Content-Type": "application/json" },
		})
		.catch((error: unknown) => {
			console.warn("[canonical-resolver] batch request failed", error);
			return null;
		});
	if (!result) return null;
	if (result.isErr()) {
		console.warn("[canonical-resolver] batch rejected", result.value.resource);
		return null;
	}
	const entries = result.value.resource.entry ?? [];
	if (entries.length !== entry.length) {
		console.warn(
			"[canonical-resolver] unexpected batch response",
			result.value.resource,
		);
		return null;
	}
	return entries;
}

// A batch answers 200 even when single entries fail: each one carries its own
// status, and an OperationOutcome in place of the result.
function entryOk(e: BundleEntry | undefined): boolean {
	if (!e?.resource) return false;
	if (e.resource.resourceType === "OperationOutcome") return false;
	const status = e.response?.status;
	return status === undefined || status.startsWith("2");
}

/** The same searches as separate requests, when the batch is not usable. */
function sendSeparately(
	client: AidboxClientR5,
	entry: BundleEntry[],
): Promise<BundleEntry[]> {
	return Promise.all(
		entry.map(async (e) => {
			const result = await client
				.request<Resource>({ method: "GET", url: `/fhir/${e.request?.url}` })
				.catch(() => null);
			return result?.isOk() ? { resource: result.value.resource } : {};
		}),
	);
}

/** Every resource any of `lookups` may resolve to, in one FHIR batch request. */
async function fetchCandidates(
	client: AidboxClientR5,
	lookups: Lookup[],
): Promise<CanonicalResource[]> {
	const entry = buildRequests(lookups);
	if (entry.length === 0) return [];
	const batched = await sendBatch(client, entry);
	const failedIdx = entry.flatMap((_, i) => (entryOk(batched?.[i]) ? [] : [i]));
	if (batched && failedIdx.length > 0) {
		console.warn(
			"[canonical-resolver] batch entries failed, retrying separately",
			failedIdx.map((i) => ({
				request: entry[i]?.request?.url,
				response: batched[i],
			})),
		);
	}
	const retried = await sendSeparately(
		client,
		failedIdx.flatMap((i) => entry[i] ?? []),
	);
	const entries = [...(batched ?? []).filter((e) => entryOk(e)), ...retried];
	return collectResources(entries);
}

// Lookups issued within this window — the depends-on pickers, the SQL editor
// schemas and the lineage graph all mount together — share one request.
const BATCH_WINDOW_MS = 10;

type Waiter = Lookup & { done: (r: CanonicalResource | null) => void };

const pending = new WeakMap<AidboxClientR5, Waiter[]>();

async function flush(client: AidboxClientR5, waiters: Waiter[]) {
	const found = await fetchCandidates(client, waiters).catch(
		(): CanonicalResource[] => [],
	);
	for (const w of waiters) w.done(pickMatch(w, found));
}

/** The pending batch of `client`, opening a new one when none is open. */
function batchFor(client: AidboxClientR5): Waiter[] {
	const open = pending.get(client);
	if (open) return open;
	const batch: Waiter[] = [];
	pending.set(client, batch);
	setTimeout(() => {
		pending.delete(client);
		void flush(client, batch);
	}, BATCH_WINDOW_MS);
	return batch;
}

/**
 * The resource `canonical` points to, looked up among `kinds` only — by
 * default a Library, ViewDefinition, ValueSet or ConceptMap.
 */
export function resolveCanonical(
	client: AidboxClientR5,
	canonical: string,
	kinds: readonly CanonicalKind[] = KINDS,
): Promise<CanonicalResource | null> {
	const batch = batchFor(client);
	return new Promise((done) => batch.push({ canonical, kinds, done }));
}

export async function resolveCanonicals(
	client: AidboxClientR5,
	canonicals: string[],
	kinds: readonly CanonicalKind[] = KINDS,
): Promise<Map<string, CanonicalResource>> {
	const unique = [...new Set(canonicals)];
	const resolved = await Promise.all(
		unique.map((c) => resolveCanonical(client, c, kinds)),
	);
	const out = new Map<string, CanonicalResource>();
	unique.forEach((c, i) => {
		const r = resolved[i];
		if (r) out.set(c, r);
	});
	return out;
}
