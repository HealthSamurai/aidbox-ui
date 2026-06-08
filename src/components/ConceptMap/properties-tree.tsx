import * as HSComp from "@health-samurai/react-components";
import {
	type ItemInstance,
	TreeView,
	type TreeViewItem,
} from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Link2, Plus, X } from "lucide-react";
import * as React from "react";
import { useAidboxClient } from "../../AidboxClient";
import { useConceptMapContext } from "./context";
import type {
	ConceptMap,
	ConceptMapElement,
	ConceptMapGroup,
	ConceptMapTarget,
} from "./types";
import { isR4Like, useFhirServerVersion } from "./version";

type ItemMeta = {
	type:
		| "properties"
		| "url"
		| "version"
		| "status"
		| "title"
		| "description"
		| "source"
		| "target"
		| "groups"
		| "group-row"
		| "group-add"
		| "elements-section"
		| "element-row"
		| "element-add"
		| "unmapped-row";
	groupIndex?: number;
	elementIndex?: number;
};

const STATUSES = ["draft", "active", "retired", "unknown"] as const;
type ConceptMapStatus = (typeof STATUSES)[number];

// R5+ ConceptMap.group.element.target.relationship value set
const RELATIONSHIPS_R5 = [
	"related-to",
	"equivalent",
	"source-is-narrower-than-target",
	"source-is-broader-than-target",
	"not-related-to",
] as const;

// R4/R4B ConceptMap.group.element.target.equivalence value set
const EQUIVALENCES_R4 = [
	"relatedto",
	"equivalent",
	"equal",
	"wider",
	"subsumes",
	"narrower",
	"specializes",
	"inexact",
	"unmatched",
	"disjoint",
] as const;

type CodeSystemHit = {
	id?: string;
	url?: string;
	name?: string;
	title?: string;
	version?: string;
	description?: string;
};

function parseSystemPipeVersion(raw: string): {
	system?: string;
	version?: string;
} {
	const pipe = raw.indexOf("|");
	if (pipe < 0) {
		const s = raw.trim();
		return { system: s || undefined, version: undefined };
	}
	const s = raw.slice(0, pipe).trim();
	const v = raw.slice(pipe + 1).trim();
	return { system: s || undefined, version: v || undefined };
}

function formatSystemPipeVersion(
	system: string | undefined,
	version: string | undefined,
): string {
	if (version) return `${system ?? ""}|${version}`;
	return system ?? "";
}

