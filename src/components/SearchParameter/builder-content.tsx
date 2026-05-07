import { defaultToastPlacement } from "@aidbox-ui/components/config";
import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import { useEffect, useState } from "react";
import type { AidboxClientR5 } from "../../AidboxClient";
import * as ApiUtils from "../../api/utils";
import { useDebounce } from "../../hooks";
import { FhirPathInput } from "../ViewDefinition/fhirpath-input";
import { FhirPathLspProvider } from "../ViewDefinition/fhirpath-lsp-context";
import { rpcCall, SuggestIndexButton } from "./suggest-index";

type SearchParameterStatus = "draft" | "active" | "retired" | "unknown";
type SearchParameterType =
	| "number"
	| "date"
	| "string"
	| "token"
	| "reference"
	| "composite"
	| "quantity"
	| "uri"
	| "special";
type XPathUsage = "normal" | "phonetic" | "nearby" | "distance" | "other";

type SearchParameterResource = Resource & {
	code?: string;
	base?: string[];
	name?: string;
	description?: string;
	status?: SearchParameterStatus;
	type?: SearchParameterType;
	url?: string;
	expression?: string;
	target?: string[];
	version?: string;
	experimental?: boolean;
	xpath?: string;
	xpathUsage?: XPathUsage;
};

const STATUS_OPTIONS: SearchParameterStatus[] = [
	"draft",
	"active",
	"retired",
	"unknown",
];

const TYPE_OPTIONS: SearchParameterType[] = [
	"string",
	"token",
	"reference",
	"date",
	"number",
	"quantity",
	"uri",
	"composite",
	"special",
];

const XPATH_USAGE_OPTIONS: XPathUsage[] = [
	"normal",
	"phonetic",
	"nearby",
	"distance",
	"other",
];

const splitTokens = (s: string): string[] =>
	s
		.split(/[\s,]+/)
		.map((x) => x.trim())
		.filter(Boolean);

/**
 * Section header rendered as an uppercase badge — matches the
 * `properties` / `select` / `where` headers in the VD builder tree.
 */
const SectionHeader = ({ label }: { label: string }) => (
	<div className="flex items-center gap-2 px-2 pt-3 pb-1 first:pt-0">
		<span className="uppercase text-text-info-primary text-xs font-medium px-1">
			{label}
		</span>
	</div>
);

/**
 * Row with a colored badge label on the left and an editor on the right.
 * Mirrors the VD builder's tree-row style (e.g. `name`, `status` rows).
 */
const Row = ({
	label,
	required,
	hint,
	children,
}: {
	label: string;
	required?: boolean;
	hint?: React.ReactNode;
	children: React.ReactNode;
}) => (
	<div className="group/tree-item-label flex w-full items-start gap-2 px-2 py-1 hover:bg-bg-tertiary rounded-md transition-colors">
		<span
			className={`uppercase px-1.5 py-0.5 rounded-md text-xs font-medium shrink-0 mt-0.5 min-w-[140px] ${
				required
					? "text-text-info-primary bg-bg-info-primary"
					: "text-text-secondary bg-bg-secondary"
			}`}
		>
			{label}
		</span>
		<div className="flex-1 min-w-0 flex flex-col gap-1">
			{children}
			{hint ? <div className="text-xs text-text-tertiary">{hint}</div> : null}
		</div>
	</div>
);

/** Debounced single-line input, styled to match VD's `InputView`. */
const InlineInput = ({
	id,
	value,
	placeholder,
	onChange,
	className,
}: {
	id?: string;
	value?: string;
	placeholder?: string;
	onChange: (v: string) => void;
	className?: string;
}) => {
	const [localValue, setLocalValue] = useState(value || "");
	useEffect(() => {
		setLocalValue(value || "");
	}, [value]);
	const debouncedOnChange = useDebounce((newValue: string) => {
		if (newValue !== value) onChange(newValue);
	}, 400);
	return (
		<HSComp.Input
			id={id}
			value={localValue}
			placeholder={placeholder}
			className={`h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary ${className ?? ""}`}
			onChange={(e) => {
				setLocalValue(e.target.value);
				debouncedOnChange(e.target.value);
			}}
		/>
	);
};

