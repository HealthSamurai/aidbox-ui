import { defaultToastPlacement } from "@aidbox-ui/components/config";
import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import type { AidboxClientR5 } from "../../AidboxClient";
import * as ApiUtils from "../../api/utils";
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

const Field = ({
	label,
	required,
	hint,
	htmlFor,
	children,
}: {
	label: string;
	required?: boolean;
	hint?: React.ReactNode;
	htmlFor?: string;
	children: React.ReactNode;
}) => (
	<div className="flex flex-col gap-1">
		<label
			htmlFor={htmlFor}
			className="text-xs font-medium text-text-secondary"
		>
			{label}
			{required ? <span className="text-text-danger ml-0.5">*</span> : null}
		</label>
		{children}
		{hint ? <div className="text-xs text-text-tertiary">{hint}</div> : null}
	</div>
);

const splitTokens = (s: string): string[] =>
	s
		.split(/[\s,]+/)
		.map((x) => x.trim())
		.filter(Boolean);

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

	return (
		<div className="p-4 flex flex-col gap-6 max-w-3xl">
			{!onResourceChange && (
				<div className="text-xs text-text-tertiary">
					Editing disabled — no resource setter is wired.
				</div>
			)}

			<section className="flex flex-col gap-3">
				<h3 className="text-sm font-semibold">Identification</h3>

				<Field label="URL" required htmlFor="sp-url">
					<HSComp.Input
						id="sp-url"
						value={sp.url ?? ""}
						placeholder="http://example.org/SearchParameter/Patient-name"
						onChange={(e) => update({ url: e.target.value })}
					/>
				</Field>

				<div className="grid grid-cols-2 gap-3">
					<Field label="Name" required htmlFor="sp-name">
						<HSComp.Input
							id="sp-name"
							value={sp.name ?? ""}
							placeholder="name"
							onChange={(e) => update({ name: e.target.value })}
						/>
					</Field>

					<Field
						label="Code"
						required
						htmlFor="sp-code"
						hint="The code used in the search URL: ?<code>=…"
					>
						<HSComp.Input
							id="sp-code"
							value={sp.code ?? ""}
							placeholder="name"
							onChange={(e) => update({ code: e.target.value })}
						/>
					</Field>
				</div>

				<div className="grid grid-cols-2 gap-3">
					<Field label="Status" required>
						<HSComp.Select
							value={sp.status ?? ""}
							onValueChange={(v) =>
								update({ status: v as SearchParameterStatus })
							}
						>
							<HSComp.SelectTrigger className="w-full">
								<HSComp.SelectValue placeholder="Pick status" />
							</HSComp.SelectTrigger>
							<HSComp.SelectContent>
								{STATUS_OPTIONS.map((s) => (
									<HSComp.SelectItem key={s} value={s}>
										{s}
									</HSComp.SelectItem>
								))}
							</HSComp.SelectContent>
						</HSComp.Select>
					</Field>

					<Field label="Version" htmlFor="sp-version">
						<HSComp.Input
							id="sp-version"
							value={sp.version ?? ""}
							placeholder="1.0.0"
							onChange={(e) => update({ version: e.target.value })}
						/>
					</Field>
				</div>

				<Field label="Description" required htmlFor="sp-description">
					<HSComp.Textarea
						id="sp-description"
						value={sp.description ?? ""}
						rows={3}
						placeholder="What this search parameter does."
						onChange={(e) => update({ description: e.target.value })}
					/>
				</Field>
			</section>

			<section className="flex flex-col gap-3">
				<h3 className="text-sm font-semibold">Definition</h3>

				<div className="grid grid-cols-2 gap-3">
					<Field label="Type" required>
						<HSComp.Select
							value={sp.type ?? ""}
							onValueChange={(v) => update({ type: v as SearchParameterType })}
						>
							<HSComp.SelectTrigger className="w-full">
								<HSComp.SelectValue placeholder="Pick type" />
							</HSComp.SelectTrigger>
							<HSComp.SelectContent>
								{TYPE_OPTIONS.map((t) => (
									<HSComp.SelectItem key={t} value={t}>
										{t}
									</HSComp.SelectItem>
								))}
							</HSComp.SelectContent>
						</HSComp.Select>
					</Field>

					<Field
						label="Base"
						required
						htmlFor="sp-base"
						hint="Resource types this parameter applies to. Comma-separated."
					>
						<HSComp.Input
							id="sp-base"
							value={(sp.base ?? []).join(", ")}
							placeholder="Patient, Practitioner"
							onChange={(e) => update({ base: splitTokens(e.target.value) })}
						/>
					</Field>
				</div>

				<Field
					label="Expression"
					htmlFor="sp-expression"
					hint="FHIRPath expression that extracts the value to index, e.g. Patient.name"
				>
					<HSComp.Textarea
						id="sp-expression"
						value={sp.expression ?? ""}
						rows={2}
						placeholder="Patient.name"
						onChange={(e) => update({ expression: e.target.value })}
						className="font-mono text-xs"
					/>
				</Field>

				{isReference && (
					<Field
						label="Target"
						htmlFor="sp-target"
						hint="Allowed referenced resource types (only for type = reference). Comma-separated."
					>
						<HSComp.Input
							id="sp-target"
							value={(sp.target ?? []).join(", ")}
							placeholder="Patient, Group"
							onChange={(e) => update({ target: splitTokens(e.target.value) })}
						/>
					</Field>
				)}
			</section>

			<section className="flex flex-col gap-3">
				<h3 className="text-sm font-semibold">Optional</h3>

				<div className="flex items-center gap-2">
					<HSComp.Checkbox
						id="sp-experimental"
						checked={Boolean(sp.experimental)}
						onCheckedChange={(v) => update({ experimental: v === true })}
					/>
					<label htmlFor="sp-experimental" className="text-sm">
						Experimental
					</label>
				</div>

				<div className="grid grid-cols-2 gap-3">
					<Field
						label="XPath"
						htmlFor="sp-xpath"
						hint="Legacy XPath expression."
					>
						<HSComp.Input
							id="sp-xpath"
							value={sp.xpath ?? ""}
							placeholder="f:Patient/f:name"
							onChange={(e) => update({ xpath: e.target.value })}
						/>
					</Field>

					<Field label="XPath usage">
						<HSComp.Select
							value={sp.xpathUsage ?? ""}
							onValueChange={(v) => update({ xpathUsage: v as XPathUsage })}
						>
							<HSComp.SelectTrigger className="w-full">
								<HSComp.SelectValue placeholder="(none)" />
							</HSComp.SelectTrigger>
							<HSComp.SelectContent>
								{XPATH_USAGE_OPTIONS.map((u) => (
									<HSComp.SelectItem key={u} value={u}>
										{u}
									</HSComp.SelectItem>
								))}
							</HSComp.SelectContent>
						</HSComp.Select>
					</Field>
				</div>
			</section>
		</div>
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
