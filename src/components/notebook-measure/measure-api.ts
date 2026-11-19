import { useQuery } from "@tanstack/react-query";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import {
	isMeasureReport,
	isOperationOutcome,
	type Measure,
	type MeasureReport,
	type OperationOutcome,
	parseMeasureRef,
	periodToInstants,
} from "./measure-types";

type RawResult = { status: number; text: string };

// rawRequest throws on a non-2xx status; the response is still on the error.
async function send(
	client: AidboxClientR5,
	params: Parameters<AidboxClientR5["rawRequest"]>[0],
): Promise<RawResult> {
	try {
		const r = await client.rawRequest(params);
		return { status: r.response.status, text: await r.response.text() };
	} catch (e) {
		if (e && typeof e === "object" && "responseWithMeta" in e) {
			const r = (e as { responseWithMeta: { response: Response } })
				.responseWithMeta.response;
			return { status: r.status, text: await r.text() };
		}
		throw e;
	}
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

// ------------------------------------------------------------- evaluation

export type MeasureInput = {
	measure: string;
	periodStart: string;
	periodEnd: string;
	subject?: string;
};

export type EvaluateResult =
	| { ok: true; report: MeasureReport; duration: number }
	| {
			ok: false;
			error: string;
			outcome?: OperationOutcome;
			status?: number;
			duration?: number;
	  };

function evaluateParameters(input: MeasureInput, withMeasure: boolean) {
	const parameter: Record<string, unknown>[] = [];
	if (withMeasure)
		parameter.push({ name: "measure", valueString: input.measure.trim() });
	parameter.push({ name: "periodStart", valueDate: input.periodStart.trim() });
	parameter.push({ name: "periodEnd", valueDate: input.periodEnd.trim() });
	const subject = input.subject?.trim();
	if (subject) parameter.push({ name: "subject", valueString: subject });
	return { resourceType: "Parameters", parameter };
}

export async function evaluateMeasure(
	client: AidboxClientR5,
	input: MeasureInput,
): Promise<EvaluateResult> {
	const ref = parseMeasureRef(input.measure);
	if (!ref) return { ok: false, error: "Select a Measure first." };
	// A local `Measure/<id>` goes to the instance-level operation; a canonical
	// to the type level, which also resolves package-installed Measures.
	const url =
		ref.kind === "id"
			? `/fhir/Measure/${encodeURIComponent(ref.id)}/$evaluate-measure`
			: "/fhir/Measure/$evaluate-measure";
	const t0 = performance.now();
	try {
		const { status, text } = await send(client, {
			method: "POST",
			url,
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify(evaluateParameters(input, ref.kind !== "id")),
		});
		const duration = performance.now() - t0;
		const body = parseJson(text);
		if (isMeasureReport(body)) return { ok: true, report: body, duration };
		if (isOperationOutcome(body)) {
			return {
				ok: false,
				status,
				duration,
				outcome: body,
				error:
					body.issue
						.map((i) => i.diagnostics)
						.filter(Boolean)
						.join("\n") || `HTTP ${status}`,
			};
		}
		return { ok: false, status, duration, error: text || `HTTP ${status}` };
	} catch (e) {
		return {
			ok: false,
			duration: performance.now() - t0,
			error: e instanceof Error ? e.message : String(e),
		};
	}
}

// ---------------------------------------------------------------- Measure

export function useMeasure(ref: string | null | undefined) {
	const client = useAidboxClient();
	const parsed = ref ? parseMeasureRef(ref) : null;
	return useQuery<Measure | null>({
		queryKey: ["notebook-measure", ref ?? null],
		enabled: !!parsed,
		staleTime: 5 * 60_000,
		queryFn: async () => {
			if (!parsed) return null;
			if (parsed.kind === "id") {
				const { status, text } = await send(client, {
					method: "GET",
					url: `/fhir/Measure/${encodeURIComponent(parsed.id)}`,
				});
				return status < 300 ? (parseJson(text) as Measure) : null;
			}
			const params = new URLSearchParams({ url: parsed.url, _count: "1" });
			if (parsed.version) params.set("version", parsed.version);
			const { status, text } = await send(client, {
				method: "GET",
				url: `/fhir/Measure?${params.toString()}`,
			});
			if (status >= 300) return null;
			const bundle = parseJson(text) as {
				entry?: { resource?: Measure }[];
			} | null;
			return bundle?.entry?.[0]?.resource ?? null;
		},
	});
}

export type MeasureSummary = Pick<
	Measure,
	| "id"
	| "url"
	| "version"
	| "name"
	| "title"
	| "description"
	| "effectivePeriod"
>;

export function useMeasureCandidates(search: string, enabled: boolean) {
	const client = useAidboxClient();
	return useQuery<MeasureSummary[]>({
		queryKey: ["notebook-measure-candidates", search],
		enabled,
		staleTime: 60_000,
		queryFn: async () => {
			const params = new URLSearchParams({
				_count: "200",
				_sort: "name",
				_elements: "id,url,version,name,title,description,effectivePeriod",
			});
			if (search.trim()) params.set("_ilike", search.trim());
			const { status, text } = await send(client, {
				method: "GET",
				url: `/fhir/Measure?${params.toString()}`,
			});
			if (status >= 300) return [];
			const bundle = parseJson(text) as {
				entry?: { resource?: MeasureSummary }[];
			} | null;
			return (bundle?.entry ?? []).flatMap((e) =>
				e.resource ? [e.resource] : [],
			);
		},
	});
}

// ---------------------------------------------------------------- patients

export type PatientSummary = {
	id: string;
	name: string | null;
	gender?: string;
	birthDate?: string;
};

type RawPatient = {
	id?: string;
	gender?: string;
	birthDate?: string;
	name?: { text?: string; given?: string[]; family?: string; use?: string }[];
};

function patientName(p: RawPatient): string | null {
	const n = p.name?.find((x) => x.use === "official") ?? p.name?.[0];
	if (!n) return null;
	if (n.text) return n.text;
	const full = [...(n.given ?? []), n.family].filter(Boolean).join(" ");
	return full || null;
}

export function usePatients(ids: string[]) {
	const client = useAidboxClient();
	const key = ids.slice().sort().join(",");
	return useQuery<Map<string, PatientSummary>>({
		queryKey: ["notebook-measure-patients", key],
		enabled: ids.length > 0,
		staleTime: 5 * 60_000,
		queryFn: async () => {
			const params = new URLSearchParams({
				_id: key,
				_count: String(ids.length),
				_elements: "id,name,gender,birthDate",
			});
			const { status, text } = await send(client, {
				method: "GET",
				url: `/fhir/Patient?${params.toString()}`,
			});
			const out = new Map<string, PatientSummary>();
			if (status >= 300) return out;
			const bundle = parseJson(text) as {
				entry?: { resource?: RawPatient }[];
			} | null;
			for (const e of bundle?.entry ?? []) {
				const p = e.resource;
				if (!p?.id) continue;
				out.set(p.id, {
					id: p.id,
					name: patientName(p),
					gender: p.gender,
					birthDate: p.birthDate,
				});
			}
			return out;
		},
	});
}

// ------------------------------------------------------- SQLQuery rows

export type SqlRowsResult =
	| { ok: true; rows: Record<string, unknown>[] }
	| { ok: false; error: string };

// Runs the SQLQuery Library a Measure is linked to, for the same period
// `$evaluate-measure` would pass it — one row per subject in the population.
export function useMeasureSqlRows(
	libraryCanonical: string | null,
	period: { start?: string; end?: string } | undefined,
	enabled: boolean,
) {
	const client = useAidboxClient();
	return useQuery<SqlRowsResult>({
		queryKey: [
			"notebook-measure-sql-rows",
			libraryCanonical,
			period?.start ?? null,
			period?.end ?? null,
		],
		enabled: enabled && !!libraryCanonical,
		staleTime: 60_000,
		queryFn: async () => {
			const instants = periodToInstants(period?.start, period?.end);
			if (!libraryCanonical || !instants)
				return { ok: false, error: "The report has no usable period." };
			const ref = parseMeasureRef(libraryCanonical);
			if (ref?.kind !== "canonical")
				return {
					ok: false,
					error: `Bad Library reference ${libraryCanonical}`,
				};
			const search = new URLSearchParams({ url: ref.url, _count: "1" });
			if (ref.version) search.set("version", ref.version);
			const lib = await send(client, {
				method: "GET",
				url: `/fhir/Library?${search.toString()}&_elements=id`,
			});
			const bundle = parseJson(lib.text) as {
				entry?: { resource?: { id?: string } }[];
			} | null;
			const id = bundle?.entry?.[0]?.resource?.id;
			if (!id)
				return { ok: false, error: `Library not found: ${libraryCanonical}` };
			const run = await send(client, {
				method: "POST",
				url: `/fhir/Library/${encodeURIComponent(id)}/$sqlquery-run`,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					resourceType: "Parameters",
					parameter: [
						{ name: "_format", valueCode: "json" },
						{
							name: "parameters",
							resource: {
								resourceType: "Parameters",
								parameter: [
									{
										name: "measurement_period_start",
										valueDateTime: instants.start,
									},
									{
										name: "measurement_period_end",
										valueDateTime: instants.end,
									},
								],
							},
						},
					],
				}),
			});
			const body = parseJson(run.text);
			if (Array.isArray(body))
				return { ok: true, rows: body as Record<string, unknown>[] };
			if (isOperationOutcome(body))
				return {
					ok: false,
					error: body.issue.map((i) => i.diagnostics).join("\n"),
				};
			return { ok: false, error: run.text || `HTTP ${run.status}` };
		},
	});
}
