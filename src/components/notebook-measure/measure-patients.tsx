import * as HSComp from "@health-samurai/react-components";
import { Circle, CircleCheck, Loader2, Users } from "lucide-react";
import { useState } from "react";
import { useMeasureSqlRows, usePatients } from "./measure-api";
import { OutcomeTag, toneFor } from "./measure-report-view";
import {
	type MeasureReport,
	type Outcome,
	outcomeByKey,
	populationTone,
	type SqlBinding,
	subjectOutcome,
	TONE_TEXT,
} from "./measure-types";

const PAGE = 50;
const SUBJECT_COLUMN = "patient_id";

type PatientRow = {
	id: string;
	outcome: Outcome;
	populations: Record<string, boolean>;
	strata: Record<string, boolean>;
};

function toPatientRows(
	rows: Record<string, unknown>[],
	binding: SqlBinding,
	scoring: string | undefined,
): PatientRow[] {
	return rows.map((row, i) => {
		const populations: Record<string, boolean> = {};
		for (const p of binding.populations)
			populations[p.code] = row[p.column] === true;
		const strata: Record<string, boolean> = {};
		for (const s of binding.stratifiers) strata[s.id] = row[s.column] === true;
		const outcome = subjectOutcome(
			(code) => (code in populations ? populations[code] : undefined),
			scoring,
		);
		return {
			id: String(row[SUBJECT_COLUMN] ?? `row-${i + 1}`),
			outcome,
			populations,
			strata,
		};
	});
}

function MembershipIcon({
	value,
	code,
	inverse,
}: {
	value: boolean;
	code: string;
	inverse: boolean;
}) {
	if (!value)
		return <Circle className="size-4 text-text-disabled" aria-label="no" />;
	const tone = toneFor(populationTone(code), inverse);
	return (
		<CircleCheck className={`size-4 ${TONE_TEXT[tone]}`} aria-label="yes" />
	);
}

function PatientsTable({
	rows,
	binding,
	inverse,
}: {
	rows: PatientRow[];
	binding: SqlBinding;
	inverse: boolean;
}) {
	const { data: patients } = usePatients(rows.map((r) => r.id));
	return (
		<div className="max-h-[480px] overflow-auto rounded-md border border-border-default">
			<HSComp.Table stickyHeader>
				<HSComp.TableHeader>
					<HSComp.TableRow>
						<HSComp.TableHead>Patient</HSComp.TableHead>
						<HSComp.TableHead>Outcome</HSComp.TableHead>
						{binding.populations.map((p) => (
							<HSComp.TableHead
								key={p.code}
								className="text-center"
								title={p.column}
							>
								{p.label}
							</HSComp.TableHead>
						))}
						{binding.stratifiers.map((s) => (
							<HSComp.TableHead
								key={s.id}
								className="text-center"
								title={s.column}
							>
								{s.label}
							</HSComp.TableHead>
						))}
					</HSComp.TableRow>
				</HSComp.TableHeader>
				<HSComp.TableBody>
					{rows.map((r) => {
						const p = patients?.get(r.id);
						return (
							<HSComp.TableRow key={r.id}>
								<HSComp.TableCell>
									<div className="flex flex-col min-w-0">
										<span className="typo-body text-text-primary truncate">
											{p?.name ?? r.id}
										</span>
										<span className="typo-body-xs text-text-tertiary font-mono truncate">
											{[
												p?.gender,
												p?.birthDate,
												p?.name ? r.id.slice(0, 8) : null,
											]
												.filter(Boolean)
												.join(" · ")}
										</span>
									</div>
								</HSComp.TableCell>
								<HSComp.TableCell>
									<OutcomeTag outcome={r.outcome} inverse={inverse} />
								</HSComp.TableCell>
								{binding.populations.map((pop) => (
									<HSComp.TableCell key={pop.code}>
										<div className="flex justify-center">
											<MembershipIcon
												value={r.populations[pop.code] ?? false}
												code={pop.code}
												inverse={inverse}
											/>
										</div>
									</HSComp.TableCell>
								))}
								{binding.stratifiers.map((s) => (
									<HSComp.TableCell key={s.id}>
										<div className="flex justify-center">
											<MembershipIcon
												value={r.strata[s.id] ?? false}
												code="stratum"
												inverse={false}
											/>
										</div>
									</HSComp.TableCell>
								))}
							</HSComp.TableRow>
						);
					})}
				</HSComp.TableBody>
			</HSComp.Table>
		</div>
	);
}