function CodeSystemPicker({
	system,
	version,
	onChange,
	placeholder = "CodeSystem canonical URL",
}: {
	system?: string;
	version?: string;
	onChange: (next: { system?: string; version?: string }) => void;
	placeholder?: string;
}) {
	const client = useAidboxClient();
	const formatted = formatSystemPipeVersion(system, version);
	const [local, setLocal] = React.useState(formatted);
	const [debounced, setDebounced] = React.useState(local);
	const [open, setOpen] = React.useState(false);
	const [activeIndex, setActiveIndex] = React.useState(-1);
	const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
	const inputRef = React.useRef<HTMLInputElement | null>(null);
	const measureRef = React.useRef<HTMLSpanElement | null>(null);
	const [inputWidthPx, setInputWidthPx] = React.useState(200);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps drive re-measurement of the span when text changes
	React.useLayoutEffect(() => {
		const input = inputRef.current;
		const span = measureRef.current;
		if (!input || !span) return;
		// Copy the real input's font + sizing onto the measuring span so the
		// measured width matches what's actually rendered inside the input.
		const cs = getComputedStyle(input);
		span.style.font = cs.font;
		span.style.fontFamily = cs.fontFamily;
		span.style.fontSize = cs.fontSize;
		span.style.fontWeight = cs.fontWeight;
		span.style.letterSpacing = cs.letterSpacing;
		const padX =
			Number.parseFloat(cs.paddingLeft) + Number.parseFloat(cs.paddingRight);
		const borderX =
			Number.parseFloat(cs.borderLeftWidth) +
			Number.parseFloat(cs.borderRightWidth);
		const caret = 2;
		const w = span.offsetWidth + padX + borderX + caret;
		setInputWidthPx(Math.max(200, Math.ceil(w)));
	}, [local, placeholder]);

	React.useEffect(() => {
		setLocal(formatted);
	}, [formatted]);

	React.useEffect(() => {
		const t = setTimeout(() => setDebounced(local), 250);
		return () => clearTimeout(t);
	}, [local]);

	const pipeIdx = debounced.indexOf("|");
	const mode: "system" | "version" = pipeIdx >= 0 ? "version" : "system";
	const systemPart =
		pipeIdx >= 0 ? debounced.slice(0, pipeIdx).trim() : debounced.trim();
	const versionPart = pipeIdx >= 0 ? debounced.slice(pipeIdx + 1).trim() : "";

	const { data: systemHits } = useQuery({
		queryKey: ["conceptmap-builder", "codesystem-picker", "system", systemPart],
		enabled: mode === "system",
		queryFn: async () => {
			const params = new URLSearchParams({
				_count: "15",
				_sort: "-_lastUpdated",
				_elements: "url,name,title,version,description",
			});
			if (systemPart) params.set("url:contains", systemPart);
			const res = await client.request<{
				entry?: Array<{ resource: CodeSystemHit }>;
			}>({
				method: "GET",
				url: `/fhir/CodeSystem?${params.toString()}`,
			});
			if (res.isErr()) return [];
			return (res.value.resource.entry ?? [])
				.map((e) => e.resource)
				.filter((r): r is CodeSystemHit & { url: string } => !!r.url);
		},
		staleTime: 30_000,
	});

	const { data: versionHits } = useQuery({
		queryKey: [
			"conceptmap-builder",
			"codesystem-picker",
			"versions",
			systemPart,
		],
		enabled: mode === "version" && systemPart.length > 0,
		queryFn: async () => {
			const params = new URLSearchParams({
				_count: "100",
				_sort: "-_lastUpdated",
				_elements: "url,name,title,version",
				url: systemPart,
			});
			const res = await client.request<{
				entry?: Array<{ resource: CodeSystemHit }>;
			}>({
				method: "GET",
				url: `/fhir/CodeSystem?${params.toString()}`,
			});
			if (res.isErr()) return [];
			const seen = new Set<string>();
			const out: Array<CodeSystemHit & { url: string; version: string }> = [];
			for (const e of res.value.resource.entry ?? []) {
				const r = e.resource;
				if (!r.url || !r.version) continue;
				if (seen.has(r.version)) continue;
				seen.add(r.version);
				out.push({ ...r, url: r.url, version: r.version });
			}
			return out;
		},
		staleTime: 30_000,
	});

	const commit = (raw: string) => {
		setLocal(raw);
		const parsed = parseSystemPipeVersion(raw);
		if (parsed.system !== system || parsed.version !== version) {
			onChange(parsed);
		}
	};

	const selectSystemHit = (h: CodeSystemHit & { url: string }) => {
		const next = { system: h.url, version: undefined };
		setLocal(formatSystemPipeVersion(next.system, next.version));
		onChange(next);
		setOpen(false);
		setActiveIndex(-1);
	};

	const selectVersionHit = (
		h: CodeSystemHit & { url: string; version: string },
	) => {
		const next = { system: systemPart || h.url, version: h.version };
		setLocal(formatSystemPipeVersion(next.system, next.version));
		onChange(next);
		setOpen(false);
		setActiveIndex(-1);
	};

	const hitsList =
		mode === "version"
			? (versionHits ?? []).filter(
					(h) => !versionPart || h.version.includes(versionPart),
				)
			: (systemHits ?? []);

	const onSelectActive = () => {
		const h = hitsList[activeIndex];
		if (!h) return;
		if (mode === "version") {
			selectVersionHit(h as CodeSystemHit & { url: string; version: string });
		} else {
			selectSystemHit(h);
		}
	};

	const hitsLength = hitsList.length;
	React.useEffect(() => {
		setActiveIndex(hitsLength > 0 ? 0 : -1);
	}, [hitsLength]);

	React.useEffect(() => {
		if (activeIndex < 0) return;
		itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	return (
		<HSComp.Popover open={open} onOpenChange={setOpen}>
			<HSComp.PopoverAnchor asChild>
				<div className="shrink-0" style={{ width: `${inputWidthPx}px` }}>
					<HSComp.Input
						ref={inputRef}
						placeholder={placeholder}
						value={local}
						onChange={(e) => {
							setLocal(e.target.value);
							setOpen(true);
						}}
						onClick={(e) => {
							e.stopPropagation();
							setOpen(true);
						}}
						onFocus={() => setOpen(true)}
						onBlur={(e) => {
							const next = e.relatedTarget as HTMLElement | null;
							if (next?.closest("[data-cs-picker-popover='true']")) return;
							commit(local);
							setOpen(false);
						}}
						onKeyDown={(e) => {
							if (e.key === "ArrowDown") {
								e.preventDefault();
								if (hitsList.length === 0) return;
								setOpen(true);
								setActiveIndex((i) => (i + 1) % hitsList.length);
							} else if (e.key === "ArrowUp") {
								e.preventDefault();
								if (hitsList.length === 0) return;
								setOpen(true);
								setActiveIndex((i) => (i <= 0 ? hitsList.length - 1 : i - 1));
							} else if (e.key === "Enter") {
								e.preventDefault();
								if (open && activeIndex >= 0 && hitsList[activeIndex]) {
									onSelectActive();
								} else {
									commit(local);
									setOpen(false);
								}
							} else if (e.key === "Escape") {
								setOpen(false);
								setActiveIndex(-1);
							}
						}}
						onMouseDown={(e) => e.stopPropagation()}
						className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary group-hover/tree-item-label:bg-bg-tertiary focus:ring-1 focus:ring-border-link font-mono text-xs"
					/>
					<span
						ref={measureRef}
						aria-hidden="true"
						className="input-measure font-mono text-xs"
					>
						{local || placeholder}
					</span>
				</div>
			</HSComp.PopoverAnchor>
			<HSComp.PopoverContent
				data-cs-picker-popover="true"
				className="w-[var(--radix-popover-trigger-width)] min-w-[480px] p-0 max-h-80 overflow-auto"
				align="start"
				onOpenAutoFocus={(e) => e.preventDefault()}
				onInteractOutside={(e) => {
					if (e.target === inputRef.current) e.preventDefault();
				}}
			>
				{mode === "version" && !systemPart ? (
					<div className="px-3 py-2 text-text-secondary text-sm">
						Type a CodeSystem URL before <code>|</code>
					</div>
				) : hitsList.length === 0 ? (
					<div className="px-3 py-2 text-text-secondary text-sm">
						{mode === "version" ? "No versions found" : "No matches"}
					</div>
				) : (
					<ul className="py-1">
						{hitsList.map((h, i) => {
							const isActive = i === activeIndex;
							if (mode === "version") {
								const ver = h.version ?? "";
								const secondary = h.title || h.name || h.id || h.url;
								return (
									<li key={`${h.url}|${ver}`}>
										<button
											ref={(el) => {
												itemRefs.current[i] = el;
											}}
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												selectVersionHit(
													h as CodeSystemHit & {
														url: string;
														version: string;
													},
												);
											}}
											onMouseEnter={() => setActiveIndex(i)}
											className={`w-full text-left px-3 py-1.5 focus:outline-none ${isActive ? "bg-bg-tertiary" : ""}`}
										>
											<div className="typo-body text-text-primary truncate font-mono">
												{ver}
											</div>
											<div className="typo-body-xs text-text-secondary line-clamp-1">
												{secondary}
											</div>
										</button>
									</li>
								);
							}
							const title = h.title || h.name || h.id || h.url;
							const secondary = h.description || h.url;
							return (
								<li key={`${h.url}|${h.version ?? ""}`}>
									<button
										ref={(el) => {
											itemRefs.current[i] = el;
										}}
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											selectSystemHit(h);
										}}
										onMouseEnter={() => setActiveIndex(i)}
										className={`w-full text-left px-3 py-1.5 focus:outline-none ${isActive ? "bg-bg-tertiary" : ""}`}
									>
										<div className="typo-body text-text-primary truncate">
											{title}
										</div>
										<div className="typo-body-xs text-text-secondary line-clamp-1 font-mono">
											{secondary}
										</div>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</HSComp.PopoverContent>
		</HSComp.Popover>
	);
}

type CanonicalHit = {
	id?: string;
	url?: string;
	name?: string;
	title?: string;
	version?: string;
	description?: string;
};

function CanonicalPicker({
	value,
	onChange,
	resourceType,
	placeholder,
}: {
	value?: string;
	onChange: (next: string | undefined) => void;
	resourceType: "ValueSet" | "ConceptMap";
	placeholder?: string;
}) {
	const effectivePlaceholder = placeholder ?? `${resourceType} canonical URL`;
	const client = useAidboxClient();
	const [local, setLocal] = React.useState(value ?? "");
	const [debounced, setDebounced] = React.useState(local);
	const [open, setOpen] = React.useState(false);
	const [activeIndex, setActiveIndex] = React.useState(-1);
	const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
	const inputRef = React.useRef<HTMLInputElement | null>(null);
	const measureRef = React.useRef<HTMLSpanElement | null>(null);
	const [inputWidthPx, setInputWidthPx] = React.useState(200);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps drive re-measurement of the span when text changes
	React.useLayoutEffect(() => {
		const input = inputRef.current;
		const span = measureRef.current;
		if (!input || !span) return;
		const cs = getComputedStyle(input);
		span.style.font = cs.font;
		span.style.fontFamily = cs.fontFamily;
		span.style.fontSize = cs.fontSize;
		span.style.fontWeight = cs.fontWeight;
		span.style.letterSpacing = cs.letterSpacing;
		const padX =
			Number.parseFloat(cs.paddingLeft) + Number.parseFloat(cs.paddingRight);
		const borderX =
			Number.parseFloat(cs.borderLeftWidth) +
			Number.parseFloat(cs.borderRightWidth);
		const caret = 2;
		const w = span.offsetWidth + padX + borderX + caret;
		setInputWidthPx(Math.max(200, Math.ceil(w)));
	}, [local, effectivePlaceholder]);

	React.useEffect(() => {
		setLocal(value ?? "");
	}, [value]);

	React.useEffect(() => {
		const t = setTimeout(() => setDebounced(local), 250);
		return () => clearTimeout(t);
	}, [local]);

	const pipeIdx = debounced.indexOf("|");
	const mode: "url" | "version" = pipeIdx >= 0 ? "version" : "url";
	const urlPart =
		pipeIdx >= 0 ? debounced.slice(0, pipeIdx).trim() : debounced.trim();
	const versionPart = pipeIdx >= 0 ? debounced.slice(pipeIdx + 1).trim() : "";

	const { data: urlHits } = useQuery({
		queryKey: [
			"conceptmap-builder",
			"canonical-picker",
			resourceType,
			"url",
			urlPart,
		],
		enabled: mode === "url",
		queryFn: async () => {
			const params = new URLSearchParams({
				_count: "15",
				_sort: "-_lastUpdated",
				_elements: "url,name,title,version,description",
			});
			if (urlPart) params.set("url:contains", urlPart);
			const res = await client.request<{
				entry?: Array<{ resource: CanonicalHit }>;
			}>({
				method: "GET",
				url: `/fhir/${resourceType}?${params.toString()}`,
			});
			if (res.isErr()) return [];
			return (res.value.resource.entry ?? [])
				.map((e) => e.resource)
				.filter((r): r is CanonicalHit & { url: string } => !!r.url);
		},
		staleTime: 30_000,
	});

	const { data: versionHits } = useQuery({
		queryKey: [
			"conceptmap-builder",
			"canonical-picker",
			resourceType,
			"versions",
			urlPart,
		],
		enabled: mode === "version" && urlPart.length > 0,
		queryFn: async () => {
			const params = new URLSearchParams({
				_count: "100",
				_sort: "-_lastUpdated",
				_elements: "url,name,title,version",
				url: urlPart,
			});
			const res = await client.request<{
				entry?: Array<{ resource: CanonicalHit }>;
			}>({
				method: "GET",
				url: `/fhir/${resourceType}?${params.toString()}`,
			});
			if (res.isErr()) return [];
			const seen = new Set<string>();
			const out: Array<CanonicalHit & { url: string; version: string }> = [];
			for (const e of res.value.resource.entry ?? []) {
				const r = e.resource;
				if (!r.url || !r.version) continue;
				if (seen.has(r.version)) continue;
				seen.add(r.version);
				out.push({ ...r, url: r.url, version: r.version });
			}
			return out;
		},
		staleTime: 30_000,
	});

	const commit = (raw: string) => {
		setLocal(raw);
		const next = raw.trim() || undefined;
		if (next !== value) onChange(next);
	};

	const selectUrlHit = (h: CanonicalHit & { url: string }) => {
		setLocal(h.url);
		onChange(h.url);
		setOpen(false);
		setActiveIndex(-1);
	};

	const selectVersionHit = (
		h: CanonicalHit & { url: string; version: string },
	) => {
		const combined = `${urlPart || h.url}|${h.version}`;
		setLocal(combined);
		onChange(combined);
		setOpen(false);
		setActiveIndex(-1);
	};

	const hitsList =
		mode === "version"
			? (versionHits ?? []).filter(
					(h) => !versionPart || h.version.includes(versionPart),
				)
			: (urlHits ?? []);

	const onSelectActive = () => {
		const h = hitsList[activeIndex];
		if (!h) return;
		if (mode === "version") {
			selectVersionHit(h as CanonicalHit & { url: string; version: string });
		} else {
			selectUrlHit(h);
		}
	};

	const hitsLength = hitsList.length;
	React.useEffect(() => {
		setActiveIndex(hitsLength > 0 ? 0 : -1);
	}, [hitsLength]);

	React.useEffect(() => {
		if (activeIndex < 0) return;
		itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	return (
		<HSComp.Popover open={open} onOpenChange={setOpen}>
			<HSComp.PopoverAnchor asChild>
				<div className="shrink-0" style={{ width: `${inputWidthPx}px` }}>
					<HSComp.Input
						ref={inputRef}
						placeholder={effectivePlaceholder}
						value={local}
						onChange={(e) => {
							setLocal(e.target.value);
							setOpen(true);
						}}
						onClick={(e) => {
							e.stopPropagation();
							setOpen(true);
						}}
						onFocus={() => setOpen(true)}
						onBlur={(e) => {
							const next = e.relatedTarget as HTMLElement | null;
							if (next?.closest("[data-canonical-picker-popover='true']"))
								return;
							commit(local);
							setOpen(false);
						}}
						onKeyDown={(e) => {
							if (e.key === "ArrowDown") {
								e.preventDefault();
								if (hitsList.length === 0) return;
								setOpen(true);
								setActiveIndex((i) => (i + 1) % hitsList.length);
							} else if (e.key === "ArrowUp") {
								e.preventDefault();
								if (hitsList.length === 0) return;
								setOpen(true);
								setActiveIndex((i) => (i <= 0 ? hitsList.length - 1 : i - 1));
							} else if (e.key === "Enter") {
								e.preventDefault();
								if (open && activeIndex >= 0 && hitsList[activeIndex]) {
									onSelectActive();
								} else {
									commit(local);
									setOpen(false);
								}
							} else if (e.key === "Escape") {
								setOpen(false);
								setActiveIndex(-1);
							}
						}}
						onMouseDown={(e) => e.stopPropagation()}
						className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary group-hover/tree-item-label:bg-bg-tertiary focus:ring-1 focus:ring-border-link font-mono text-xs"
					/>
					<span
						ref={measureRef}
						aria-hidden="true"
						className="input-measure font-mono text-xs"
					>
						{local || effectivePlaceholder}
					</span>
				</div>
			</HSComp.PopoverAnchor>
			<HSComp.PopoverContent
				data-canonical-picker-popover="true"
				className="w-[var(--radix-popover-trigger-width)] min-w-[480px] p-0 max-h-80 overflow-auto"
				align="start"
				onOpenAutoFocus={(e) => e.preventDefault()}
				onInteractOutside={(e) => {
					if (e.target === inputRef.current) e.preventDefault();
				}}
			>
				{mode === "version" && !urlPart ? (
					<div className="px-3 py-2 text-text-secondary text-sm">
						Type a {resourceType} URL before <code>|</code>
					</div>
				) : hitsList.length === 0 ? (
					<div className="px-3 py-2 text-text-secondary text-sm">
						{mode === "version" ? "No versions found" : "No matches"}
					</div>
				) : (
					<ul className="py-1">
						{hitsList.map((h, i) => {
							const isActive = i === activeIndex;
							if (mode === "version") {
								const ver = h.version ?? "";
								const secondary = h.title || h.name || h.id || h.url;
								return (
									<li key={`${h.url}|${ver}`}>
										<button
											ref={(el) => {
												itemRefs.current[i] = el;
											}}
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												selectVersionHit(
													h as CanonicalHit & {
														url: string;
														version: string;
													},
												);
											}}
											onMouseEnter={() => setActiveIndex(i)}
											className={`w-full text-left px-3 py-1.5 focus:outline-none ${isActive ? "bg-bg-tertiary" : ""}`}
										>
											<div className="typo-body text-text-primary truncate font-mono">
												{ver}
											</div>
											<div className="typo-body-xs text-text-secondary line-clamp-1">
												{secondary}
											</div>
										</button>
									</li>
								);
							}
							const title = h.title || h.name || h.id || h.url;
							const secondary = h.description || h.url;
							return (
								<li key={`${h.url}|${h.version ?? ""}`}>
									<button
										ref={(el) => {
											itemRefs.current[i] = el;
										}}
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											selectUrlHit(h);
										}}
										onMouseEnter={() => setActiveIndex(i)}
										className={`w-full text-left px-3 py-1.5 focus:outline-none ${isActive ? "bg-bg-tertiary" : ""}`}
									>
										<div className="typo-body text-text-primary truncate">
											{title}
										</div>
										<div className="typo-body-xs text-text-secondary line-clamp-1 font-mono">
											{secondary}
										</div>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</HSComp.PopoverContent>
		</HSComp.Popover>
	);
}

const LABEL_OVERRIDES: Partial<Record<ItemMeta["type"], string>> = {
	groups: "groups",
};

function InputView({
	placeholder,
	value,
	onChange,
}: {
	placeholder: string;
	value?: string;
	onChange?: (value: string) => void;
}) {
	const [localValue, setLocalValue] = React.useState(value ?? "");
	const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);

	React.useEffect(() => {
		setLocalValue(value ?? "");
	}, [value]);

	const handleChange = (newValue: string) => {
		setLocalValue(newValue);
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => {
			if (onChange && newValue !== value) onChange(newValue);
		}, 500);
	};

	return (
		<HSComp.Input
			className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary group-hover/tree-item-label:bg-bg-tertiary focus:ring-1 focus:ring-border-link"
			placeholder={placeholder}
			value={localValue}
			onChange={(e) => handleChange(e.target.value)}
			onClick={(e) => e.stopPropagation()}
			onMouseDown={(e) => e.stopPropagation()}
		/>
	);
}

// Auto-sizing input — same measurement pattern as CodeSystemPicker.
// font-mono text-xs is applied to both the input AND the measuring span,
// which is what makes the measurement accurate.
function AutoSizeInputView({
	placeholder,
	value,
	onChange,
}: {
	placeholder: string;
	value?: string;
	onChange?: (value: string) => void;
}) {
	const [localValue, setLocalValue] = React.useState(value ?? "");
	const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const inputRef = React.useRef<HTMLInputElement | null>(null);
	const measureRef = React.useRef<HTMLSpanElement | null>(null);
	const [widthPx, setWidthPx] = React.useState(120);

	React.useEffect(() => {
		setLocalValue(value ?? "");
	}, [value]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps drive re-measurement of the span when text changes
	React.useLayoutEffect(() => {
		const input = inputRef.current;
		const span = measureRef.current;
		if (!input || !span) return;
		const cs = getComputedStyle(input);
		span.style.font = cs.font;
		span.style.fontFamily = cs.fontFamily;
		span.style.fontSize = cs.fontSize;
		span.style.fontWeight = cs.fontWeight;
		span.style.letterSpacing = cs.letterSpacing;
		const padX =
			Number.parseFloat(cs.paddingLeft) + Number.parseFloat(cs.paddingRight);
		const borderX =
			Number.parseFloat(cs.borderLeftWidth) +
			Number.parseFloat(cs.borderRightWidth);
		const caret = 2;
		const w = span.offsetWidth + padX + borderX + caret;
		setWidthPx(Math.max(120, Math.ceil(w)));
	}, [localValue, placeholder]);

	const handleChange = (newValue: string) => {
		setLocalValue(newValue);
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => {
			if (onChange && newValue !== value) onChange(newValue);
		}, 500);
	};

	return (
		<div className="shrink-0" style={{ width: `${widthPx}px` }}>
			<HSComp.Input
				ref={inputRef}
				className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary group-hover/tree-item-label:bg-bg-tertiary focus:ring-1 focus:ring-border-link font-mono text-xs"
				placeholder={placeholder}
				value={localValue}
				onChange={(e) => handleChange(e.target.value)}
				onClick={(e) => e.stopPropagation()}
				onMouseDown={(e) => e.stopPropagation()}
			/>
			<span
				ref={measureRef}
				aria-hidden="true"
				className="input-measure font-mono text-xs"
			>
				{localValue || placeholder}
			</span>
		</div>
	);
}

// Auto-sizing Select — same idea as AutoSizeInputView but for HSComp.Select.
// Measures the selected/placeholder text through a hidden span, then sets
// width = textWidth + padding + chevron (24px) + caret allowance.
function AutoSizeSelect({
	value,
	onChange,
	options,
	placeholder,
}: {
	value: string;
	onChange: (next: string) => void;
	options: readonly string[];
	placeholder: string;
}) {
	const wrapperRef = React.useRef<HTMLDivElement | null>(null);
	const measureRef = React.useRef<HTMLSpanElement | null>(null);
	const [widthPx, setWidthPx] = React.useState(120);

	// biome-ignore lint/correctness/useExhaustiveDependencies: deps drive re-measurement of the span when value/placeholder change
	React.useLayoutEffect(() => {
		const wrapper = wrapperRef.current;
		const span = measureRef.current;
		if (!wrapper || !span) return;
		const trigger = wrapper.querySelector(
			'[data-slot="select-trigger"], button[role="combobox"]',
		) as HTMLElement | null;
		if (!trigger) return;
		const cs = getComputedStyle(trigger);
		span.style.font = cs.font;
		span.style.fontFamily = cs.fontFamily;
		span.style.fontSize = cs.fontSize;
		span.style.fontWeight = cs.fontWeight;
		span.style.letterSpacing = cs.letterSpacing;
		const padX =
			Number.parseFloat(cs.paddingLeft) + Number.parseFloat(cs.paddingRight);
		const borderX =
			Number.parseFloat(cs.borderLeftWidth) +
			Number.parseFloat(cs.borderRightWidth);
		const chevron = 24; // chevron icon + gap inside trigger
		const w = span.offsetWidth + padX + borderX + chevron;
		setWidthPx(Math.max(120, Math.ceil(w)));
	}, [value, placeholder]);

	return (
		<div
			ref={wrapperRef}
			className="shrink-0"
			style={{ width: `${widthPx}px` }}
		>
			<HSComp.Select value={value} onValueChange={onChange}>
				<HSComp.SelectTrigger className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary">
					<HSComp.SelectValue placeholder={placeholder} />
				</HSComp.SelectTrigger>
				<HSComp.SelectContent>
					{options.map((o) => (
						<HSComp.SelectItem key={o} value={o}>
							{o}
						</HSComp.SelectItem>
					))}
				</HSComp.SelectContent>
			</HSComp.Select>
			<span ref={measureRef} aria-hidden="true" className="input-measure">
				{value || placeholder}
			</span>
		</div>
	);
}

function labelView(item: ItemInstance<TreeViewItem<ItemMeta>>) {
	const metaType = item.getItemData()?.meta?.type;
	const isFolder = item.isFolder();
	const isTextOnlyLabel = metaType === "properties" || metaType === "groups";

	const additionalClass = isTextOnlyLabel
		? "text-text-info-primary px-1!"
		: "inline-flex items-center justify-center min-w-7 min-h-7 text-text-info-primary bg-bg-info-primary";

	const label = (metaType && LABEL_OVERRIDES[metaType]) ?? metaType;

	const onLabelClickFn = (e: React.MouseEvent) => {
		if (!isFolder) return;
		e.stopPropagation();
		if (item.isExpanded()) item.collapse();
		else item.expand();
	};

	return (
		<button
			type="button"
			tabIndex={-1}
			className={`uppercase px-1.5 py-0.5 ${isFolder ? "cursor-pointer" : ""} rounded-md ${additionalClass}`}
			onClick={onLabelClickFn}
		>
			{label}
		</button>
	);
}

const groupRowId = (i: number) => `_group_${i}`;
const elementsSectionId = (gi: number) => `_group_${gi}_elements`;
const elementRowId = (gi: number, ei: number) => `_group_${gi}_element_${ei}`;
const elementAddId = (gi: number) => `_group_${gi}_element_add`;
const unmappedRowId = (gi: number) => `_group_${gi}_unmapped`;

const UNMAPPED_MODES_R4 = ["provided", "fixed", "other-map"] as const;
const UNMAPPED_MODES_R5 = [
	"provided",
	"fixed",
	"other-map",
	"use-source-code",
] as const;

const getUnmappedOtherMap = (
	um: import("./types").ConceptMapUnmapped | undefined,
): string | undefined => um?.otherMap ?? um?.url;

const getTargetRel = (t: ConceptMapTarget | undefined, r4: boolean): string =>
	r4 ? (t?.equivalence ?? "") : (t?.relationship ?? "");

// Read whichever R4/R5 field is populated — picker shows whatever is there.
const getRootSource = (cm: ConceptMap): string | undefined =>
	cm.sourceScopeCanonical ??
	cm.sourceScopeUri ??
	cm.sourceCanonical ??
	cm.sourceUri;

const getRootTarget = (cm: ConceptMap): string | undefined =>
	cm.targetScopeCanonical ??
	cm.targetScopeUri ??
	cm.targetCanonical ??
	cm.targetUri;

// Write to the version-appropriate canonical field, clear the others so the
// resource has exactly one source-of-truth scope field.
const writeRootSource = (cm: ConceptMap, value?: string, isR4 = false) => {
	const cleared = {
		...cm,
		sourceUri: undefined,
		sourceCanonical: undefined,
		sourceScopeUri: undefined,
		sourceScopeCanonical: undefined,
	};
	if (!value) return cleared;
	return isR4
		? { ...cleared, sourceCanonical: value }
		: { ...cleared, sourceScopeCanonical: value };
};

const writeRootTarget = (cm: ConceptMap, value?: string, isR4 = false) => {
	const cleared = {
		...cm,
		targetUri: undefined,
		targetCanonical: undefined,
		targetScopeUri: undefined,
		targetScopeCanonical: undefined,
	};
	if (!value) return cleared;
	return isR4
		? { ...cleared, targetCanonical: value }
		: { ...cleared, targetScopeCanonical: value };
};

export function PropertiesTree() {
	const { conceptMap, updateConceptMap } = useConceptMapContext();
	const fhirVersion = useFhirServerVersion();
	const isR4 = isR4Like(fhirVersion);
	const relationshipOptions = isR4 ? EQUIVALENCES_R4 : RELATIONSHIPS_R5;

	const updateField = <K extends keyof ConceptMap>(
		key: K,
		value: ConceptMap[K] | undefined,
	) =>
		updateConceptMap((cm) => ({
			...cm,
			[key]: value === "" ? undefined : value,
		}));

	const mutateGroups = (
		fn: (arr: ConceptMapGroup[]) => ConceptMapGroup[] | undefined,
	) =>
		updateConceptMap((cm) => {
			const next = fn((cm.group ?? []).slice());
			return { ...cm, group: next && next.length > 0 ? next : undefined };
		});

	const updateGroupAt = (i: number, patch: Partial<ConceptMapGroup>) =>
		mutateGroups((arr) => {
			const next = arr.slice();
			next[i] = { ...next[i], ...patch };
			return next;
		});

	const addGroup = () => {
		mutateGroups((arr) => [...arr, {}]);
		setExpandedItems((prev) => Array.from(new Set([...prev, "_groups"])));
	};

	const removeGroupAt = (i: number) =>
		mutateGroups((arr) => arr.filter((_, idx) => idx !== i));

	const mutateElementAt = (
		gi: number,
		ei: number,
		fn: (el: ConceptMapElement) => ConceptMapElement,
	) =>
		mutateGroups((arr) => {
			const next = arr.slice();
			const g = next[gi] ?? {};
			const elements = (g.element ?? []).slice();
			elements[ei] = fn(elements[ei] ?? {});
			next[gi] = { ...g, element: elements };
			return next;
		});

	const updateElementCode = (gi: number, ei: number, code: string) =>
		mutateElementAt(gi, ei, (el) => ({ ...el, code: code || undefined }));

	const updateTargetCode = (gi: number, ei: number, code: string) =>
		mutateElementAt(gi, ei, (el) => {
			const targets = (el.target ?? []).slice();
			targets[0] = { ...(targets[0] ?? {}), code: code || undefined };
			return { ...el, target: targets };
		});

	const updateTargetRel = (
		gi: number,
		ei: number,
		value: string,
		isR4: boolean,
	) =>
		mutateElementAt(gi, ei, (el) => {
			const targets = (el.target ?? []).slice();
			const prev = targets[0] ?? {};
			targets[0] = isR4
				? {
						...prev,
						equivalence: value || undefined,
						relationship: undefined,
					}
				: {
						...prev,
						relationship: value || undefined,
						equivalence: undefined,
					};
			return { ...el, target: targets };
		});

	const addElementAt = (gi: number) => {
		mutateGroups((arr) => {
			const next = arr.slice();
			const g = next[gi] ?? {};
			next[gi] = {
				...g,
				element: [...(g.element ?? []), { target: [{}] }],
			};
			return next;
		});
		setExpandedItems((prev) =>
			Array.from(new Set([...prev, groupRowId(gi), elementsSectionId(gi)])),
		);
	};

	const removeElementAt = (gi: number, ei: number) =>
		mutateGroups((arr) => {
			const next = arr.slice();
			const g = next[gi] ?? {};
			const elements = (g.element ?? []).filter((_, idx) => idx !== ei);
			next[gi] = {
				...g,
				element: elements.length > 0 ? elements : undefined,
			};
			return next;
		});

	const updateUnmappedMode = (gi: number, mode: string) => {
		mutateGroups((arr) => {
			const next = arr.slice();
			const g = next[gi] ?? {};
			if (!mode) {
				next[gi] = { ...g, unmapped: undefined };
				return next;
			}
			const um = g.unmapped ?? {};
			// Drop fields that don't belong to the new mode (cmd-8, cmd-10).
			const cleaned: import("./types").ConceptMapUnmapped = { mode };
			if (mode === "fixed") {
				cleaned.code = um.code;
				cleaned.display = um.display;
			} else if (mode === "other-map") {
				cleaned.otherMap = um.otherMap;
				cleaned.url = um.url;
			}
			next[gi] = { ...g, unmapped: cleaned };
			return next;
		});
		if (mode === "fixed" || mode === "other-map") {
			setExpandedItems((prev) =>
				Array.from(new Set([...prev, groupRowId(gi)])),
			);
		}
	};

	const updateUnmappedField = (
		gi: number,
		patch: Partial<import("./types").ConceptMapUnmapped>,
	) =>
		mutateGroups((arr) => {
			const next = arr.slice();
			const g = next[gi] ?? {};
			next[gi] = {
				...g,
				unmapped: { ...(g.unmapped ?? {}), ...patch },
			};
			return next;
		});

	const updateUnmappedOtherMap = (gi: number, value: string | undefined) =>
		mutateGroups((arr) => {
			const next = arr.slice();
			const g = next[gi] ?? {};
			const um = g.unmapped ?? {};
			next[gi] = {
				...g,
				unmapped: isR4
					? { ...um, url: value, otherMap: undefined }
					: { ...um, otherMap: value, url: undefined },
			};
			return next;
		});

	const groups = conceptMap.group ?? [];

	const tree: Record<string, TreeViewItem<ItemMeta>> = React.useMemo(() => {
		const out: Record<string, TreeViewItem<ItemMeta>> = {
			root: { name: "root", children: ["_properties", "_groups"] },
			_properties: {
				name: "_properties",
				meta: { type: "properties" },
				children: [
					"_url",
					"_version",
					"_status",
					"_title",
					"_description",
					"_source",
					"_target",
				],
			},
			_url: { name: "_url", meta: { type: "url" } },
			_version: { name: "_version", meta: { type: "version" } },
			_status: { name: "_status", meta: { type: "status" } },
			_title: { name: "_title", meta: { type: "title" } },
			_description: { name: "_description", meta: { type: "description" } },
			_source: { name: "_source", meta: { type: "source" } },
			_target: { name: "_target", meta: { type: "target" } },
		};

		const groupChildren: string[] = [];
		groups.forEach((g, i) => {
			const rowId = groupRowId(i);
			const elements = g.element ?? [];
			const sectionChildren: string[] = [];
			elements.forEach((_, j) => {
				const eId = elementRowId(i, j);
				out[eId] = {
					name: eId,
					meta: { type: "element-row", groupIndex: i, elementIndex: j },
				};
				sectionChildren.push(eId);
			});
			const eAddId = elementAddId(i);
			out[eAddId] = {
				name: eAddId,
				meta: { type: "element-add", groupIndex: i },
			};
			sectionChildren.push(eAddId);

			const sectionId = elementsSectionId(i);
			out[sectionId] = {
				name: sectionId,
				meta: { type: "elements-section", groupIndex: i },
				children: sectionChildren,
			};

			// Unmapped — single inline row, no children.
			const umRowId = unmappedRowId(i);
			out[umRowId] = {
				name: umRowId,
				meta: { type: "unmapped-row", groupIndex: i },
			};

			out[rowId] = {
				name: rowId,
				meta: { type: "group-row", groupIndex: i },
				children: [sectionId, umRowId],
			};
			groupChildren.push(rowId);
		});
		groupChildren.push("_group_add");
		out._group_add = { name: "_group_add", meta: { type: "group-add" } };
		out._groups = {
			name: "_groups",
			meta: { type: "groups" },
			children: groupChildren,
		};

		return out;
	}, [groups]);

	const [expandedItems, setExpandedItems] = React.useState<string[]>(() => {
		const out = ["_properties", "_groups"];
		const initialGroups = conceptMap.group ?? [];
		let totalElements = 0;
		for (const g of initialGroups) {
			totalElements += g.element?.length ?? 0;
		}
		if (totalElements >= 1000) return out;
		initialGroups.forEach((_, i) => {
			out.push(groupRowId(i), elementsSectionId(i));
		});
		return out;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	});

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: large switch over tree node types
	const customItemView = (item: ItemInstance<TreeViewItem<ItemMeta>>) => {
		const meta = item.getItemData()?.meta;
		const metaType = meta?.type;
		switch (metaType) {
			case "properties":
			case "groups":
				return <div>{labelView(item)}</div>;
			case "url":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[246px] shrink-0">{labelView(item)}</div>
						<div className="w-[50%]">
							<InputView
								placeholder="Canonical identifier for this concept map, represented as a URI (globally unique)"
								value={conceptMap.url}
								onChange={(v) => updateField("url", v)}
							/>
						</div>
					</div>
				);
			case "version":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[246px] shrink-0">{labelView(item)}</div>
						<div className="w-[300px]">
							<InputView
								placeholder="Business version of the concept map"
								value={conceptMap.version}
								onChange={(v) => updateField("version", v)}
							/>
						</div>
					</div>
				);
			case "status":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[246px] shrink-0">{labelView(item)}</div>
						<div className="w-[112px]">
							<HSComp.Select
								value={conceptMap.status ?? ""}
								onValueChange={(v) =>
									updateField("status", (v || undefined) as ConceptMapStatus)
								}
							>
								<HSComp.SelectTrigger className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary">
									<HSComp.SelectValue placeholder="status" />
								</HSComp.SelectTrigger>
								<HSComp.SelectContent>
									{STATUSES.map((s) => (
										<HSComp.SelectItem key={s} value={s}>
											{s}
										</HSComp.SelectItem>
									))}
								</HSComp.SelectContent>
							</HSComp.Select>
						</div>
					</div>
				);
			case "title":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[246px] shrink-0">{labelView(item)}</div>
						<div className="w-[50%]">
							<InputView
								placeholder="Name for this concept map (human friendly)"
								value={conceptMap.title}
								onChange={(v) => updateField("title", v)}
							/>
						</div>
					</div>
				);
			case "description":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[246px] shrink-0">{labelView(item)}</div>
						<div className="flex-1 min-w-0">
							<InputView
								placeholder="Natural language description of the concept map"
								value={conceptMap.description}
								onChange={(v) => updateField("description", v)}
							/>
						</div>
					</div>
				);
			case "source":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[246px] shrink-0">{labelView(item)}</div>
						<CanonicalPicker
							resourceType="ValueSet"
							value={getRootSource(conceptMap)}
							onChange={(next) =>
								updateConceptMap((cm) => writeRootSource(cm, next, isR4))
							}
						/>
					</div>
				);
			case "target":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[246px] shrink-0">{labelView(item)}</div>
						<CanonicalPicker
							resourceType="ValueSet"
							value={getRootTarget(conceptMap)}
							onChange={(next) =>
								updateConceptMap((cm) => writeRootTarget(cm, next, isR4))
							}
						/>
					</div>
				);
			case "group-row": {
				const i = meta?.groupIndex ?? -1;
				const g = groups[i];
				const isFolder = item.isFolder();
				const toggle = (e: React.MouseEvent) => {
					if (!isFolder) return;
					e.stopPropagation();
					if (item.isExpanded()) item.collapse();
					else item.expand();
				};
				const maxDigits = String(Math.max(groups.length, 1)).length;
				// R4 keeps version in a separate field (sourceVersion/targetVersion).
				// R5+ removed those fields — version lives inside the canonical
				// as `url|version`. So we split/merge depending on FHIR version.
				const srcParts = isR4
					? { system: g?.source, version: g?.sourceVersion }
					: parseSystemPipeVersion(g?.source ?? "");
				const tgtParts = isR4
					? { system: g?.target, version: g?.targetVersion }
					: parseSystemPipeVersion(g?.target ?? "");
				const writeGroupSourceFields = (next: {
					system?: string;
					version?: string;
				}): Partial<ConceptMapGroup> =>
					isR4
						? { source: next.system, sourceVersion: next.version }
						: {
								source:
									next.system && next.version
										? `${next.system}|${next.version}`
										: next.system,
								sourceVersion: undefined,
							};
				const writeGroupTargetFields = (next: {
					system?: string;
					version?: string;
				}): Partial<ConceptMapGroup> =>
					isR4
						? { target: next.system, targetVersion: next.version }
						: {
								target:
									next.system && next.version
										? `${next.system}|${next.version}`
										: next.system,
								targetVersion: undefined,
							};
				return (
					<div className="flex w-full items-center gap-2">
						<button
							type="button"
							tabIndex={-1}
							className={`shrink-0 inline-flex items-center justify-start min-h-7 uppercase px-[2px] py-0.5 rounded-md text-text-info-primary tabular-nums ${isFolder ? "cursor-pointer" : ""}`}
							style={{ minWidth: `calc(${maxDigits}ch + 4px)` }}
							onClick={toggle}
						>
							{i + 1}
						</button>
						<CodeSystemPicker
							system={srcParts.system}
							version={srcParts.version}
							placeholder="Source"
							onChange={(next) =>
								updateGroupAt(i, writeGroupSourceFields(next))
							}
						/>
						<ArrowRight size={14} className="shrink-0 text-text-secondary" />
						<CodeSystemPicker
							system={tgtParts.system}
							version={tgtParts.version}
							placeholder="Target"
							onChange={(next) =>
								updateGroupAt(i, writeGroupTargetFields(next))
							}
						/>
						<div className="flex-1" />
						<HSComp.Button
							variant="link"
							size="small"
							className="shrink-0 group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
							onClick={() => removeGroupAt(i)}
							asChild
						>
							<span>
								<X size={14} />
							</span>
						</HSComp.Button>
					</div>
				);
			}
			case "group-add":
				return (
					<HSComp.Button
						variant="link"
						size="small"
						className="px-0"
						onClick={addGroup}
						asChild
					>
						<span>
							<Plus size={16} strokeWidth={3} />
							<span className="text-xs typo-label">Group</span>
						</span>
					</HSComp.Button>
				);
			case "elements-section": {
				const gi = meta?.groupIndex ?? -1;
				const count = groups[gi]?.element?.length ?? 0;
				const isFolder = item.isFolder();
				const toggle = (e: React.MouseEvent) => {
					if (!isFolder) return;
					e.stopPropagation();
					if (item.isExpanded()) item.collapse();
					else item.expand();
				};
				return (
					<div>
						<button
							type="button"
							tabIndex={-1}
							className={`inline-flex items-center justify-center min-w-7 min-h-7 uppercase px-1.5 py-0.5 ${isFolder ? "cursor-pointer" : ""} rounded-md text-text-info-primary bg-bg-info-primary`}
							onClick={toggle}
						>
							elements ({count})
						</button>
					</div>
				);
			}
			case "element-row": {
				const gi = meta?.groupIndex ?? -1;
				const ei = meta?.elementIndex ?? -1;
				const el = groups[gi]?.element?.[ei];
				const t = el?.target?.[0];
				const relation = getTargetRel(t, isR4);
				return (
					<div className="flex w-full items-center gap-2 pl-0.5">
						<span className="text-text-info-primary bg-bg-info-primary rounded-md p-1 shrink-0">
							<Link2 size={12} />
						</span>
						<div className="w-[200px] shrink-0">
							<InputView
								placeholder="source code"
								value={el?.code}
								onChange={(v) => updateElementCode(gi, ei, v)}
							/>
						</div>
						<div className="w-[220px] shrink-0">
							<HSComp.Select
								value={relation}
								onValueChange={(v) => updateTargetRel(gi, ei, v, isR4)}
							>
								<HSComp.SelectTrigger className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary">
									<HSComp.SelectValue
										placeholder={isR4 ? "equivalence" : "relationship"}
									/>
								</HSComp.SelectTrigger>
								<HSComp.SelectContent>
									{relationshipOptions.map((r) => (
										<HSComp.SelectItem key={r} value={r}>
											{r}
										</HSComp.SelectItem>
									))}
								</HSComp.SelectContent>
							</HSComp.Select>
						</div>
						<div className="w-[200px] shrink-0">
							<InputView
								placeholder="target code"
								value={t?.code}
								onChange={(v) => updateTargetCode(gi, ei, v)}
							/>
						</div>
						<HSComp.Button
							variant="link"
							size="small"
							className="shrink-0 group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
							onClick={() => removeElementAt(gi, ei)}
							asChild
						>
							<span>
								<X size={14} />
							</span>
						</HSComp.Button>
					</div>
				);
			}
			case "element-add": {
				const gi = meta?.groupIndex ?? -1;
				return (
					<HSComp.Button
						variant="link"
						size="small"
						className="px-0"
						onClick={() => addElementAt(gi)}
						asChild
					>
						<span>
							<Plus size={16} strokeWidth={3} />
							<span className="text-xs typo-label">Element</span>
						</span>
					</HSComp.Button>
				);
			}
			case "unmapped-row": {
				const gi = meta?.groupIndex ?? -1;
				const um = groups[gi]?.unmapped;
				const modes = isR4 ? UNMAPPED_MODES_R4 : UNMAPPED_MODES_R5;
				return (
					<div className="flex w-full items-center gap-2">
						<span className="inline-flex items-center justify-center min-w-7 min-h-7 uppercase px-1.5 py-0.5 rounded-md text-text-info-primary bg-bg-info-primary shrink-0">
							unmapped
						</span>
						<AutoSizeSelect
							value={um?.mode ?? ""}
							onChange={(v) => updateUnmappedMode(gi, v)}
							options={modes}
							placeholder="(no fallback)"
						/>
						{um?.mode === "fixed" && (
							<>
								<AutoSizeInputView
									placeholder="code"
									value={um?.code}
									onChange={(v) =>
										updateUnmappedField(gi, { code: v || undefined })
									}
								/>
								<AutoSizeInputView
									placeholder="display"
									value={um?.display}
									onChange={(v) =>
										updateUnmappedField(gi, { display: v || undefined })
									}
								/>
							</>
						)}
						{um?.mode === "other-map" && (
							<CanonicalPicker
								resourceType="ConceptMap"
								value={getUnmappedOtherMap(um)}
								onChange={(next) => updateUnmappedOtherMap(gi, next)}
							/>
						)}
					</div>
				);
			}
			default:
				return <div>{labelView(item)}</div>;
		}
	};

	return (
		<div>
			<TreeView
				items={tree}
				rootItemId="root"
				customItemView={customItemView}
				disableHover={true}
				chevronClassName="self-center cursor-pointer"
				expandedItems={expandedItems}
				onExpandedItemsChange={setExpandedItems}
				onItemLabelClick={(item) => {
					if (item.isFolder()) {
						if (item.isExpanded()) item.collapse();
						else item.expand();
					}
				}}
				itemLabelClassFn={(item: ItemInstance<TreeViewItem<ItemMeta>>) => {
					const metaType = item.getItemData()?.meta?.type;
					if (metaType === "properties" || metaType === "groups") {
						return "relative my-1.5 rounded-md bg-bg-info-primary cursor-pointer before:content-[''] before:absolute before:inset-x-0 before:top-0 before:bottom-0 before:-z-10 before:bg-bg-primary before:-my-1.5 after:content-[''] after:absolute after:inset-x-0 after:top-0 after:bottom-0 after:-z-10 after:bg-bg-primary after:rounded-md after:-my-1.5";
					}
					return "pr-0";
				}}
			/>
		</div>
	);
}
