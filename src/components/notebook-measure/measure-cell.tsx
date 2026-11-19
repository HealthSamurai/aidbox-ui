import * as HSComp from "@health-samurai/react-components";
import { Link } from "@tanstack/react-router";
import { Eraser, Gauge, Loader2, Play, Timer } from "lucide-react";
import { useId, useState } from "react";
import { useAidboxClient } from "../../AidboxClient";
import {
	type EvaluateResult,
	evaluateMeasure,
	type MeasureInput,
	useMeasure,
} from "./measure-api";
import { MeasurePicker } from "./measure-picker";
import { MeasureReportPanel } from "./measure-report-panel";
import {
	groupScoring,
	isMeasureReport,
	isPartialDate,
	type Measure,
	measureLabel,
	plainText,
} from "./measure-types";

// A notebook "measure" cell: Measure/$evaluate-measure for a Measure (by
// canonical, or Measure/<id>) over a period, for all patients or one subject.
// The cell value is the JSON of MeasureInput; the result the EvaluateResult.

type CellLike = { value?: string; result?: unknown };

const EMPTY: MeasureInput = { measure: "", periodStart: "", periodEnd: "" };

export function parseMeasureCellValue(raw: string | undefined): MeasureInput {
	const trimmed = (raw ?? "").trim();
	if (!trimmed) return EMPTY;
	if (!trimmed.startsWith("{")) return { ...EMPTY, measure: trimmed };
	try {
		const obj = JSON.parse(trimmed) as Partial<MeasureInput>;
		return {
			measure: typeof obj.measure === "string" ? obj.measure : "",
			periodStart: typeof obj.periodStart === "string" ? obj.periodStart : "",
			periodEnd: typeof obj.periodEnd === "string" ? obj.periodEnd : "",
			...(typeof obj.subject === "string" && obj.subject
				? { subject: obj.subject }
				: {}),
		};
	} catch {
		return EMPTY;
	}
}

function stringifyMeasureCellValue(input: MeasureInput): string {
	const out: MeasureInput = {
		measure: input.measure,
		periodStart: input.periodStart,
		periodEnd: input.periodEnd,
	};
	if (input.subject?.trim()) out.subject = input.subject.trim();
	return JSON.stringify(out, null, 2);
}

function savedResult(saved: unknown): EvaluateResult | null {
	if (!saved || typeof saved !== "object") return null;
	const s = saved as { ok?: unknown; report?: unknown; error?: unknown };
	if (s.ok === true && isMeasureReport(s.report))
		return saved as EvaluateResult;
	if (s.ok === false && typeof s.error === "string")
		return saved as EvaluateResult;
	if (isMeasureReport(saved)) return { ok: true, report: saved, duration: 0 };
	return null;
}

function MeasureInfo({
	reference,
	measure,
	loading,
}: {
	reference: string;
	measure: Measure | null | undefined;
	loading: boolean;
}) {
	if (loading) {
		return (
			<div className="px-3 py-2 border-b border-border-default">
				<HSComp.Skeleton className="h-4 w-60 rounded" />
			</div>
		);
	}
	const scoring = groupScoring(measure, 0);
	return (
		<div className="px-3 py-2 border-b border-border-default flex flex-col gap-0.5 min-w-0">
			<div className="flex items-center gap-2 min-w-0">
				{measure?.id ? (
					<Link
						to="/resource/$resourceType/edit/$id"
						params={{ resourceType: "Measure", id: measure.id }}
						search={{ tab: "edit", mode: "json", builderTab: "form" }}
						className="typo-body text-text-info-primary hover:underline truncate"
					>
						{measureLabel(measure)}
					</Link>
				) : (
					<span className="typo-body text-text-primary truncate">
						{measureLabel(measure) ?? reference}
					</span>
				)}
				{measure?.version && (
					<span className="typo-body-xs text-text-tertiary shrink-0">
						v{measure.version}
					</span>
				)}
				{scoring && (
					<HSComp.Tag
						size="small"
						vibrance="subtle"
						color="gray"
						className="shrink-0"
					>
						{scoring}
					</HSComp.Tag>
				)}
			</div>
			<span className="typo-body-xs font-mono text-text-tertiary truncate">
				{reference}
			</span>
			{measure?.description && (
				<p
					className="typo-body-xs text-text-secondary line-clamp-2"
					title={plainText(measure.description)}
				>
					{plainText(measure.description)}
				</p>
			)}
		</div>
	);
}

