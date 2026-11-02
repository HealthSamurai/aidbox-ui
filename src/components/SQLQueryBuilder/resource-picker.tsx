import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import {
	ArrowLeftRight,
	ChevronDown,
	FileCode2,
	Info,
	Layers,
	ListChecks,
	type LucideIcon,
	Table,
} from "lucide-react";
import * as React from "react";
import { useAidboxClient } from "../../AidboxClient";
import { type CanonicalResource, resolveCanonical } from "./canonical-resolver";
import { isTerminologyKind, type TerminologyKind } from "./terminology";
import {
	SQL_QUERY_TYPE_CODE,
	SQL_QUERY_TYPE_SYSTEM,
	SQL_VIEW_TYPE_CODE,
	sqlLibraryKind,
} from "./types";

export type CandidateKind =
	| "ViewDefinition"
	| "SQLQuery"
	| "SQLView"
	| TerminologyKind;

const KIND_META: Record<
	CandidateKind,
	{ label: string; icon: LucideIcon; accent: string }
> = {
	ViewDefinition: {
		label: "VIEW",
		icon: Table,
		accent: "text-text-info-primary",
	},
	SQLQuery: {
		label: "SQLQuery",
		icon: FileCode2,
		accent: "text-text-warning-primary",
	},
	SQLView: {
		label: "SQLView",
		icon: Layers,
		accent: "text-text-success-primary",
	},
	ValueSet: {
		label: "ValueSet",
		icon: ListChecks,
		accent: "text-text-secondary",
	},
	ConceptMap: {
		label: "ConceptMap",
		icon: ArrowLeftRight,
		accent: "text-text-secondary",
	},
};

const ALL_KINDS: CandidateKind[] = [
	"ViewDefinition",
	"SQLQuery",
	"SQLView",
	"ValueSet",
	"ConceptMap",
];

// Packages bring ValueSets and ConceptMaps by the thousand: list a page of
// them and let the search narrow it down.
const TERMINOLOGY_PAGE = "50";
const TERMINOLOGY_ELEMENTS = "id,url,name,title,description,meta";

const SQL_QUERY_TYPE_TOKEN = `${SQL_QUERY_TYPE_SYSTEM}|${SQL_QUERY_TYPE_CODE}`;
const SQL_VIEW_TYPE_TOKEN = `${SQL_QUERY_TYPE_SYSTEM}|${SQL_VIEW_TYPE_CODE}`;

const SEARCHES: Record<CandidateKind, [string, Array<[string, string]>]> = {
	ViewDefinition: ["/fhir/ViewDefinition", [["_count", "1000"]]],
	SQLQuery: [
		"/fhir/Library",
		[
			["_count", "1000"],
			["type", SQL_QUERY_TYPE_TOKEN],
		],
	],
	SQLView: [
		"/fhir/Library",
		[
			["_count", "1000"],
			["type", SQL_VIEW_TYPE_TOKEN],
		],
	],
	ValueSet: [
		"/fhir/ValueSet",
		[
			["_count", TERMINOLOGY_PAGE],
			["_elements", TERMINOLOGY_ELEMENTS],
		],
	],
	ConceptMap: [
		"/fhir/ConceptMap",
		[
			["_count", TERMINOLOGY_PAGE],
			["_elements", TERMINOLOGY_ELEMENTS],
		],
	],
};

const GROUPS: Array<{ heading: string; kinds: CandidateKind[] }> = [
	{
		heading: "Views and queries",
		kinds: ["ViewDefinition", "SQLQuery", "SQLView"],
	},
	{ heading: "ValueSets", kinds: ["ValueSet"] },
	{ heading: "ConceptMaps", kinds: ["ConceptMap"] },
];

type RelatedArtifactRef = { url: string; label?: string };

type CandidateOption = {
	url: string;
	kind: CandidateKind;
	id: string;
	name?: string;
	title?: string;
	description?: string;
	resource?: string;
	relatedArtifacts?: RelatedArtifactRef[];
	createdAt?: string;
};

