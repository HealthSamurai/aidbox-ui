import * as HSComp from "@health-samurai/react-components";
import { Link } from "@tanstack/react-router";
import {
	CalendarRange,
	Circle,
	CircleCheck,
	TrendingDown,
	TrendingUp,
	User,
} from "lucide-react";
import type { ReactNode } from "react";
import { usePatients } from "./measure-api";
import {
	type BreakdownSegment,
	findMeasureGroup,
	formatPeriod,
	formatScore,
	type GroupCounts,
	groupCounts,
	groupImprovement,
	groupScoring,
	groupSqlBinding,
	type Measure,
	type MeasureReport,
	measureLabel,
	type Outcome,
	plainText,
	populationCode,
	populationDescription,
	populationLabel,
	populationTone,
	proportionBreakdown,
	type ReportGroup,
	type ReportStratifier,
	type SqlBinding,
	subjectOutcome,
	TONE_BG,
	TONE_TEXT,
	type Tone,
} from "./measure-types";

// For an inverse measure (improvement notation "decrease") landing in the
// numerator is the bad outcome, so the met / not-met colours swap.
export function toneFor(tone: Tone, inverse: boolean): Tone {
	if (!inverse) return tone;
	if (tone === "met") return "notMet";
	if (tone === "notMet") return "met";
	return tone;
}

const TAG_COLOR: Record<Tone, "green" | "red" | "gray" | "yellow" | "blue"> = {
	met: "green",
	notMet: "red",
	excluded: "gray",
	exception: "yellow",
	primary: "blue",
	secondary: "blue",
};

export function OutcomeTag({
	outcome,
	inverse,
	size = "small",
}: {
	outcome: Outcome;
	inverse: boolean;
	size?: "small" | "big";
}) {
	const tone = toneFor(outcome.tone, inverse);
	return (
		<HSComp.Tag
			size={size}
			vibrance="subtle"
			color={TAG_COLOR[tone]}
			icon={<span className={`size-1.5 rounded-full ${TONE_BG[tone]}`} />}
		>
			{outcome.label}
		</HSComp.Tag>
	);
}

function ImprovementHint({
	improvement,
}: {
	improvement: "increase" | "decrease" | undefined;
}) {
	if (!improvement) return null;
	const Icon = improvement === "increase" ? TrendingUp : TrendingDown;
	return (
		<span className="inline-flex items-center gap-1 typo-body-xs text-text-tertiary">
			<Icon className="size-3.5" />
			{improvement === "increase" ? "Higher is better" : "Lower is better"}
		</span>
	);
}

// ------------------------------------------------------------------ score

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ScoreRing({
	value,
	scoring,
	tone,
	caption,
}: {
	value: number | undefined;
	scoring: string | undefined;
	tone: Tone;
	caption?: ReactNode;
}) {
	const share =
		value !== undefined && Number.isFinite(value)
			? Math.min(1, Math.max(0, value))
			: 0;
	const stroke =
		tone === "notMet" ? "stroke-fg-error-primary" : "stroke-fg-success-primary";
	return (
		<div className="flex flex-col items-center gap-2 shrink-0">
			<div className="relative size-[132px]">
				<svg
					viewBox="0 0 128 128"
					className="size-full -rotate-90"
					role="img"
					aria-label={`Measure score ${formatScore(value, scoring)}`}
				>
					<circle
						cx="64"
						cy="64"
						r={RING_RADIUS}
						fill="none"
						strokeWidth="12"
						className="stroke-bg-tertiary"
					/>
					<circle
						cx="64"
						cy="64"
						r={RING_RADIUS}
						fill="none"
						strokeWidth="12"
						strokeLinecap={share > 0 ? "round" : "butt"}
						strokeDasharray={RING_CIRCUMFERENCE}
						strokeDashoffset={RING_CIRCUMFERENCE * (1 - share)}
						className={`${stroke} transition-[stroke-dashoffset] duration-700`}
					/>
				</svg>
				<div className="absolute inset-0 flex flex-col items-center justify-center">
					<span className="text-[28px] leading-8 font-semibold text-text-primary tabular-nums">
						{formatScore(value, scoring)}
					</span>
					<span className="typo-label-tiny uppercase tracking-wide text-text-tertiary">
						score
					</span>
				</div>
			</div>
			{caption}
		</div>
	);
}