function ParamField({
	id,
	label,
	value,
	placeholder,
	invalid,
	onChange,
	onEnter,
	className,
}: {
	id: string;
	label: string;
	value: string;
	placeholder: string;
	invalid?: boolean;
	onChange: (v: string) => void;
	onEnter: () => void;
	className?: string;
}) {
	return (
		<div className={`flex flex-col gap-1 ${className ?? ""}`}>
			<label
				htmlFor={id}
				className="typo-label-tiny uppercase tracking-wide text-text-tertiary"
			>
				{label}
			</label>
			<HSComp.Input
				id={id}
				value={value}
				invalid={invalid}
				placeholder={placeholder}
				className="typo-code"
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") onEnter();
				}}
			/>
		</div>
	);
}

function ResultBody({
	result,
	view,
	measure,
}: {
	result: EvaluateResult;
	view: "report" | "json";
	measure: Measure | null | undefined;
}) {
	if (!result.ok) {
		return result.outcome ? (
			<div className="p-3">
				<HSComp.OperationOutcomeView resource={result.outcome} />
			</div>
		) : (
			<pre className="px-3 py-2 typo-code whitespace-pre-wrap text-critical-default">
				{result.error}
			</pre>
		);
	}
	if (view === "json") {
		return (
			<div className="max-h-[480px] overflow-auto [&_.cm-content]:!pl-1.5">
				<HSComp.CodeEditor
					readOnly
					currentValue={JSON.stringify(result.report, null, 2)}
					mode="json"
					lineNumbers={false}
					foldGutter={false}
				/>
			</div>
		);
	}
	return (
		<MeasureReportPanel
			report={result.report}
			measure={measure}
			showMeasure={false}
		/>
	);
}

