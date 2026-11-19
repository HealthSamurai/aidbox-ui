// Shapes and pure helpers for the notebook "measure" cell: the parts of
// Measure / MeasureReport the cell reads, population bookkeeping and the
// period → instant conversion `$evaluate-measure` itself applies.

export const POPULATION_SYSTEM =
	"http://terminology.hl7.org/CodeSystem/measure-population";
const ALTERNATIVE_EXPRESSION_URL =
	"http://hl7.org/fhir/StructureDefinition/cqf-alternativeExpression";
const CQFM_SCORING_URL =
	"http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/cqfm-scoring";
const CQFM_IMPROVEMENT_URL =
	"http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/cqfm-improvementNotation";
const CQFM_TYPE_URL =
	"http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/cqfm-type";

type Coding = { system?: string; code?: string; display?: string };
type CodeableConcept = { coding?: Coding[]; text?: string };
type Extension = {
	url?: string;
	valueCodeableConcept?: CodeableConcept;
	valueCode?: string;
	valueExpression?: Expression;
};
type Expression = {
	language?: string;
	expression?: string;
	reference?: string;
};

type MeasurePopulation = {
	id?: string;
	code?: CodeableConcept;
	description?: string;
	criteria?: Expression & { extension?: Extension[] };
};

type MeasureStratifier = {
	id?: string;
	code?: CodeableConcept;
	description?: string;
	criteria?: Expression & { extension?: Extension[] };
};

type MeasureGroup = {
	id?: string;
	description?: string;
	code?: CodeableConcept;
	extension?: Extension[];
	population?: MeasurePopulation[];
	stratifier?: MeasureStratifier[];
};

export type Measure = {
	resourceType?: "Measure";
	id?: string;
	url?: string;
	version?: string;
	name?: string;
	title?: string;
	description?: string;
	publisher?: string;
	scoring?: CodeableConcept;
	improvementNotation?: CodeableConcept;
	effectivePeriod?: { start?: string; end?: string };
	extension?: Extension[];
	group?: MeasureGroup[];
};

type ReportPopulation = {
	id?: string;
	code?: CodeableConcept;
	count?: number;
};

type ReportStratum = {
	value?: CodeableConcept;
	component?: { code?: CodeableConcept; value?: CodeableConcept }[];
	population?: ReportPopulation[];
	measureScore?: { value?: number };
};

export type ReportStratifier = {
	id?: string;
	code?: CodeableConcept[];
	stratum?: ReportStratum[];
};

export type ReportGroup = {
	id?: string;
	code?: CodeableConcept;
	population?: ReportPopulation[];
	measureScore?: { value?: number; unit?: string };
	stratifier?: ReportStratifier[];
};

export type MeasureReport = {
	resourceType: "MeasureReport";
	id?: string;
	status?: string;
	type?: "individual" | "summary" | "subject-list" | "data-exchange" | string;
	measure?: string;
	subject?: { reference?: string; display?: string };
	date?: string;
	period?: { start?: string; end?: string };
	improvementNotation?: CodeableConcept;
	group?: ReportGroup[];
};

export type OperationOutcome = {
	resourceType: "OperationOutcome";
	issue: {
		severity: "fatal" | "error" | "warning" | "information";
		code: string;
		diagnostics?: string;
		expression?: string[];
	}[];
};

export function isMeasureReport(v: unknown): v is MeasureReport {
	return (
		!!v &&
		typeof v === "object" &&
		(v as { resourceType?: unknown }).resourceType === "MeasureReport"
	);
}

export function isOperationOutcome(v: unknown): v is OperationOutcome {
	return (
		!!v &&
		typeof v === "object" &&
		(v as { resourceType?: unknown }).resourceType === "OperationOutcome" &&
		Array.isArray((v as { issue?: unknown }).issue)
	);
}

// ---------------------------------------------------------------- canonical

export type MeasureRef =
	| { kind: "canonical"; url: string; version?: string }
	| { kind: "id"; id: string };

export function parseMeasureRef(ref: string): MeasureRef | null {
	const trimmed = ref.trim();
	if (!trimmed) return null;
	const local = trimmed.match(/^Measure\/([A-Za-z0-9\-.]{1,64})$/);
	if (local?.[1]) return { kind: "id", id: local[1] };
	const bar = trimmed.lastIndexOf("|");
	if (bar > 0) {
		return {
			kind: "canonical",
			url: trimmed.slice(0, bar),
			version: trimmed.slice(bar + 1) || undefined,
		};
	}
	return { kind: "canonical", url: trimmed };
}