type RawCandidate = {
	id: string;
	url: string;
	name?: string;
	title?: string;
	description?: string;
	resource?: string;
	relatedArtifact?: Array<{
		type?: string;
		label?: string;
		resource?: string;
	}>;
	meta?: {
		lastUpdated?: string;
		extension?: Array<{ url?: string; valueInstant?: string }>;
	};
};

function extractCreatedAt(r: RawCandidate): string | undefined {
	const ext = r.meta?.extension;
	if (!ext) return undefined;
	for (const e of ext) {
		if (e.valueInstant) return e.valueInstant;
	}
	return undefined;
}

function kindFromUrl(url: string): CandidateKind | undefined {
	if (url.includes("/ViewDefinition/")) return "ViewDefinition";
	if (url.includes("/ValueSet/")) return "ValueSet";
	if (url.includes("/ConceptMap/")) return "ConceptMap";
	return undefined;
}

function toCandidate(r: RawCandidate, kind: CandidateKind): CandidateOption {
	const relatedArtifacts = (r.relatedArtifact ?? []).flatMap((ra) =>
		ra.resource ? [{ url: ra.resource, label: ra.label }] : [],
	);
	return {
		url: r.url,
		kind,
		id: r.id,
		name: r.name,
		title: r.title,
		description: r.description,
		resource: kind === "ViewDefinition" ? r.resource : undefined,
		relatedArtifacts:
			relatedArtifacts.length > 0 ? relatedArtifacts : undefined,
		createdAt: extractCreatedAt(r),
	};
}

function Badge({ text, accentClass }: { text: string; accentClass: string }) {
	return (
		<span
			className={`shrink-0 text-[11px] leading-4 normal-case whitespace-nowrap ${accentClass}`}
		>
			#{text}
		</span>
	);
}

function useDebouncedValue<T>(value: T, delay: number): T {
	const [v, setV] = React.useState(value);
	React.useEffect(() => {
		const id = setTimeout(() => setV(value), delay);
		return () => clearTimeout(id);
	}, [value, delay]);
	return v;
}

function useCandidates(
	search: string,
	enabled: boolean,
	kinds: CandidateKind[],
) {
	const client = useAidboxClient();
	const debouncedSearch = useDebouncedValue(search, 200);
	const kindsKey = kinds.slice().sort().join(",");
	return useQuery<CandidateOption[]>({
		queryKey: ["sqlquery-depends-on-candidates", debouncedSearch, kindsKey],
		enabled: enabled && kinds.length > 0,
		queryFn: async () => {
			const baseParams: Array<[string, string]> = [
				["url:missing", "false"],
				["_sort", "-_createdAt"],
			];
			if (debouncedSearch) baseParams.push(["_ilike", debouncedSearch]);
			const results = await Promise.all(
				kinds.map(async (kind) => {
					const [url, params] = SEARCHES[kind];
					const res = await client.request<Bundle>({
						method: "GET",
						url,
						params: [...baseParams, ...params],
					});
					if (res.isErr()) return [];
					return (res.value.resource.entry ?? []).map((e) =>
						toCandidate(e.resource as unknown as RawCandidate, kind),
					);
				}),
			);
			const seen = new Set<string>();
			const out = results.flat().filter((c) => {
				if (seen.has(c.url)) return false;
				seen.add(c.url);
				return true;
			});
			out.sort((a, b) => {
				const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
				const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
				return db - da;
			});
			return out;
		},
	});
}

function candidateKindOf(r: CanonicalResource): CandidateKind {
	if (r.resourceType !== "Library") return r.resourceType;
	const lib = r as Parameters<typeof sqlLibraryKind>[0];
	return sqlLibraryKind(lib) === "sql-view" ? "SQLView" : "SQLQuery";
}

