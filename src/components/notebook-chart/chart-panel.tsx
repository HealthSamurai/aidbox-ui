import * as HSComp from "@health-samurai/react-components";
import { Loader2, Plus, Settings2, X } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { VisualizationSpec } from "vega-embed";
import {
	ChartIconBar,
	ChartIconCustom,
	ChartIconLine,
	ChartIconPie,
	ChartIconPyramid,
} from "./chart-icons";
import { chartConfigExtensions, foldChartConfigData } from "./fold-data";

const VegaLiteChart = lazy(() => import("./vega-lite-chart"));

export type ChartConfig = {
	type: "bar" | "line" | "pie" | "pyramid" | "custom";
	x: string;
	y: string[];
	color: string;
	stack?: "stacked" | "grouped" | "normalized";
	lineMode?: "line" | "area";
	rawSpec?: string;
};

const CHART_PALETTE = [
	"#1e71d9",
	"#ea4a35",
	"#6aa300",
	"#f4cb00",
	"#cc29b6",
	"#a7c9f3",
	"#f4a499",
	"#c9e19b",
	"#ffea80",
	"#eba9e2",
	"#014391",
	"#c31a03",
	"#334e02",
	"#855600",
	"#58124e",
];

const CHART_CONFIG = {
	view: { stroke: null },
	range: { category: CHART_PALETTE },
};

const CHART_CONFIG_AXIS = {
	view: { stroke: null },
	axis: { grid: false },
	range: { category: CHART_PALETTE },
};

function buildBarSpec(
	records: Record<string, unknown>[],
	x: string,
	measures: string[],
	color: string,
	stack: "stacked" | "grouped" | "normalized",
): VisualizationSpec {
	const ys = measures.filter(Boolean);
	const multi = ys.length >= 2;
	const series = multi ? "measure" : color;
	const yStack =
		stack === "normalized" ? "normalize" : stack === "grouped" ? null : "zero";
	const encoding: Record<string, unknown> = {
		x: { field: x, type: "nominal", sort: null },
		y: {
			field: multi ? "__value" : (ys[0] ?? ""),
			type: "quantitative",
			stack: yStack,
		},
	};
	if (series) {
		encoding.color = { field: series, type: "nominal" };
		if (stack === "grouped") {
			encoding.xOffset = { field: series, type: "nominal" };
		}
	}
	return {
		$schema: "https://vega.github.io/schema/vega-lite/v6.json",
		data: { values: records },
		...(multi ? { transform: [{ fold: ys, as: ["measure", "__value"] }] } : {}),
		width: "container",
		height: 280,
		mark: { type: "bar", tooltip: true },
		encoding,
		config: CHART_CONFIG,
	} as VisualizationSpec;
}

function buildPyramidSpec(
	records: Record<string, unknown>[],
	category: string,
	measure: string,
	group: string,
): VisualizationSpec {
	if (!group) {
		return {
			$schema: "https://vega.github.io/schema/vega-lite/v6.json",
			data: { values: records },
			width: "container",
			height: 280,
			mark: { type: "bar", tooltip: true },
			encoding: {
				y: {
					field: category,
					type: "nominal",
					sort: null,
					axis: { title: null },
				},
				x: {
					field: measure,
					type: "quantitative",
					title: measure,
				},
			},
			config: CHART_CONFIG_AXIS,
		} as VisualizationSpec;
	}
	const groupValues = Array.from(
		new Set(records.map((r) => String(r[group]))),
	).slice(0, 2);
	const negated = groupValues[1] ?? "";
	const signed = `datum[${JSON.stringify(group)}] === ${JSON.stringify(negated)} ? -datum[${JSON.stringify(measure)}] : datum[${JSON.stringify(measure)}]`;
	return {
		$schema: "https://vega.github.io/schema/vega-lite/v6.json",
		data: { values: records },
		transform: [{ calculate: signed, as: "__signed" }],
		width: "container",
		height: 280,
		mark: "bar",
		encoding: {
			y: {
				field: category,
				type: "nominal",
				sort: null,
				axis: { title: null },
			},
			x: {
				field: "__signed",
				type: "quantitative",
				title: measure,
				axis: { format: "s" },
			},
			color: {
				field: group,
				type: "nominal",
				legend: { orient: "top", title: null },
			},
		},
		config: CHART_CONFIG_AXIS,
	} as VisualizationSpec;
}