const OUTCOME_ORDER: Outcome["key"][] = [
	"met",
	"notMet",
	"exception",
	"numeratorExcluded",
	"excluded",
	"notInDenominator",
	"notInPopulation",
	"inPopulation",
];

export function MeasurePatients({
	report,
	binding,
	scoring,
	inverse,
}: {
	report: MeasureReport;
	binding: SqlBinding;
	scoring: string | undefined;
	inverse: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [filter, setFilter] = useState<"all" | Outcome["key"]>("all");
	const [limit, setLimit] = useState(PAGE);
	const { data, isFetching, refetch } = useMeasureSqlRows(
		binding.library,
		report.period,
		open,
	);
	const all = data?.ok ? toPatientRows(data.rows, binding, scoring) : [];
	const counts = new Map<Outcome["key"], number>();
	for (const r of all)
		counts.set(r.outcome.key, (counts.get(r.outcome.key) ?? 0) + 1);
	const filtered =
		filter === "all" ? all : all.filter((r) => r.outcome.key === filter);
	const visible = filtered.slice(0, limit);
	const libraryName = binding.library.split("|")[0]?.split("/").pop();

	if (!open) {
		return (
			<div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border-default px-4 py-3">
				<div className="flex flex-col min-w-0">
					<span className="typo-body text-text-primary">Patients</span>
					<span className="typo-body-xs text-text-tertiary truncate">
						One row per patient from the SQLQuery{" "}
						<span className="font-mono">{libraryName}</span> for the same period
					</span>
				</div>
				<HSComp.Button
					variant="secondary"
					size="small"
					onClick={() => setOpen(true)}
				>
					<Users className="size-4" />
					Show patients
				</HSComp.Button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-3 flex-wrap">
				<span className="typo-label-tiny uppercase tracking-wide text-text-tertiary">
					Patients{data?.ok ? ` (${all.length})` : ""}
				</span>
				{data?.ok && all.length > 0 && (
					<HSComp.SegmentControl
						value={filter}
						onValueChange={(v) => {
							setFilter(v);
							setLimit(PAGE);
						}}
						items={[
							{ value: "all" as const, label: `All ${all.length}` },
							...OUTCOME_ORDER.filter((k) => counts.has(k)).map((k) => ({
								value: k,
								label: `${outcomeByKey(k).label} ${counts.get(k)}`,
							})),
						]}
					/>
				)}
			</div>
			{isFetching && !data ? (
				<div className="flex items-center gap-2 typo-body text-text-secondary">
					<Loader2 className="size-4 animate-spin" />
					Running SQLQuery…
				</div>
			) : data && !data.ok ? (
				<div className="flex items-start justify-between gap-3">
					<pre className="typo-code whitespace-pre-wrap text-text-error-primary">
						{data.error}
					</pre>
					<HSComp.Button
						variant="ghost"
						size="small"
						onClick={() => void refetch()}
					>
						Retry
					</HSComp.Button>
				</div>
			) : visible.length === 0 ? (
				<span className="typo-body text-text-tertiary italic">
					No patients.
				</span>
			) : (
				<>
					<PatientsTable rows={visible} binding={binding} inverse={inverse} />
					{filtered.length > visible.length && (
						<HSComp.Button
							variant="ghost"
							size="small"
							className="self-center"
							onClick={() => setLimit((l) => l + PAGE)}
						>
							Show more ({filtered.length - visible.length} left)
						</HSComp.Button>
					)}
				</>
			)}
		</div>
	);
}