// ------------------------------------------------------------- breakdown

function percentOf(count: number, total: number): string {
	if (total <= 0) return "0%";
	const pct = (count / total) * 100;
	return `${pct < 10 && pct > 0 ? pct.toFixed(1) : Math.round(pct)}%`;
}

function BreakdownBar({
	denominator,
	segments,
	inverse,
}: {
	denominator: number;
	segments: BreakdownSegment[];
	inverse: boolean;
}) {
	const visible = segments.filter((s) => s.count > 0);
	return (
		<div className="flex flex-col gap-3 min-w-0 flex-1">
			<div className="flex items-baseline justify-between gap-2">
				<span className="typo-label text-text-secondary">Denominator</span>
				<span className="typo-body text-text-secondary tabular-nums">
					{denominator.toLocaleString()} patients
				</span>
			</div>
			<div className="flex h-4 w-full overflow-hidden rounded-full bg-bg-tertiary gap-0.5">
				{visible.map((s) => (
					<HSComp.Tooltip key={s.key}>
						<HSComp.TooltipTrigger asChild>
							<div
								className={`h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-700 ${TONE_BG[toneFor(s.tone, inverse)]}`}
								style={{
									width: `${(s.count / Math.max(denominator, 1)) * 100}%`,
								}}
							/>
						</HSComp.TooltipTrigger>
						<HSComp.TooltipContent>
							{s.label}: {s.count.toLocaleString()} (
							{percentOf(s.count, denominator)})
						</HSComp.TooltipContent>
					</HSComp.Tooltip>
				))}
			</div>
			<div className="flex flex-wrap gap-x-5 gap-y-2">
				{segments.map((s) => {
					const tone = toneFor(s.tone, inverse);
					return (
						<div key={s.key} className="flex items-center gap-2 min-w-0">
							<span
								className={`size-2.5 rounded-full shrink-0 ${TONE_BG[tone]}`}
							/>
							<span className="typo-body text-text-secondary">{s.label}</span>
							<span className="typo-body font-medium text-text-primary tabular-nums">
								{s.count.toLocaleString()}
							</span>
							<span className="typo-body-xs text-text-tertiary tabular-nums">
								{percentOf(s.count, denominator)}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}

// ------------------------------------------------------------ populations

type PopulationRow = {
	key: string;
	code: string;
	label: string;
	count: number;
	description?: string;
};

function populationRows(
	group: ReportGroup,
	measureGroup: Parameters<typeof populationDescription>[0],
): PopulationRow[] {
	return (group.population ?? []).map((p, i) => {
		const code = populationCode(p);
		return {
			key: p.id ?? `${code}-${i}`,
			code,
			label: populationLabel(code, p.code?.coding?.[0]?.display),
			count: p.count ?? 0,
			description: populationDescription(measureGroup, p),
		};
	});
}

function PopulationBars({
	rows,
	inverse,
}: {
	rows: PopulationRow[];
	inverse: boolean;
}) {
	const max = Math.max(1, ...rows.map((r) => r.count));
	return (
		<div className="flex flex-col gap-4">
			{rows.map((r) => {
				const tone = toneFor(populationTone(r.code), inverse);
				return (
					<div key={r.key} className="flex flex-col gap-1.5">
						<div className="flex items-baseline justify-between gap-3">
							<span className="typo-body font-medium text-text-primary">
								{r.label}
							</span>
							<span
								className={`typo-body font-semibold tabular-nums ${TONE_TEXT[tone]}`}
							>
								{r.count.toLocaleString()}
							</span>
						</div>
						<div className="h-2 w-full rounded-full bg-bg-tertiary overflow-hidden">
							<div
								className={`h-full rounded-full transition-[width] duration-700 ${TONE_BG[tone]}`}
								style={{ width: `${(r.count / max) * 100}%` }}
							/>
						</div>
						{r.description && (
							<p
								className="typo-body-xs text-text-secondary line-clamp-2"
								title={r.description}
							>
								{r.description}
							</p>
						)}
					</div>
				);
			})}
		</div>
	);
}

function CriteriaChecklist({
	rows,
	inverse,
}: {
	rows: PopulationRow[];
	inverse: boolean;
}) {
	return (
		<ol className="flex flex-col">
			{rows.map((r, i) => {
				const member = r.count > 0;
				const tone = toneFor(populationTone(r.code), inverse);
				return (
					<li key={r.key} className="flex gap-3">
						<div className="flex flex-col items-center">
							{member ? (
								<CircleCheck className={`size-5 shrink-0 ${TONE_TEXT[tone]}`} />
							) : (
								<Circle className="size-5 shrink-0 text-text-disabled" />
							)}
							{i < rows.length - 1 && (
								<span className="w-px flex-1 bg-border-default my-1" />
							)}
						</div>
						<div className="flex flex-col gap-0.5 pb-4 min-w-0">
							<div className="flex items-center gap-2">
								<span
									className={`typo-body font-medium ${member ? "text-text-primary" : "text-text-tertiary"}`}
								>
									{r.label}
								</span>
								<span className="typo-body-xs text-text-tertiary">
									{member ? "yes" : "no"}
								</span>
							</div>
							{r.description && (
								<p className="typo-body-xs text-text-secondary">
									{r.description}
								</p>
							)}
						</div>
					</li>
				);
			})}
		</ol>
	);
}

// ------------------------------------------------------------- stratifiers

function stratumLabel(
	s: NonNullable<ReportStratifier["stratum"]>[number],
): string {
	if (s.value)
		return (
			s.value.text ??
			s.value.coding?.[0]?.display ??
			s.value.coding?.[0]?.code ??
			"—"
		);
	return (
		s.component
			?.map(
				(c) =>
					`${c.code?.text ?? c.code?.coding?.[0]?.code ?? ""}=${c.value?.text ?? c.value?.coding?.[0]?.code ?? ""}`,
			)
			.join(", ") ?? "—"
	);
}

function StratifierTables({
	stratifiers,
	scoring,
}: {
	stratifiers: ReportStratifier[];
	scoring: string | undefined;
}) {
	return (
		<div className="flex flex-col gap-4">
			{stratifiers.map((st, si) => {
				const codes = Array.from(
					new Set(
						(st.stratum ?? []).flatMap((s) =>
							(s.population ?? []).map((p) => populationCode(p)),
						),
					),
				);
				const title =
					st.code?.[0]?.text ??
					st.code?.[0]?.coding?.[0]?.code ??
					st.id ??
					`Stratifier ${si + 1}`;
				return (
					<div key={st.id ?? title} className="flex flex-col gap-2">
						<span className="typo-label text-text-secondary">{title}</span>
						<div className="rounded-md border border-border-default overflow-hidden">
							<HSComp.Table zebra>
								<HSComp.TableHeader>
									<HSComp.TableRow>
										<HSComp.TableHead>Stratum</HSComp.TableHead>
										{codes.map((c) => (
											<HSComp.TableHead key={c}>
												{populationLabel(c)}
											</HSComp.TableHead>
										))}
										<HSComp.TableHead>Score</HSComp.TableHead>
									</HSComp.TableRow>
								</HSComp.TableHeader>
								<HSComp.TableBody>
									{(st.stratum ?? []).map((s) => {
										const label = stratumLabel(s);
										const counts: GroupCounts = {};
										for (const p of s.population ?? [])
											counts[populationCode(p)] = p.count ?? 0;
										return (
											<HSComp.TableRow key={label}>
												<HSComp.TableCell>{label}</HSComp.TableCell>
												{codes.map((c) => (
													<HSComp.TableCell key={c} className="tabular-nums">
														{counts[c] ?? "—"}
													</HSComp.TableCell>
												))}
												<HSComp.TableCell className="tabular-nums font-medium">
													{formatScore(s.measureScore?.value, scoring)}
												</HSComp.TableCell>
											</HSComp.TableRow>
										);
									})}
								</HSComp.TableBody>
							</HSComp.Table>
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ----------------------------------------------------------------- subject

function SubjectHeader({ reference }: { reference: string | undefined }) {
	const id = reference?.startsWith("Patient/")
		? reference.slice("Patient/".length)
		: null;
	const { data: patients } = usePatients(id ? [id] : []);
	const patient = id ? patients?.get(id) : undefined;
	const details = [patient?.gender, patient?.birthDate]
		.filter(Boolean)
		.join(" · ");
	return (
		<div className="flex items-center gap-3 min-w-0">
			<div className="flex items-center justify-center size-10 rounded-full bg-bg-tertiary text-fg-secondary shrink-0">
				<User className="size-5" />
			</div>
			<div className="flex flex-col min-w-0">
				{id ? (
					<Link
						to="/resource/$resourceType/edit/$id"
						params={{ resourceType: "Patient", id }}
						search={{ tab: "edit", mode: "json", builderTab: "form" }}
						className="typo-body font-medium text-text-link hover:underline truncate"
					>
						{patient?.name ?? reference}
					</Link>
				) : (
					<span className="typo-body font-medium text-text-primary truncate">
						{reference ?? "Unknown subject"}
					</span>
				)}
				<span className="typo-body-xs text-text-tertiary truncate">
					{[details, patient?.name ? reference : null]
						.filter(Boolean)
						.join(" · ")}
				</span>
			</div>
		</div>
	);
}

// -------------------------------------------------------------------- view

export type PatientsSlot = (ctx: {
	report: MeasureReport;
	binding: SqlBinding;
	scoring: string | undefined;
	inverse: boolean;
}) => ReactNode;

function GroupHeading({
	group,
	measureGroup,
	idx,
}: {
	group: ReportGroup;
	measureGroup: { description?: string } | undefined;
	idx: number;
}) {
	return (
		<div className="flex flex-col gap-0.5">
			<span className="typo-label-tiny uppercase tracking-wide text-text-tertiary">
				{group.id ?? `Group ${idx + 1}`}
			</span>
			{measureGroup?.description && (
				<span className="typo-body text-text-secondary">
					{plainText(measureGroup.description)}
				</span>
			)}
		</div>
	);
}

function SummaryGroup({
	report,
	group,
	idx,
	measure,
	multi,
	patients,
}: {
	report: MeasureReport;
	group: ReportGroup;
	idx: number;
	measure: Measure | null | undefined;
	multi: boolean;
	patients?: PatientsSlot;
}) {
	const mg = findMeasureGroup(measure, group, idx);
	const scoring =
		groupScoring(measure, mg?.idx ?? idx) ??
		(group.measureScore ? undefined : "cohort");
	const improvement = groupImprovement(measure, mg?.idx ?? idx, report);
	const inverse = improvement === "decrease";
	const counts = groupCounts(group);
	const breakdown = proportionBreakdown(counts);
	const rows = populationRows(group, mg?.group);
	const binding = groupSqlBinding(mg?.group);
	const score = group.measureScore?.value;
	return (
		<section className="flex flex-col gap-6">
			{multi && (
				<GroupHeading group={group} measureGroup={mg?.group} idx={idx} />
			)}
			{(score !== undefined || breakdown) && (
				<div className="flex flex-wrap items-center gap-x-10 gap-y-6">
					<ScoreRing
						value={score}
						scoring={scoring}
						tone={toneFor("met", inverse)}
						caption={
							<div className="flex flex-col items-center gap-0.5">
								{breakdown && (
									<span className="typo-body-xs text-text-secondary tabular-nums">
										{breakdown.met.toLocaleString()} of{" "}
										{breakdown.eligible.toLocaleString()} eligible
									</span>
								)}
								<ImprovementHint improvement={improvement} />
							</div>
						}
					/>
					{breakdown && (
						<BreakdownBar
							denominator={breakdown.denominator}
							segments={breakdown.segments}
							inverse={inverse}
						/>
					)}
				</div>
			)}
			<div className="flex flex-col gap-3">
				<span className="typo-label-tiny uppercase tracking-wide text-text-tertiary">
					Populations
				</span>
				<PopulationBars rows={rows} inverse={inverse} />
			</div>
			{(group.stratifier?.length ?? 0) > 0 && (
				<div className="flex flex-col gap-3">
					<span className="typo-label-tiny uppercase tracking-wide text-text-tertiary">
						Stratifiers
					</span>
					<StratifierTables
						stratifiers={group.stratifier ?? []}
						scoring={scoring}
					/>
				</div>
			)}
			{binding && patients?.({ report, binding, scoring, inverse })}
		</section>
	);
}

function IndividualGroup({
	report,
	group,
	idx,
	measure,
	multi,
}: {
	report: MeasureReport;
	group: ReportGroup;
	idx: number;
	measure: Measure | null | undefined;
	multi: boolean;
}) {
	const mg = findMeasureGroup(measure, group, idx);
	const scoring = groupScoring(measure, mg?.idx ?? idx);
	const improvement = groupImprovement(measure, mg?.idx ?? idx, report);
	const inverse = improvement === "decrease";
	const counts = groupCounts(group);
	const outcome = subjectOutcome(
		(code) => {
			const n = counts[code];
			return n === undefined ? undefined : n > 0;
		},
		scoring ?? (counts.numerator !== undefined ? "proportion" : undefined),
	);
	const rows = populationRows(group, mg?.group);
	return (
		<section className="flex flex-col gap-4">
			{multi && (
				<GroupHeading group={group} measureGroup={mg?.group} idx={idx} />
			)}
			<div className="flex items-center gap-3 flex-wrap">
				<span className="typo-body text-text-secondary">Outcome</span>
				<OutcomeTag outcome={outcome} inverse={inverse} size="big" />
				<ImprovementHint improvement={improvement} />
			</div>
			<CriteriaChecklist rows={rows} inverse={inverse} />
		</section>
	);
}

export function MeasureReportView({
	report,
	measure,
	showMeasure = true,
	patients,
}: {
	report: MeasureReport;
	measure: Measure | null | undefined;
	showMeasure?: boolean;
	patients?: PatientsSlot;
}) {
	const individual = report.type === "individual";
	const groups = report.group ?? [];
	const multi = groups.length > 1;
	const title = measureLabel(measure);
	return (
		<div className="flex flex-col gap-6 px-4 py-5">
			<div className="flex flex-col gap-3">
				{showMeasure && (title || report.measure) && (
					<div className="flex flex-col gap-0.5 min-w-0">
						{title && (
							<span className="typo-body font-medium text-text-primary truncate">
								{title}
							</span>
						)}
						<span className="typo-body-xs font-mono text-text-tertiary truncate">
							{report.measure}
						</span>
					</div>
				)}
				<div className="flex items-center gap-3 flex-wrap">
					<HSComp.Tag
						size="small"
						vibrance="subtle"
						color={individual ? "yellow" : "blue"}
					>
						{individual ? "Individual" : "Summary"}
					</HSComp.Tag>
					{report.period && (
						<span className="inline-flex items-center gap-1.5 typo-body text-text-secondary">
							<CalendarRange className="size-4 text-text-tertiary" />
							{formatPeriod(report.period)}
						</span>
					)}
					{report.status && report.status !== "complete" && (
						<HSComp.Tag size="small" vibrance="subtle" color="yellow">
							{report.status}
						</HSComp.Tag>
					)}
				</div>
				{individual && <SubjectHeader reference={report.subject?.reference} />}
			</div>
			{groups.length === 0 ? (
				<span className="typo-body text-text-tertiary italic">
					The report has no groups.
				</span>
			) : (
				groups.map((g, i) =>
					individual ? (
						<IndividualGroup
							key={g.id ?? i}
							report={report}
							group={g}
							idx={i}
							measure={measure}
							multi={multi}
						/>
					) : (
						<SummaryGroup
							key={g.id ?? i}
							report={report}
							group={g}
							idx={i}
							measure={measure}
							multi={multi}
							patients={patients}
						/>
					),
				)
			)}
		</div>
	);
}