const CHART_TYPES = [
	{ value: "bar", label: "Bar", icon: <ChartIconBar /> },
	{ value: "line", label: "Line", icon: <ChartIconLine /> },
	{ value: "pie", label: "Pie", icon: <ChartIconPie /> },
	{ value: "pyramid", label: "Butterfly", icon: <ChartIconPyramid /> },
	{ value: "custom", label: "Custom config", icon: <ChartIconCustom /> },
] as const;

function detectFieldType(
	records: Record<string, unknown>[],
	field: string,
): "quantitative" | "temporal" | "nominal" {
	let numeric = false;
	for (const r of records) {
		const v = r[field];
		if (typeof v === "string" && /^\d{4}-\d{2}/.test(v)) return "temporal";
		if (typeof v === "number") numeric = true;
		else if (v != null) return "nominal";
	}
	return numeric ? "quantitative" : "nominal";
}

function buildLineSpec(
	records: Record<string, unknown>[],
	x: string,
	measures: string[],
	color: string,
	area: boolean,
): VisualizationSpec {
	const ys = measures.filter(Boolean);
	const mark = area
		? { type: "area", tooltip: true }
		: { type: "line", point: true, tooltip: true };
	if (ys.length >= 2) {
		return {
			$schema: "https://vega.github.io/schema/vega-lite/v6.json",
			data: { values: records },
			transform: [{ fold: ys, as: ["measure", "__value"] }],
			width: "container",
			height: 280,
			mark,
			encoding: {
				x: { field: x, type: detectFieldType(records, x), sort: null },
				y: { field: "__value", type: "quantitative" },
				color: { field: "measure", type: "nominal" },
			},
			config: CHART_CONFIG,
		} as VisualizationSpec;
	}
	const encoding: Record<string, unknown> = {
		x: { field: x, type: detectFieldType(records, x), sort: null },
		y: { field: ys[0] ?? "", type: "quantitative" },
	};
	if (color) {
		encoding.color = { field: color, type: "nominal" };
	}
	return {
		$schema: "https://vega.github.io/schema/vega-lite/v6.json",
		data: { values: records },
		width: "container",
		height: 280,
		mark,
		encoding,
		config: CHART_CONFIG,
	} as VisualizationSpec;
}

function buildPieSpec(
	records: Record<string, unknown>[],
	category: string,
	measure: string,
): VisualizationSpec {
	return {
		$schema: "https://vega.github.io/schema/vega-lite/v6.json",
		data: { values: records },
		width: "container",
		height: 280,
		mark: { type: "arc", tooltip: true },
		encoding: {
			theta: {
				field: measure,
				type: "quantitative",
				stack: true,
			},
			color: {
				field: category,
				type: "nominal",
				sort: null,
				legend: { orient: "right" },
			},
		},
		config: CHART_CONFIG,
	} as VisualizationSpec;
}

function stripChartData(text: string): string {
	try {
		const obj = JSON.parse(text) as Record<string, unknown>;
		if (obj && typeof obj === "object") delete obj.data;
		return JSON.stringify(obj, null, 2);
	} catch {
		return text;
	}
}

function computeChartPreset(
	columns: string[],
	records: Record<string, unknown>[],
): { x: string; y: string; color: string } {
	const numeric = columns.filter((c) =>
		records.some((r) => typeof r[c] === "number"),
	);
	const x = columns[0] ?? "";
	const y = numeric.find((c) => c !== x) ?? columns.find((c) => c !== x) ?? x;
	const color = columns.find((c) => c !== x && c !== y) ?? "";
	return { x, y, color };
}