/** Debounced multi-line input, same color treatment as InlineInput. */
const InlineTextarea = ({
	id,
	value,
	placeholder,
	onChange,
	rows = 2,
	className,
}: {
	id?: string;
	value?: string;
	placeholder?: string;
	onChange: (v: string) => void;
	rows?: number;
	className?: string;
}) => {
	const [localValue, setLocalValue] = useState(value || "");
	useEffect(() => {
		setLocalValue(value || "");
	}, [value]);
	const debouncedOnChange = useDebounce((newValue: string) => {
		if (newValue !== value) onChange(newValue);
	}, 400);
	return (
		<HSComp.Textarea
			id={id}
			value={localValue}
			rows={rows}
			placeholder={placeholder}
			className={`py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary ${className ?? ""}`}
			onChange={(e) => {
				setLocalValue(e.target.value);
				debouncedOnChange(e.target.value);
			}}
		/>
	);
};

const InlineSelect = <T extends string>({
	value,
	options,
	placeholder,
	onChange,
}: {
	value?: T;
	options: readonly T[];
	placeholder: string;
	onChange: (v: T) => void;
}) => (
	<HSComp.Select value={value ?? ""} onValueChange={(v) => onChange(v as T)}>
		<HSComp.SelectTrigger className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary w-full">
			<HSComp.SelectValue placeholder={placeholder} />
		</HSComp.SelectTrigger>
		<HSComp.SelectContent>
			{options.map((opt) => (
				<HSComp.SelectItem key={opt} value={opt}>
					{opt}
				</HSComp.SelectItem>
			))}
		</HSComp.SelectContent>
	</HSComp.Select>
);

const BuilderTab = ({
	resource,
	onResourceChange,
}: {
	resource: Resource;
	onResourceChange?: (next: Resource) => void;
}) => {
	const sp = resource as SearchParameterResource;
	const update = (patch: Partial<SearchParameterResource>) => {
		if (!onResourceChange) return;
		// Strip keys whose new value is "" / undefined / [] so the JSON stays clean.
		const next: Record<string, unknown> = {
			...(resource as unknown as Record<string, unknown>),
			...patch,
		};
		for (const [k, v] of Object.entries(patch)) {
			if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) {
				delete next[k];
			}
		}
		onResourceChange(next as unknown as Resource);
	};

	const isReference = sp.type === "reference";
	const fhirPathContext = sp.base?.[0] ?? "";

	return (
		<FhirPathLspProvider resourceType={fhirPathContext || undefined}>
			<div className="p-4 flex flex-col gap-1 max-w-3xl">
				{!onResourceChange && (
					<div className="text-xs text-text-tertiary px-2 pb-2">
						Editing disabled — no resource setter is wired.
					</div>
				)}

				<SectionHeader label="properties" />

				<Row label="url" required>
					<InlineInput
						id="sp-url"
						value={sp.url}
						placeholder="http://example.org/SearchParameter/Patient-name"
						onChange={(v) => update({ url: v })}
					/>
				</Row>

				<Row label="name" required>
					<InlineInput
						id="sp-name"
						value={sp.name}
						placeholder="name"
						onChange={(v) => update({ name: v })}
					/>
				</Row>

				<Row
					label="code"
					required
					hint="The code used in the search URL: ?<code>=…"
				>
					<InlineInput
						id="sp-code"
						value={sp.code}
						placeholder="name"
						onChange={(v) => update({ code: v })}
					/>
				</Row>

				<Row label="status" required>
					<InlineSelect
						value={sp.status}
						options={STATUS_OPTIONS}
						placeholder="Pick status"
						onChange={(v) => update({ status: v })}
					/>
				</Row>

				<Row label="description" required>
					<InlineTextarea
						id="sp-description"
						value={sp.description}
						placeholder="What this search parameter does."
						rows={3}
						onChange={(v) => update({ description: v })}
					/>
				</Row>

				<SectionHeader label="definition" />

				<Row label="type" required>
					<InlineSelect
						value={sp.type}
						options={TYPE_OPTIONS}
						placeholder="Pick type"
						onChange={(v) => update({ type: v })}
					/>
				</Row>

				<Row
					label="base"
					required
					hint="Resource types this parameter applies to. Comma-separated."
				>
					<InlineInput
						id="sp-base"
						value={(sp.base ?? []).join(", ")}
						placeholder="Patient, Practitioner"
						onChange={(v) => update({ base: splitTokens(v) })}
					/>
				</Row>

				<Row
					label="expression"
					hint={
						fhirPathContext
							? `FHIRPath context: ${fhirPathContext}`
							: "Set 'base' to enable FHIRPath autocomplete."
					}
				>
					<FhirPathInput
						id="sp-expression"
						value={sp.expression}
						placeholder={
							fhirPathContext ? `${fhirPathContext}.name` : "Patient.name"
						}
						contextPath={fhirPathContext}
						onChange={(v) => update({ expression: v })}
					/>
				</Row>

				{isReference && (
					<Row
						label="target"
						hint="Allowed referenced resource types (when type = reference). Comma-separated."
					>
						<InlineInput
							id="sp-target"
							value={(sp.target ?? []).join(", ")}
							placeholder="Patient, Group"
							onChange={(v) => update({ target: splitTokens(v) })}
						/>
					</Row>
				)}

				<SectionHeader label="optional" />

				<Row label="version">
					<InlineInput
						id="sp-version"
						value={sp.version}
						placeholder="1.0.0"
						onChange={(v) => update({ version: v })}
					/>
				</Row>

				<Row label="experimental">
					<div className="flex items-center h-7">
						<HSComp.Checkbox
							id="sp-experimental"
							checked={Boolean(sp.experimental)}
							onCheckedChange={(v) => update({ experimental: v === true })}
						/>
					</div>
				</Row>

				<Row label="xpath" hint="Legacy XPath expression.">
					<InlineInput
						id="sp-xpath"
						value={sp.xpath}
						placeholder="f:Patient/f:name"
						onChange={(v) => update({ xpath: v })}
					/>
				</Row>

				<Row label="xpath usage">
					<InlineSelect
						value={sp.xpathUsage}
						options={XPATH_USAGE_OPTIONS}
						placeholder="(none)"
						onChange={(v) => update({ xpathUsage: v })}
					/>
				</Row>
			</div>
		</FhirPathLspProvider>
	);
};