export function measureCanonical(m: Measure): string {
	if (!m.url) return `Measure/${m.id ?? ""}`;
	return m.version ? `${m.url}|${m.version}` : m.url;
}

// Measure narrative fields are markdown exported with HTML-escaped text
// ("&gt; 9.0%"); show them as plain text.
const ENTITIES: Record<string, string> = {
	"&gt;": ">",
	"&lt;": "<",
	"&amp;": "&",
	"&quot;": '"',
	"&#39;": "'",
	"&apos;": "'",
	"&nbsp;": " ",
};

export function plainText(s: string | undefined): string | undefined {
	return s?.replace(
		/&(?:gt|lt|amp|quot|#39|apos|nbsp);/g,
		(m) => ENTITIES[m] ?? m,
	);
}

export function measureLabel(m: Measure | null | undefined): string | null {
	if (!m) return null;
	const title = m.title?.trim();
	return title || m.name || m.id || null;
}

// --------------------------------------------------------------- populations

export type PopulationCode =
	| "initial-population"
	| "denominator"
	| "denominator-exclusion"
	| "denominator-exception"
	| "numerator"
	| "numerator-exclusion"
	| "measure-population"
	| "measure-population-exclusion"
	| "measure-observation";

const POPULATION_LABELS: Record<string, string> = {
	"initial-population": "Initial Population",
	denominator: "Denominator",
	"denominator-exclusion": "Denominator Exclusion",
	"denominator-exception": "Denominator Exception",
	numerator: "Numerator",
	"numerator-exclusion": "Numerator Exclusion",
	"measure-population": "Measure Population",
	"measure-population-exclusion": "Measure Population Exclusion",
	"measure-observation": "Measure Observation",
};

export function populationCode(p: { code?: CodeableConcept }): string {
	const coding =
		p.code?.coding?.find((c) => c.system === POPULATION_SYSTEM) ??
		p.code?.coding?.[0];
	return coding?.code ?? p.code?.text ?? "";
}

export function populationLabel(code: string, display?: string): string {
	return display ?? POPULATION_LABELS[code] ?? code;
}

// Bar / dot colour per population: inclusion steps in blue, exclusions grey,
// exceptions yellow, the numerator green.
export function populationTone(code: string): Tone {
	if (code === "numerator") return "met";
	if (code === "denominator-exception") return "exception";
	if (code.endsWith("-exclusion")) return "excluded";
	if (code === "initial-population") return "primary";
	return "secondary";
}

export type Tone =
	| "met"
	| "notMet"
	| "excluded"
	| "exception"
	| "primary"
	| "secondary";

export const TONE_BG: Record<Tone, string> = {
	met: "bg-bg-success-primary_inverse",
	notMet: "bg-bg-error-primary_inverse",
	excluded: "bg-fg-tertiary",
	exception: "bg-bg-warning-primary_inverse",
	primary: "bg-bg-link",
	secondary: "bg-bg-info-primary_inverse",
};

export const TONE_TEXT: Record<Tone, string> = {
	met: "text-text-success-primary",
	notMet: "text-text-error-primary",
	excluded: "text-text-secondary",
	exception: "text-text-warning-primary",
	primary: "text-text-link",
	secondary: "text-text-info-primary",
};

export type GroupCounts = Partial<Record<string, number>>;

export function groupCounts(group: ReportGroup): GroupCounts {
	const out: GroupCounts = {};
	for (const p of group.population ?? []) {
		const code = populationCode(p);
		if (code) out[code] = (out[code] ?? 0) + (p.count ?? 0);
	}
	return out;
}

export type BreakdownSegment = {
	key: "met" | "numeratorExcluded" | "notMet" | "exception" | "excluded";
	label: string;
	count: number;
	tone: Tone;
};

// Splits a proportion group's Denominator into disjoint outcomes. The counts
// follow `$evaluate-measure`'s membership rules: numerator and exception are
// already net of the denominator exclusions.
export function proportionBreakdown(counts: GroupCounts): {
	denominator: number;
	eligible: number;
	met: number;
	segments: BreakdownSegment[];
} | null {
	const denominator = counts.denominator;
	if (denominator === undefined || counts.numerator === undefined) return null;
	const excluded = counts["denominator-exclusion"] ?? 0;
	const exception = counts["denominator-exception"] ?? 0;
	const numerator = counts.numerator ?? 0;
	const numeratorExcluded = counts["numerator-exclusion"] ?? 0;
	const met = Math.max(0, numerator - numeratorExcluded);
	const notMet = Math.max(0, denominator - excluded - exception - numerator);
	const segments: BreakdownSegment[] = [
		{ key: "met", label: "Met", count: met, tone: "met" },
		{
			key: "numeratorExcluded",
			label: "Numerator excluded",
			count: numeratorExcluded,
			tone: "excluded",
		},
		{ key: "notMet", label: "Not met", count: notMet, tone: "notMet" },
		{
			key: "exception",
			label: "Exception",
			count: exception,
			tone: "exception",
		},
		{ key: "excluded", label: "Excluded", count: excluded, tone: "excluded" },
	];
	return {
		denominator,
		eligible: Math.max(0, denominator - excluded - exception),
		met,
		segments: segments.filter(
			(s) => s.count > 0 || s.key === "met" || s.key === "notMet",
		),
	};
}

// ------------------------------------------------------------------- outcome

export type Outcome = {
	key:
		| "met"
		| "notMet"
		| "excluded"
		| "exception"
		| "numeratorExcluded"
		| "notInDenominator"
		| "notInPopulation"
		| "inPopulation";
	label: string;
	tone: Tone;
};

const OUTCOMES: Record<Outcome["key"], Outcome> = {
	met: { key: "met", label: "Met", tone: "met" },
	notMet: { key: "notMet", label: "Not met", tone: "notMet" },
	excluded: { key: "excluded", label: "Excluded", tone: "excluded" },
	exception: { key: "exception", label: "Exception", tone: "exception" },
	numeratorExcluded: {
		key: "numeratorExcluded",
		label: "Numerator excluded",
		tone: "excluded",
	},
	notInDenominator: {
		key: "notInDenominator",
		label: "Not in denominator",
		tone: "excluded",
	},
	notInPopulation: {
		key: "notInPopulation",
		label: "Not in initial population",
		tone: "excluded",
	},
	inPopulation: {
		key: "inPopulation",
		label: "In population",
		tone: "primary",
	},
};

// Where one subject lands, given which populations it belongs to. Used for an
// individual report (membership = count > 0) and for a SQLQuery row.
export function subjectOutcome(
	member: (code: string) => boolean | undefined,
	scoring: string | undefined,
): Outcome {
	if (member("initial-population") === false) return OUTCOMES.notInPopulation;
	if (scoring !== "proportion" && member("numerator") === undefined)
		return OUTCOMES.inPopulation;
	if (member("denominator") === false) return OUTCOMES.notInDenominator;
	if (member("denominator-exclusion")) return OUTCOMES.excluded;
	if (member("numerator")) {
		return member("numerator-exclusion")
			? OUTCOMES.numeratorExcluded
			: OUTCOMES.met;
	}
	if (member("denominator-exception")) return OUTCOMES.exception;
	return OUTCOMES.notMet;
}

export function outcomeByKey(key: Outcome["key"]): Outcome {
	return OUTCOMES[key];
}

// ------------------------------------------------------------ measure groups

function extCode(exts: Extension[] | undefined, url: string): string | null {
	const ext = exts?.find((e) => e.url === url);
	return ext?.valueCodeableConcept?.coding?.[0]?.code ?? ext?.valueCode ?? null;
}

export function groupScoring(
	measure: Measure | null | undefined,
	groupIdx: number,
): string | undefined {
	const group = measure?.group?.[groupIdx];
	return (
		extCode(group?.extension, CQFM_SCORING_URL) ??
		measure?.scoring?.coding?.[0]?.code ??
		extCode(measure?.extension, CQFM_SCORING_URL) ??
		undefined
	);
}

export function groupImprovement(
	measure: Measure | null | undefined,
	groupIdx: number,
	report?: MeasureReport,
): "increase" | "decrease" | undefined {
	const code =
		report?.improvementNotation?.coding?.[0]?.code ??
		extCode(measure?.group?.[groupIdx]?.extension, CQFM_IMPROVEMENT_URL) ??
		measure?.improvementNotation?.coding?.[0]?.code ??
		extCode(measure?.extension, CQFM_IMPROVEMENT_URL);
	return code === "increase" || code === "decrease" ? code : undefined;
}

export function groupMeasureType(
	measure: Measure | null | undefined,
	groupIdx: number,
): string | undefined {
	return (
		extCode(measure?.group?.[groupIdx]?.extension, CQFM_TYPE_URL) ?? undefined
	);
}

// The Measure group a report group answers: by id, else by position.
export function findMeasureGroup(
	measure: Measure | null | undefined,
	group: ReportGroup,
	idx: number,
): { group: MeasureGroup; idx: number } | null {
	const groups = measure?.group ?? [];
	const byId = group.id ? groups.findIndex((g) => g.id === group.id) : -1;
	const at = byId >= 0 ? byId : idx;
	const found = groups[at];
	return found ? { group: found, idx: at } : null;
}

export function populationDescription(
	measureGroup: MeasureGroup | undefined,
	population: { id?: string; code?: CodeableConcept },
): string | undefined {
	const code = populationCode(population);
	const match =
		measureGroup?.population?.find(
			(p) => population.id && p.id === population.id,
		) ?? measureGroup?.population?.find((p) => populationCode(p) === code);
	return plainText(match?.description);
}

// ---------------------------------------------------------- SQL alternative

export type SqlBinding = {
	library: string;
	populations: { code: string; column: string; label: string }[];
	stratifiers: { id: string; column: string; label: string }[];
};

function sqlExpression(
	criteria: (Expression & { extension?: Extension[] }) | undefined,
): Expression | null {
	const ext = criteria?.extension?.find(
		(e) => e.url === ALTERNATIVE_EXPRESSION_URL,
	);
	const expr = ext?.valueExpression;
	if (!expr?.expression || !expr.reference) return null;
	if (expr.language && expr.language !== "application/sql") return null;
	return expr;
}

// The SQLQuery Library a Measure group is computed by (linked through
// cqf-alternativeExpression on every population), with its columns.
export function groupSqlBinding(
	measureGroup: MeasureGroup | undefined,
): SqlBinding | null {
	if (!measureGroup) return null;
	let library: string | null = null;
	const populations: SqlBinding["populations"] = [];
	for (const p of measureGroup.population ?? []) {
		const expr = sqlExpression(p.criteria);
		if (!expr?.reference || !expr.expression) continue;
		library ??= expr.reference;
		if (expr.reference !== library) continue;
		const code = populationCode(p);
		populations.push({
			code,
			column: expr.expression,
			label: populationLabel(code, p.code?.coding?.[0]?.display),
		});
	}
	if (!library || populations.length === 0) return null;
	const stratifiers: SqlBinding["stratifiers"] = [];
	for (const [i, s] of (measureGroup.stratifier ?? []).entries()) {
		const expr = sqlExpression(s.criteria);
		if (!expr?.expression || expr.reference !== library) continue;
		stratifiers.push({
			id: s.id ?? `stratifier-${i + 1}`,
			column: expr.expression,
			label:
				s.code?.text ??
				s.criteria?.expression ??
				s.description ??
				s.id ??
				`Stratifier ${i + 1}`,
		});
	}
	return { library, populations, stratifiers };
}

// ----------------------------------------------------------------- period

const PARTIAL_DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

// `$evaluate-measure` reads periodStart / periodEnd as YYYY, YYYY-MM or
// YYYY-MM-DD and queries [first instant of start, first instant after end).
export function periodToInstants(
	start: string | undefined,
	end: string | undefined,
): { start: string; end: string } | null {
	const s = start?.trim().match(PARTIAL_DATE);
	const e = end?.trim().match(PARTIAL_DATE);
	if (!s || !e) return null;
	const startMs = Date.UTC(
		Number(s[1]),
		s[2] ? Number(s[2]) - 1 : 0,
		s[3] ? Number(s[3]) : 1,
	);
	const endMs = e[3]
		? Date.UTC(Number(e[1]), Number(e[2]) - 1, Number(e[3]) + 1)
		: e[2]
			? Date.UTC(Number(e[1]), Number(e[2]), 1)
			: Date.UTC(Number(e[1]) + 1, 0, 1);
	return {
		start: new Date(startMs).toISOString(),
		end: new Date(endMs).toISOString(),
	};
}

export function isPartialDate(v: string): boolean {
	return PARTIAL_DATE.test(v.trim());
}

export function formatPeriod(period: MeasureReport["period"]): string {
	if (!period?.start && !period?.end) return "";
	return `${period?.start ?? "…"} – ${period?.end ?? "…"}`;
}

export function formatScore(value: number | undefined, scoring?: string) {
	if (value === undefined || !Number.isFinite(value)) return "—";
	const asShare =
		scoring === "proportion" ||
		scoring === "ratio" ||
		(scoring === undefined && value >= 0 && value <= 1);
	if (asShare) {
		const pct = value * 100;
		const digits = pct !== 0 && Math.abs(pct) < 10 ? 1 : 0;
		return `${pct.toFixed(digits)}%`;
	}
	return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