// ValueSets and ConceptMaps are listed a page at a time, so a selected one may
// be missing from the listings and is resolved by its canonical instead. The
// lookups of all pickers on the page are batched into a single request.
function useSelectedCanonical(
	value: string | undefined,
	listedCandidate: CandidateOption | undefined,
	kinds: CandidateKind[],
): { kind?: CandidateKind; label?: string } {
	const client = useAidboxClient();
	const lookup = !!value && !listedCandidate && kinds.some(isTerminologyKind);
	const { data } = useQuery({
		queryKey: ["sqlquery-depends-on-canonical-resolve", value],
		enabled: lookup,
		queryFn: async () => {
			const r = await resolveCanonical(client, value ?? "");
			if (!r) return null;
			return {
				kind: candidateKindOf(r),
				label: r.title || r.name || undefined,
			};
		},
	});
	if (listedCandidate) {
		return {
			kind: listedCandidate.kind,
			label: listedCandidate.title || listedCandidate.name,
		};
	}
	return lookup ? { kind: data?.kind, label: data?.label } : {};
}

function CandidateItem({
	candidate: c,
	lookupByUrl,
	onSelect,
}: {
	candidate: CandidateOption;
	lookupByUrl: (url: string) => CandidateOption | undefined;
	onSelect: () => void;
}) {
	const meta = KIND_META[c.kind];
	const Icon = meta.icon;
	const badges: React.ReactNode[] = [];
	if (c.resource) {
		badges.push(
			<Badge
				key="resource"
				text={c.resource}
				accentClass="text-text-success-primary"
			/>,
		);
	}
	for (const ra of c.relatedArtifacts ?? []) {
		const linked = lookupByUrl(ra.url);
		const linkedKind = linked?.kind ?? kindFromUrl(ra.url) ?? "SQLQuery";
		badges.push(
			<Badge
				key={ra.url}
				text={linked?.title ?? linked?.name ?? ra.label ?? ra.url}
				accentClass={KIND_META[linkedKind].accent}
			/>,
		);
	}
	return (
		<HSComp.CommandItem value={c.url} onSelect={onSelect}>
			<div className="flex flex-col min-w-0">
				<div
					className={`flex items-center gap-1.5 typo-label-tiny uppercase tracking-wide ${meta.accent}`}
				>
					<Icon className="size-3.5 shrink-0" />
					<span>{meta.label}</span>
				</div>
				<div className="typo-body text-text-primary truncate first-letter:uppercase mt-0.5">
					{c.title || c.name || c.id}
				</div>
				{isTerminologyKind(c.kind) && (
					<div className="font-mono text-[11px] leading-4 text-text-tertiary truncate">
						{c.url}
					</div>
				)}
				{c.description && (
					<div className="typo-body-xs text-text-secondary mt-0.5 line-clamp-1">
						{c.description}
					</div>
				)}
				{badges.length > 0 && (
					<div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2">{badges}</div>
				)}
			</div>
		</HSComp.CommandItem>
	);
}

