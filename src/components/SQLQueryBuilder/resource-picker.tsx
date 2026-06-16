import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, FileCode2, Info, Layers, Table } from "lucide-react";
import * as React from "react";
import { useAidboxClient } from "../../AidboxClient";
import {
	SQL_QUERY_TYPE_CODE,
	SQL_QUERY_TYPE_SYSTEM,
	SQL_VIEW_TYPE_CODE,
} from "./types";

type CandidateKind = "ViewDefinition" | "SQLQuery" | "SQLView";

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

function Badge({ text, accentClass }: { text: string; accentClass: string }) {
	return (
		<span
			className={`shrink-0 text-[11px] leading-4 normal-case whitespace-nowrap ${accentClass}`}
		>
			#{text}
		</span>
	);
}

const SQL_QUERY_TYPE_TOKEN = `${SQL_QUERY_TYPE_SYSTEM}|${SQL_QUERY_TYPE_CODE}`;
const SQL_VIEW_TYPE_TOKEN = `${SQL_QUERY_TYPE_SYSTEM}|${SQL_VIEW_TYPE_CODE}`;

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
	enabled = true,
	kinds: CandidateKind[] = ["ViewDefinition", "SQLQuery", "SQLView"],
) {
	const client = useAidboxClient();
	const debouncedSearch = useDebouncedValue(search, 200);
	const kindsKey = kinds.slice().sort().join(",");
	return useQuery<CandidateOption[]>({
		queryKey: ["sqlquery-depends-on-candidates", debouncedSearch, kindsKey],
		enabled,
		queryFn: async () => {
			const baseParams: Array<[string, string]> = [
				["_count", "1000"],
				["url:missing", "false"],
				["_sort", "-_createdAt"],
			];
			if (debouncedSearch) baseParams.push(["_ilike", debouncedSearch]);
			const want = (k: CandidateKind) => kinds.includes(k);
			const [vd, sqlQueryLib, sqlViewLib] = await Promise.all([
				want("ViewDefinition")
					? client.request<Bundle>({
							method: "GET",
							url: "/fhir/ViewDefinition",
							params: baseParams,
						})
					: null,
				want("SQLQuery")
					? client.request<Bundle>({
							method: "GET",
							url: "/fhir/Library",
							params: [...baseParams, ["type", SQL_QUERY_TYPE_TOKEN]],
						})
					: null,
				want("SQLView")
					? client.request<Bundle>({
							method: "GET",
							url: "/fhir/Library",
							params: [...baseParams, ["type", SQL_VIEW_TYPE_TOKEN]],
						})
					: null,
			]);
			const out: CandidateOption[] = [];
			if (vd?.isOk()) {
				for (const entry of vd.value.resource.entry ?? []) {
					const r = entry.resource as unknown as RawCandidate;
					out.push({
						url: r.url,
						kind: "ViewDefinition",
						id: r.id,
						name: r.name,
						title: r.title,
						description: r.description,
						resource: r.resource,
						createdAt: extractCreatedAt(r),
					});
				}
			}
			for (const [res, kind] of [
				[sqlQueryLib, "SQLQuery"],
				[sqlViewLib, "SQLView"],
			] as const) {
				if (!res?.isOk()) continue;
				for (const entry of res.value.resource.entry ?? []) {
					const r = entry.resource as unknown as RawCandidate;
					const relatedArtifacts = (r.relatedArtifact ?? []).flatMap((ra) =>
						ra.resource ? [{ url: ra.resource, label: ra.label }] : [],
					);
					out.push({
						url: r.url,
						kind,
						id: r.id,
						name: r.name,
						title: r.title,
						description: r.description,
						relatedArtifacts:
							relatedArtifacts.length > 0 ? relatedArtifacts : undefined,
						createdAt: extractCreatedAt(r),
					});
				}
			}
			out.sort((a, b) => {
				const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
				const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
				return db - da;
			});
			return out;
		},
	});
}