type ShapeRow = {
	resource_type: string;
	search_params: string[];
	calls: number;
	total_time_ms: number;
	min_time_ms: number | null;
	max_time_ms: number | null;
	mean_time_ms: number;
	last_used_at: string | null;
};

function formatCount(n: number): string {
	return n.toLocaleString();
}

function formatMs(ms: number | null | undefined): string {
	if (ms == null) return "—";
	if (ms < 1) return ms.toFixed(2);
	if (ms < 100) return ms.toFixed(1);
	return Math.round(ms).toString();
}

function formatRelativeTime(iso: string | null | undefined): string {
	if (!iso) return "—";
	const t = Date.parse(iso);
	if (Number.isNaN(t)) return "—";
	const diff = Date.now() - t;
	const sec = Math.floor(diff / 1000);
	if (sec < 5) return "just now";
	if (sec < 60) return `${sec}s ago`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hr = Math.floor(min / 60);
	if (hr < 24) return `${hr}h ago`;
	const day = Math.floor(hr / 24);
	if (day < 30) return `${day}d ago`;
	return new Date(t).toISOString().slice(0, 10);
}

export const StatsTab = ({
	client,
	base,
	code,
}: {
	client: AidboxClientR5;
	base: string;
	code: string;
}) => {
	const queryClient = ReactQuery.useQueryClient();
	const queryKey = ["search-parameter-builder/shapes", base, code] as const;

	const shapesQuery = ReactQuery.useQuery({
		queryKey,
		enabled: Boolean(base && code),
		queryFn: async () => {
			const json = await rpcCall(
				client,
				"aidbox.index/get-search-param-stats",
				{
					"resource-type": base,
					"search-param": code,
					by: "shape",
					limit: 200,
					"flush-first": true,
				},
			);
			return (json.result ?? []) as ShapeRow[];
		},
		retry: false,
	});

	const resetMutation = ReactQuery.useMutation({
		mutationFn: async () => {
			await rpcCall(client, "aidbox.index/reset-search-param-stats", {
				"resource-type": base,
				"search-param": code,
			});
		},
		onSuccess: () => {
			HSComp.toast.success(
				`Reset stats for ${base}.${code}`,
				defaultToastPlacement,
			);
			queryClient.invalidateQueries({ queryKey });
		},
		onError: ApiUtils.onMutationError,
	});

	if (!base || !code) {
		return (
			<div className="p-4 text-text-secondary text-sm">
				Stats require both <code>base</code> and <code>code</code> on the
				SearchParameter resource.
			</div>
		);
	}

	const shapes = shapesQuery.data ?? [];
	const totalCalls = shapes.reduce((acc, s) => acc + s.calls, 0);

	return (
		<div className="flex flex-col gap-3 p-4 h-full overflow-auto">
			<div className="flex items-center gap-2">
				<div className="text-sm text-text-secondary grow">
					{shapesQuery.isLoading
						? "Loading…"
						: `${shapes.length} shape${shapes.length === 1 ? "" : "s"} · ${formatCount(totalCalls)} call${totalCalls === 1 ? "" : "s"}`}
				</div>
				<HSComp.Button
					variant="ghost"
					size="small"
					onClick={() => resetMutation.mutate()}
					disabled={resetMutation.isPending || shapes.length === 0}
				>
					<Lucide.RotateCcwIcon size={14} />
					Reset
				</HSComp.Button>
				<SuggestIndexButton
					client={client}
					resourceType={base}
					searchParam={code}
				/>
			</div>

			{shapesQuery.isError && (
				<div className="text-text-danger text-sm">
					{(shapesQuery.error as Error).message}
				</div>
			)}

			{!shapesQuery.isLoading && shapes.length === 0 && (
				<div className="text-text-secondary text-sm">
					No usage recorded yet. Issue a few searches that include{" "}
					<code>{code}</code> on <code>{base}</code> and stats will appear here.
				</div>
			)}

			{shapes.length > 0 && (
				<HSComp.Table zebra className="typo-code">
					<HSComp.TableHeader>
						<HSComp.TableRow>
							<HSComp.TableHead>Shape</HSComp.TableHead>
							<HSComp.TableHead className="w-0 text-right">
								Calls
							</HSComp.TableHead>
							<HSComp.TableHead className="w-0 text-right">
								Mean&nbsp;ms
							</HSComp.TableHead>
							<HSComp.TableHead className="w-0 text-right">
								Min
							</HSComp.TableHead>
							<HSComp.TableHead className="w-0 text-right">
								Max
							</HSComp.TableHead>
							<HSComp.TableHead className="w-0 text-right">
								Total&nbsp;ms
							</HSComp.TableHead>
							<HSComp.TableHead className="w-0">Last used</HSComp.TableHead>
						</HSComp.TableRow>
					</HSComp.TableHeader>
					<HSComp.TableBody>
						{shapes.map((s, i) => (
							<HSComp.TableRow key={s.search_params.join("|")} zebra index={i}>
								<HSComp.TableCell>
									?{s.search_params.join("&")}
								</HSComp.TableCell>
								<HSComp.TableCell className="text-right tabular-nums">
									{formatCount(s.calls)}
								</HSComp.TableCell>
								<HSComp.TableCell className="text-right tabular-nums">
									{formatMs(s.mean_time_ms)}
								</HSComp.TableCell>
								<HSComp.TableCell className="text-right tabular-nums">
									{formatMs(s.min_time_ms)}
								</HSComp.TableCell>
								<HSComp.TableCell className="text-right tabular-nums">
									{formatMs(s.max_time_ms)}
								</HSComp.TableCell>
								<HSComp.TableCell className="text-right tabular-nums">
									{formatMs(s.total_time_ms)}
								</HSComp.TableCell>
								<HSComp.TableCell
									title={s.last_used_at ?? undefined}
									className="whitespace-nowrap"
								>
									{formatRelativeTime(s.last_used_at)}
								</HSComp.TableCell>
							</HSComp.TableRow>
						))}
					</HSComp.TableBody>
				</HSComp.Table>
			)}
		</div>
	);
};

export const SearchParameterBuilderContent = ({
	resource,
	onResourceChange,
}: {
	resource: Resource;
	onResourceChange?: (next: Resource) => void;
}) => {
	return (
		<HSComp.ResizablePanelGroup
			direction="horizontal"
			autoSaveId="search-parameter-builder"
			className="grow min-h-0"
		>
			<HSComp.ResizablePanel
				minSize={30}
				defaultSize={50}
				className="overflow-auto"
			>
				<BuilderTab resource={resource} onResourceChange={onResourceChange} />
			</HSComp.ResizablePanel>
			<HSComp.ResizableHandle />
			<HSComp.ResizablePanel minSize={20} defaultSize={50}>
				<div className="p-4 text-text-secondary text-sm h-full">
					Query runner — slice C.
				</div>
			</HSComp.ResizablePanel>
		</HSComp.ResizablePanelGroup>
	);
};