export function ResourcePicker({
	value,
	onChange,
	className,
	kinds = ALL_KINDS,
	placeholder,
}: {
	value: string | undefined;
	/** `kind` lets a caller derive a field that has to agree with the target. */
	onChange: (reference: string, kind: CandidateKind) => void;
	className?: string;
	kinds?: CandidateKind[];
	placeholder?: string;
}) {
	const [open, setOpen] = React.useState(false);
	const [search, setSearch] = React.useState("");
	const { data: candidates = [] } = useCandidates(search, open, kinds);
	const listedKinds = kinds.filter((k) => !isTerminologyKind(k));
	const { data: allCandidates = [] } = useCandidates("", true, listedKinds);
	const commandRef = React.useRef<HTMLDivElement>(null);
	const lookupByUrl = React.useMemo(() => {
		const map = new Map<string, CandidateOption>();
		for (const c of allCandidates) map.set(c.url, c);
		for (const c of candidates) map.set(c.url, c);
		return (url: string) => map.get(url);
	}, [allCandidates, candidates]);

	const listedCandidate = value ? lookupByUrl(value) : undefined;
	const { kind: selectedKind, label: selectedLabel } = useSelectedCanonical(
		value,
		listedCandidate,
		kinds,
	);
	const selectedMeta = selectedKind ? KIND_META[selectedKind] : undefined;

	React.useEffect(() => {
		if (!open) return;
		const id = requestAnimationFrame(() => {
			const list = commandRef.current?.querySelector<HTMLElement>(
				'[data-slot="command-list"]',
			);
			if (list) list.scrollLeft = 0;
		});
		return () => cancelAnimationFrame(id);
	}, [open]);

	return (
		<HSComp.Popover open={open} onOpenChange={setOpen}>
			<HSComp.PopoverTrigger asChild>
				<HSComp.Button
					variant="ghost"
					size="small"
					className={`h-7 px-2 justify-between font-mono text-xs bg-bg-primary hover:bg-bg-quaternary group-hover/tree-item-label:bg-bg-tertiary w-full ${value ? "text-text-primary! hover:text-text-primary!" : ""} ${className ?? ""}`}
					onClick={(e) => e.stopPropagation()}
				>
					{selectedMeta && (
						<span
							className={`shrink-0 flex items-center gap-1 font-mono text-xs uppercase ${selectedMeta.accent}`}
						>
							<selectedMeta.icon size={14} className="shrink-0" />
							<span className="w-[10ch] shrink-0 text-left">
								{selectedMeta.label}
							</span>
						</span>
					)}
					{selectedLabel && (
						<span className="shrink-0 pl-2 text-left font-sans text-xs font-medium text-text-primary">
							{selectedLabel}
						</span>
					)}
					<span
						className={`flex-1 min-w-0 pl-2 text-left truncate ${value ? "text-text-tertiary" : "text-text-tertiary"}`}
					>
						{value || placeholder || "Select view, query or terminology…"}
					</span>
					<ChevronDown className="size-4 shrink-0 opacity-50" />
				</HSComp.Button>
			</HSComp.PopoverTrigger>
			<HSComp.PopoverContent className="w-[640px] p-0" align="start">
				<div ref={commandRef}>
					<HSComp.Command shouldFilter={false}>
						<HSComp.CommandInput
							placeholder="Search views, queries, ValueSets, ConceptMaps…"
							value={search}
							onValueChange={setSearch}
						/>
						<HSComp.CommandList>
							<HSComp.CommandEmpty>
								<div className="flex flex-col items-start gap-2 px-4 py-4 normal-case">
									<span className="typo-body text-text-primary">
										No matches
									</span>
									<div className="flex items-start gap-1.5 text-left typo-body-xs text-text-secondary normal-case">
										<Info className="size-3.5 shrink-0 mt-0.5 text-text-tertiary" />
										<span>
											Only resources with a defined{" "}
											<span className="font-mono text-text-primary">url</span>{" "}
											are listed — references rely on canonical URLs.
										</span>
									</div>
								</div>
							</HSComp.CommandEmpty>
							{GROUPS.map((group) => {
								const items = candidates.filter((c) =>
									group.kinds.includes(c.kind),
								);
								if (items.length === 0) return null;
								return (
									<HSComp.CommandGroup
										key={group.heading}
										heading={group.heading}
									>
										{items.map((c) => (
											<CandidateItem
												key={c.url}
												candidate={c}
												lookupByUrl={lookupByUrl}
												onSelect={() => {
													onChange(c.url, c.kind);
													setOpen(false);
												}}
											/>
										))}
									</HSComp.CommandGroup>
								);
							})}
						</HSComp.CommandList>
					</HSComp.Command>
				</div>
			</HSComp.PopoverContent>
		</HSComp.Popover>
	);
}