function MeasureList({
	label,
	values,
	columns,
	onChange,
}: {
	label: string;
	values: string[];
	columns: string[];
	onChange: (next: string[]) => void;
}) {
	const setAt = (i: number, v: string) =>
		onChange(values.map((cur, idx) => (idx === i ? v : cur)));
	const removeAt = (i: number) =>
		onChange(values.filter((_, idx) => idx !== i));
	const add = () => {
		const used = new Set(values);
		const next = columns.find((c) => !used.has(c)) ?? columns[0] ?? "";
		onChange([...values, next]);
	};
	return (
		<div className="flex flex-col gap-1.5">
			<span className="typo-label-tiny uppercase tracking-wide text-text-tertiary">
				{label}
			</span>
			{values.map((v, i) => (
				<div key={v} className="flex items-center gap-1">
					<HSComp.Select value={v} onValueChange={(nv) => setAt(i, nv)}>
						<HSComp.SelectTrigger className="w-full h-8">
							<HSComp.SelectValue placeholder="—" />
						</HSComp.SelectTrigger>
						<HSComp.SelectContent>
							{columns.map((c) => (
								<HSComp.SelectItem key={c} value={c}>
									{c}
								</HSComp.SelectItem>
							))}
						</HSComp.SelectContent>
					</HSComp.Select>
					{values.length > 1 && (
						<HSComp.IconButton
							icon={<X />}
							aria-label="Remove measure"
							onClick={() => removeAt(i)}
						/>
					)}
				</div>
			))}
			{columns.length > values.length && (
				<HSComp.Button
					variant="ghost"
					size="small"
					onClick={add}
					className="self-start"
				>
					<Plus />
					Add measure
				</HSComp.Button>
			)}
		</div>
	);
}

function OptionSelect<T extends string>({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: T;
	options: { value: T; label: string }[];
	onChange: (v: T) => void;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className="typo-label-tiny uppercase tracking-wide text-text-tertiary">
				{label}
			</span>
			<HSComp.Select value={value} onValueChange={(v) => onChange(v as T)}>
				<HSComp.SelectTrigger className="w-full h-8">
					<HSComp.SelectValue />
				</HSComp.SelectTrigger>
				<HSComp.SelectContent>
					{options.map((o) => (
						<HSComp.SelectItem key={o.value} value={o.value}>
							{o.label}
						</HSComp.SelectItem>
					))}
				</HSComp.SelectContent>
			</HSComp.Select>
		</div>
	);
}

function ColumnSelect({
	label,
	value,
	columns,
	onChange,
	allowNone,
}: {
	label: string;
	value: string;
	columns: string[];
	onChange: (v: string) => void;
	allowNone?: boolean;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className="typo-label-tiny uppercase tracking-wide text-text-tertiary">
				{label}
			</span>
			<HSComp.Select
				value={value === "" ? "__none__" : value}
				onValueChange={(v) => onChange(v === "__none__" ? "" : v)}
			>
				<HSComp.SelectTrigger className="w-full h-8">
					<HSComp.SelectValue placeholder="—" />
				</HSComp.SelectTrigger>
				<HSComp.SelectContent>
					{allowNone && (
						<HSComp.SelectItem value="__none__">None</HSComp.SelectItem>
					)}
					{columns.map((c) => (
						<HSComp.SelectItem key={c} value={c}>
							{c}
						</HSComp.SelectItem>
					))}
				</HSComp.SelectContent>
			</HSComp.Select>
		</div>
	);
}