export function MeasureCellView({
	cell,
	onValueChange,
	onResultChange,
	readOnly,
}: {
	cell: CellLike;
	onValueChange?: (value: string) => void;
	onResultChange?: (result: unknown) => void;
	readOnly?: boolean;
}) {
	const fieldId = useId();
	const client = useAidboxClient();
	const editable = !(readOnly ?? !onValueChange);
	const [input, setInput] = useState<MeasureInput>(() =>
		parseMeasureCellValue(cell.value),
	);
	const [result, setResult] = useState<EvaluateResult | null>(() =>
		savedResult(cell.result),
	);
	const [loading, setLoading] = useState(false);
	const [view, setView] = useState<"report" | "json">("report");
	const { data: measure, isLoading: measureLoading } = useMeasure(
		input.measure || null,
	);

	const update = (next: MeasureInput) => {
		setInput(next);
		onValueChange?.(stringifyMeasureCellValue(next));
	};

	const startValid = isPartialDate(input.periodStart);
	const endValid = isPartialDate(input.periodEnd);
	const canRun = !!input.measure.trim() && startValid && endValid && !loading;

	const run = async (target: MeasureInput = input) => {
		setLoading(true);
		try {
			const next = await evaluateMeasure(client, target);
			setResult(next);
			setView("report");
			onResultChange?.(next);
		} finally {
			setLoading(false);
		}
	};

	const runIfReady = () => {
		if (canRun) void run();
	};

	const clear = () => {
		setResult(null);
		onResultChange?.(null);
	};

	const report = result?.ok ? result.report : null;

	return (
		<div className="group/cell -mx-3 mt-4 mb-4 rounded-lg border border-border-default bg-bg-primary overflow-hidden">
			<div className="flex items-center justify-between bg-bg-secondary pl-3 pr-4 border-b border-border-default h-10 gap-3">
				<div className="flex items-center gap-3 min-w-0">
					<span className="text-sm font-medium text-text-secondary w-[140px] shrink-0 flex items-center gap-1.5">
						<Gauge className="size-4" />
						Measure
					</span>
					{editable && (
						<MeasurePicker
							placeholder={input.measure ? "Change…" : "Select measure…"}
							className={input.measure ? "max-w-[200px]" : "max-w-[500px]"}
							onChange={(canonical, m) => {
								const next: MeasureInput = {
									...input,
									measure: canonical,
									periodStart:
										input.periodStart || m?.effectivePeriod?.start || "",
									periodEnd: input.periodEnd || m?.effectivePeriod?.end || "",
								};
								update(next);
								if (
									isPartialDate(next.periodStart) &&
									isPartialDate(next.periodEnd)
								)
									void run(next);
							}}
						/>
					)}
				</div>
				<div className="flex items-center gap-2">
					{result && onResultChange && (
						<HSComp.Button
							variant="ghost"
							size="small"
							aria-label="Clear result"
							onClick={clear}
						>
							<Eraser />
							Clear result
						</HSComp.Button>
					)}
					<button
						type="button"
						disabled={!canRun}
						onClick={() => void run()}
						className="flex items-center gap-2 text-text-info-primary typo-body uppercase hover:text-text-info-secondary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
					>
						{loading ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Play className="size-4 fill-current" />
						)}
						{loading ? "Evaluating…" : "Evaluate"}
					</button>
				</div>
			</div>
			{input.measure && (
				<MeasureInfo
					reference={input.measure}
					measure={measure}
					loading={measureLoading}
				/>
			)}
			<div className="px-3 pt-2 pb-3 border-b border-border-default flex flex-wrap gap-3">
				<ParamField
					id={`${fieldId}-period-start`}
					label="Period start"
					value={input.periodStart}
					placeholder="YYYY-MM-DD"
					invalid={!!input.periodStart && !startValid}
					onChange={(v) => update({ ...input, periodStart: v })}
					onEnter={runIfReady}
					className="w-[150px]"
				/>
				<ParamField
					id={`${fieldId}-period-end`}
					label="Period end"
					value={input.periodEnd}
					placeholder="YYYY-MM-DD"
					invalid={!!input.periodEnd && !endValid}
					onChange={(v) => update({ ...input, periodEnd: v })}
					onEnter={runIfReady}
					className="w-[150px]"
				/>
				<ParamField
					id={`${fieldId}-subject`}
					label="Subject"
					value={input.subject ?? ""}
					placeholder="All patients — or Patient/<id>"
					onChange={(v) => update({ ...input, subject: v })}
					onEnter={runIfReady}
					className="flex-1 min-w-[240px]"
				/>
			</div>
			{result && (
				<>
					<div className="flex items-center justify-between bg-bg-secondary pl-3 pr-4 h-10 border-b border-border-default gap-3">
						<span className="text-sm font-medium text-text-secondary">
							{result.ok
								? `MeasureReport — ${result.report.type ?? "report"}`
								: "Result — error"}
						</span>
						<div className="flex items-center gap-3">
							{report && (
								<HSComp.SegmentControl
									value={view}
									onValueChange={setView}
									items={[
										{ value: "report" as const, label: "Report" },
										{ value: "json" as const, label: "JSON" },
									]}
								/>
							)}
							{result.duration !== undefined && result.duration > 0 && (
								<span className="flex items-center text-text-secondary text-sm">
									<Timer className="size-4 mr-1" strokeWidth={1.5} />
									<span className="font-bold">
										{Math.round(result.duration)}
									</span>
									<span className="ml-1">ms</span>
								</span>
							)}
						</div>
					</div>
					<ResultBody result={result} view={view} measure={measure} />
				</>
			)}
		</div>
	);
}