export function ResourcePicker({
	value,
	onChange,
	className,
	kinds,
	placeholder,
}: {
	value: string | undefined;
	onChange: (reference: string) => void;
	className?: string;
	kinds?: CandidateKind[];
	placeholder?: string;
}) {
	const [open, setOpen] = React.useState(false);
	const [search, setSearch] = React.useState("");
	const { data: candidates = [] } = useCandidates(search, open, kinds);
	const { data: allCandidates = [] } = useCandidates("", open, kinds);
	const commandRef = React.useRef<HTMLDivElement>(null);
	const lookupByUrl = React.useMemo(() => {
		const map = new Map<string, CandidateOption>();
		for (const c of allCandidates) map.set(c.url, c);
		for (const c of candidates) map.set(c.url, c);
		return (url: string) => map.get(url);
	}, [allCandidates, candidates]);

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
					<span className={`truncate ${value ? "" : "text-text-tertiary"}`}>
						{value || placeholder || "Select view or query…"}
					</span>
					<ChevronDown className="size-4 shrink-0 opacity-50" />
				</HSComp.Button>
			</HSComp.PopoverTrigger>
			<HSComp.PopoverContent className="w-[640px] p-0" align="start">
				<div ref={commandRef}>
					<HSComp.Command shouldFilter={false}>
						<HSComp.CommandInput
							placeholder="Search view or query…"
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
											Only ViewDefinitions, SQLQueries and SQLViews with a
											defined{" "}
											<span className="font-mono text-text-primary">url</span>{" "}
											are listed — references rely on canonical URLs.
										</span>
									</div>
								</div>
							</HSComp.CommandEmpty>
							{candidates.map((c) => {
								const label = c.title || c.name || c.id;
								const isView = c.kind === "ViewDefinition";
								const Icon =
									c.kind === "ViewDefinition"
										? Table
										: c.kind === "SQLView"
											? Layers
											: FileCode2;
								const kindLabel = c.kind;
								const accentClass =
									c.kind === "ViewDefinition"
										? "text-text-info-primary"
										: c.kind === "SQLView"
											? "text-text-success-primary"
											: "text-text-warning-primary";
								const badges: React.ReactNode[] = [];
								if (isView && c.resource) {
									badges.push(
										<Badge
											key="resource"
											text={c.resource}
											accentClass="text-text-success-primary"
										/>,
									);
								}
								if (!isView && c.relatedArtifacts) {
									for (const ra of c.relatedArtifacts) {
										const linked = lookupByUrl(ra.url);
										const isLinkedView =
											linked?.kind === "ViewDefinition" ||
											ra.url.includes("/ViewDefinition/");
										badges.push(
											<Badge
												key={ra.url}
												text={
													linked?.title ?? linked?.name ?? ra.label ?? ra.url
												}
												accentClass={
													isLinkedView
														? "text-text-info-primary"
														: "text-text-warning-primary"
												}
											/>,
										);
									}
								}
								return (
									<HSComp.CommandItem
										key={c.url}
										value={c.url}
										onSelect={() => {
											onChange(c.url);
											setOpen(false);
										}}
									>
										<div className="flex flex-col min-w-0">
											<div
												className={`flex items-center gap-1.5 typo-label-tiny uppercase tracking-wide ${accentClass}`}
											>
												<Icon className="size-3.5 shrink-0" />
												<span>{kindLabel}</span>
											</div>
											<div className="typo-body text-text-primary truncate first-letter:uppercase mt-0.5">
												{label}
											</div>
											{c.description && (
												<div className="typo-body-xs text-text-secondary mt-0.5 line-clamp-1">
													{c.description}
												</div>
											)}
											{badges.length > 0 && (
												<div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2">
													{badges}
												</div>
											)}
										</div>
									</HSComp.CommandItem>
								);
							})}
						</HSComp.CommandList>
					</HSComp.Command>
				</div>
			</HSComp.PopoverContent>
		</HSComp.Popover>
	);
}