function ChartForm({
	chartType,
	columns,
	xField,
	setXField,
	yFields,
	setYFields,
	colorField,
	setColorField,
	stack,
	setStack,
	lineMode,
	setLineMode,
	multiMeasure,
	rawSpec,
	setRawSpec,
}: {
	chartType: ChartConfig["type"];
	columns: string[];
	xField: string;
	setXField: (v: string) => void;
	yFields: string[];
	setYFields: (v: string[]) => void;
	colorField: string;
	setColorField: (v: string) => void;
	stack: "stacked" | "grouped" | "normalized";
	setStack: (v: "stacked" | "grouped" | "normalized") => void;
	lineMode: "line" | "area";
	setLineMode: (v: "line" | "area") => void;
	multiMeasure: boolean;
	rawSpec: string;
	setRawSpec: (v: string) => void;
}) {
	if (chartType === "custom") {
		return (
			<div className="flex-1 min-h-0 overflow-auto">
				<HSComp.CodeEditor
					mode="json"
					defaultValue={rawSpec}
					onChange={setRawSpec}
					lineNumbers={false}
					additionalExtensions={chartConfigExtensions}
					viewCallback={foldChartConfigData}
				/>
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-3 p-3 min-h-0 flex-1 overflow-auto">
			{chartType === "bar" && (
				<OptionSelect
					label="Stack"
					value={stack}
					options={[
						{ value: "stacked", label: "Stacked" },
						{ value: "grouped", label: "Grouped" },
						{ value: "normalized", label: "100%" },
					]}
					onChange={setStack}
				/>
			)}
			{chartType === "line" && (
				<OptionSelect
					label="Style"
					value={lineMode}
					options={[
						{ value: "line", label: "Line" },
						{ value: "area", label: "Area" },
					]}
					onChange={setLineMode}
				/>
			)}
			{chartType !== "pie" && (
				<ColumnSelect
					label="X axis"
					value={xField}
					columns={columns}
					onChange={setXField}
				/>
			)}
			{chartType === "bar" || chartType === "line" ? (
				<MeasureList
					label="Y axis"
					values={yFields}
					columns={columns}
					onChange={setYFields}
				/>
			) : (
				<ColumnSelect
					label={chartType === "pie" ? "Value" : "Y axis"}
					value={yFields[0] ?? ""}
					columns={columns}
					onChange={(v) => setYFields([v])}
				/>
			)}
			{!multiMeasure && (
				<ColumnSelect
					label={chartType === "pie" ? "Category" : "Color"}
					value={colorField}
					columns={columns}
					onChange={setColorField}
					allowNone={chartType !== "pie"}
				/>
			)}
		</div>
	);
}

function ChartTypeButtons({
	value,
	onSelect,
}: {
	value: ChartConfig["type"];
	onSelect: (t: ChartConfig["type"]) => void;
}) {
	return (
		<div className="flex items-center gap-1">
			{CHART_TYPES.map((t) => (
				<HSComp.Tooltip key={t.value}>
					<HSComp.TooltipTrigger asChild>
						<HSComp.IconButton
							icon={t.icon}
							aria-label={t.label}
							onClick={() => onSelect(t.value)}
							className={
								value === t.value
									? "border border-border-link text-text-info-primary bg-bg-tertiary"
									: ""
							}
						/>
					</HSComp.TooltipTrigger>
					<HSComp.TooltipContent side="bottom">{t.label}</HSComp.TooltipContent>
				</HSComp.Tooltip>
			))}
		</div>
	);
}

export function ChartPanel({
	columns,
	rows,
	chart,
	onChartChange,
	editable,
	fullHeight,
}: {
	columns: string[];
	rows: unknown[][];
	chart?: ChartConfig;
	onChartChange?: (config: ChartConfig) => void;
	editable: boolean;
	fullHeight?: boolean;
}) {
	const [showSettings, setShowSettings] = useState(editable);
	const [chartType, setChartType] = useState<
		"bar" | "line" | "pie" | "pyramid" | "custom"
	>(chart?.type ?? "bar");
	const [rawSpec, setRawSpec] = useState(chart?.rawSpec ?? "");
	const [chartError, setChartError] = useState<string | null>(null);

	const records = useMemo(() => {
		return rows.map((row) => {
			const obj: Record<string, unknown> = {};
			columns.forEach((col, i) => {
				obj[col] = row[i];
			});
			return obj;
		});
	}, [columns, rows]);

	const preset = useMemo(
		() => computeChartPreset(columns, records),
		[columns, records],
	);
	const [xField, setXField] = useState(chart?.x ?? preset.x);
	const [yFields, setYFields] = useState<string[]>(chart?.y ?? [preset.y]);
	const [colorField, setColorField] = useState(chart?.color ?? preset.color);
	const [stack, setStack] = useState<"stacked" | "grouped" | "normalized">(
		chart?.stack ?? "stacked",
	);
	const [lineMode, setLineMode] = useState<"line" | "area">(
		chart?.lineMode ?? "line",
	);

	const colsKey = JSON.stringify(columns);
	const [prevColsKey, setPrevColsKey] = useState(colsKey);
	if (prevColsKey !== colsKey) {
		setPrevColsKey(colsKey);
		setXField(preset.x);
		setYFields([preset.y]);
		setColorField(preset.color);
	}

	const reportRef = useRef(onChartChange);
	reportRef.current = onChartChange;
	const firstReport = useRef(true);
	useEffect(() => {
		if (firstReport.current) {
			firstReport.current = false;
			return;
		}
		reportRef.current?.({
			type: chartType,
			x: xField,
			y: yFields,
			color: colorField,
			stack,
			lineMode,
			rawSpec:
				chartType === "custom" && rawSpec ? stripChartData(rawSpec) : undefined,
		});
	}, [chartType, xField, yFields, colorField, stack, lineMode, rawSpec]);

	const formSpec = useMemo(() => {
		const firstY = yFields[0] ?? "";
		if (chartType === "pyramid")
			return buildPyramidSpec(records, xField, firstY, colorField);
		if (chartType === "line")
			return buildLineSpec(
				records,
				xField,
				yFields,
				colorField,
				lineMode === "area",
			);
		if (chartType === "pie")
			return buildPieSpec(records, colorField || xField, firstY);
		return buildBarSpec(records, xField, yFields, colorField, stack);
	}, [chartType, records, xField, yFields, colorField, stack, lineMode]);

	const multiMeasure =
		(chartType === "bar" || chartType === "line") && yFields.length >= 2;

	const { spec, error: specError } = useMemo<{
		spec: VisualizationSpec | null;
		error: string | null;
	}>(() => {
		if (chartType !== "custom") return { spec: formSpec, error: null };
		try {
			const parsed = JSON.parse(rawSpec) as Record<string, unknown>;
			if (parsed && typeof parsed === "object" && !("data" in parsed)) {
				parsed.data = { values: records };
			}
			return { spec: parsed as VisualizationSpec, error: null };
		} catch (e) {
			return { spec: null, error: e instanceof Error ? e.message : String(e) };
		}
	}, [chartType, rawSpec, formSpec, records]);

	const [prevSpec, setPrevSpec] = useState(spec);
	if (prevSpec !== spec) {
		setPrevSpec(spec);
		setChartError(null);
	}

	const displaySpec =
		fullHeight && spec
			? ({ ...spec, height: "container" } as VisualizationSpec)
			: spec;

	const chartBody = (
		<>
			{displaySpec ? (
				<Suspense
					fallback={
						<div className="flex items-center justify-center h-[280px] text-text-tertiary">
							<Loader2 className="size-4 animate-spin" />
						</div>
					}
				>
					<VegaLiteChart
						spec={displaySpec}
						onError={(e) => setChartError(String(e))}
					/>
				</Suspense>
			) : (
				<div className="px-1 py-2 typo-body-xs text-critical-default">
					Invalid Vega-Lite config: {specError}
				</div>
			)}
			{displaySpec && chartError && (
				<div className="px-1 py-2 typo-body-xs text-critical-default">
					{chartError}
				</div>
			)}
		</>
	);

	if (!showSettings) {
		return (
			<div
				className={`flex flex-col ${fullHeight ? "h-full" : "max-h-[460px]"}`}
			>
				<div className="flex justify-end px-2 pt-2">
					<HSComp.Toggle
						variant="outline"
						pressed={false}
						onPressedChange={() => setShowSettings(true)}
						aria-label="Chart settings"
					>
						<Settings2 />
						Settings
					</HSComp.Toggle>
				</div>
				<div
					className={`min-h-0 overflow-auto p-3 pt-2 ${fullHeight ? "flex-1" : ""}`}
				>
					{chartBody}
				</div>
			</div>
		);
	}

	return (
		<div className={fullHeight ? "h-full" : "h-[400px]"}>
			<HSComp.ResizablePanelGroup direction="horizontal">
				<HSComp.ResizablePanel defaultSize={60} minSize={30}>
					<div className="h-full overflow-auto p-3">{chartBody}</div>
				</HSComp.ResizablePanel>
				<HSComp.ResizableHandle withHandle />
				<HSComp.ResizablePanel defaultSize={40} minSize={20}>
					<div className="flex h-full flex-col bg-bg-primary">
						<div className="flex items-center justify-between pl-3 pr-2 h-9 border-b border-border-default shrink-0">
							<ChartTypeButtons
								value={chartType}
								onSelect={(t) => {
									if (t === "custom" && chartType !== "custom") {
										setRawSpec(JSON.stringify(formSpec, null, 2));
									}
									setChartType(t);
								}}
							/>
							<HSComp.IconButton
								icon={<X />}
								aria-label="Close chart settings"
								onClick={() => setShowSettings(false)}
							/>
						</div>
						<ChartForm
							chartType={chartType}
							columns={columns}
							xField={xField}
							setXField={setXField}
							yFields={yFields}
							setYFields={setYFields}
							colorField={colorField}
							setColorField={setColorField}
							stack={stack}
							setStack={setStack}
							lineMode={lineMode}
							setLineMode={setLineMode}
							multiMeasure={multiMeasure}
							rawSpec={rawSpec}
							setRawSpec={setRawSpec}
						/>
					</div>
				</HSComp.ResizablePanel>
			</HSComp.ResizablePanelGroup>
		</div>
	);
}
