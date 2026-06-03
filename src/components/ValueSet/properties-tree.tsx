import * as HSComp from "@health-samurai/react-components";
import {
	type ItemInstance,
	TreeView,
	type TreeViewItem,
} from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { Filter, Plus, Tag, X } from "lucide-react";
import * as React from "react";
import { useAidboxClient } from "../../AidboxClient";
import { useValueSetContext } from "./context";

type IncludeKind = "include" | "exclude";

type ItemMeta = {
	type:
		| "properties"
		| "url"
		| "version"
		| "title"
		| "description"
		| "include"
		| "include-row"
		| "include-add"
		| "include-concept"
		| "include-concept-row"
		| "include-concept-add"
		| "include-filter"
		| "include-filter-row"
		| "include-filter-add";
	kind?: IncludeKind;
	includeIndex?: number;
	conceptIndex?: number;
	filterIndex?: number;
};

const isVsInclude = (inc: { valueSet?: string[]; system?: string }) =>
	(inc.valueSet?.length ?? 0) > 0;

// Sorted by real-world usage in fhir-packages (n = 309 601 filters across
// 803 559 ValueSets). `is-a` alone is 77%, top-4 cover >99.7%, the rest is
// the long tail. `generalizes` had zero occurrences but is kept last for
// spec completeness.
const FILTER_OPS = [
	"is-a",
	"=",
	"in",
	"descendent-of",
	"regex",
	"exists",
	"is-not-a",
	"not-in",
	"generalizes",
];

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

	React.useEffect(() => {
		setLocalValue(value ?? "");
	}, [value]);

	const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);

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
}: {
	system?: string;
	version?: string;
	onChange: (next: { system?: string; version?: string }) => void;
}) {
	const client = useAidboxClient();
	const formatted = formatSystemPipeVersion(system, version);
	const [local, setLocal] = React.useState(formatted);
	const [debounced, setDebounced] = React.useState(local);
	const [open, setOpen] = React.useState(false);
	const [activeIndex, setActiveIndex] = React.useState(-1);
	const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

	React.useEffect(() => {
		setLocal(formatted);
	}, [formatted]);

	React.useEffect(() => {
		const t = setTimeout(() => setDebounced(local), 250);
		return () => clearTimeout(t);
	}, [local]);

	// derive mode from the debounced input — pipe presence flips us into
	// "pick a version for this system" mode
	const pipeIdx = debounced.indexOf("|");
	const mode: "system" | "version" = pipeIdx >= 0 ? "version" : "system";
	const systemPart =
		pipeIdx >= 0 ? debounced.slice(0, pipeIdx).trim() : debounced.trim();
	const versionPart = pipeIdx >= 0 ? debounced.slice(pipeIdx + 1).trim() : "";

	const { data: systemHits } = useQuery({
		queryKey: ["valueset-builder", "codesystem-picker", "system", systemPart],
		enabled: mode === "system",
		queryFn: async () => {
			const params = new URLSearchParams({
				_count: "15",
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
		queryKey: ["valueset-builder", "codesystem-picker", "versions", systemPart],
		enabled: mode === "version" && systemPart.length > 0,
		queryFn: async () => {
			const params = new URLSearchParams({
				_count: "100",
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
		// Picking from the system list never auto-pins a version — even if the
		// hit has one. To pin a version, user types `|` and picks from the
		// version list.
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

	// auto-highlight the first item so Enter selects it without arrow-down
	const hitsLength = hitsList.length;
	React.useEffect(() => {
		setActiveIndex(hitsLength > 0 ? 0 : -1);
	}, [hitsLength]);

	React.useEffect(() => {
		if (activeIndex < 0) return;
		itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	const inputRef = React.useRef<HTMLInputElement | null>(null);
	return (
		<HSComp.Popover open={open} onOpenChange={setOpen}>
			<HSComp.PopoverAnchor asChild>
				<div className="flex-1 min-w-0">
					<HSComp.Input
						ref={inputRef}
						placeholder="CodeSystem URL"
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
							// keep open if focus moved into popover content
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
				</div>
			</HSComp.PopoverAnchor>
			<HSComp.PopoverContent
				data-cs-picker-popover="true"
				className="w-[var(--radix-popover-trigger-width)] min-w-[480px] p-0 max-h-80 overflow-auto"
				align="start"
				onOpenAutoFocus={(e) => e.preventDefault()}
				onInteractOutside={(e) => {
					// don't close when the user interacts with the anchored input —
					// otherwise focusing the input fires a "pointer-down-outside"
					// that immediately closes the popover that focus just opened
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
											onClick={() =>
												selectVersionHit(
													h as CodeSystemHit & {
														url: string;
														version: string;
													},
												)
											}
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
										onClick={() => selectSystemHit(h)}
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

type ValueSetHit = {
	id?: string;
	url?: string;
	name?: string;
	title?: string;
	description?: string;
};

function ValueSetPicker({
	value,
	onChange,
}: {
	value?: string;
	onChange: (next: string | undefined) => void;
}) {
	const client = useAidboxClient();
	const [local, setLocal] = React.useState(value ?? "");
	const [debounced, setDebounced] = React.useState(local);
	const [open, setOpen] = React.useState(false);
	const [activeIndex, setActiveIndex] = React.useState(-1);
	const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
	const inputRef = React.useRef<HTMLInputElement | null>(null);

	React.useEffect(() => {
		setLocal(value ?? "");
	}, [value]);

	React.useEffect(() => {
		const t = setTimeout(() => setDebounced(local), 250);
		return () => clearTimeout(t);
	}, [local]);

	const { data: hits } = useQuery({
		queryKey: ["valueset-builder", "valueset-picker", debounced],
		queryFn: async () => {
			const q = debounced.trim();
			const params = new URLSearchParams({
				_count: "15",
				_elements: "url,name,title,description",
			});
			if (q) params.set("url:contains", q);
			const res = await client.request<{
				entry?: Array<{ resource: ValueSetHit }>;
			}>({
				method: "GET",
				url: `/fhir/ValueSet?${params.toString()}`,
			});
			if (res.isErr()) return [];
			return (res.value.resource.entry ?? [])
				.map((e) => e.resource)
				.filter((r): r is ValueSetHit & { url: string } => !!r.url);
		},
		staleTime: 30_000,
	});

	const commit = (raw: string) => {
		setLocal(raw);
		const next = raw.trim() || undefined;
		if (next !== value) onChange(next);
	};

	const selectHit = (h: ValueSetHit & { url: string }) => {
		setLocal(h.url);
		onChange(h.url);
		setOpen(false);
		setActiveIndex(-1);
	};

	const hitsList = hits ?? [];
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
				<div className="flex-1 min-w-0">
					<HSComp.Input
						ref={inputRef}
						placeholder="ValueSet canonical URL"
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
							if (next?.closest("[data-vs-picker-popover='true']")) return;
							commit(local);
							setOpen(false);
						}}
						onKeyDown={(e) => {
							if (e.key === "ArrowDown") {
								e.preventDefault();
								if (hitsLength === 0) return;
								setOpen(true);
								setActiveIndex((i) => (i + 1) % hitsLength);
							} else if (e.key === "ArrowUp") {
								e.preventDefault();
								if (hitsLength === 0) return;
								setOpen(true);
								setActiveIndex((i) => (i <= 0 ? hitsLength - 1 : i - 1));
							} else if (e.key === "Enter") {
								e.preventDefault();
								if (open && activeIndex >= 0 && hitsList[activeIndex]) {
									selectHit(hitsList[activeIndex]);
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
				</div>
			</HSComp.PopoverAnchor>
			<HSComp.PopoverContent
				data-vs-picker-popover="true"
				className="w-[var(--radix-popover-trigger-width)] min-w-[480px] p-0 max-h-80 overflow-auto"
				align="start"
				onOpenAutoFocus={(e) => e.preventDefault()}
				onInteractOutside={(e) => {
					if (e.target === inputRef.current) e.preventDefault();
				}}
			>
				{hitsList.length === 0 ? (
					<div className="px-3 py-2 text-text-secondary text-sm">
						No matches
					</div>
				) : (
					<ul className="py-1">
						{hitsList.map((h, i) => {
							const isActive = i === activeIndex;
							const title = h.title || h.name || h.id || h.url;
							const secondary = h.description || h.url;
							return (
								<li key={h.url}>
									<button
										ref={(el) => {
											itemRefs.current[i] = el;
										}}
										type="button"
										onClick={() => selectHit(h)}
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

type ConceptHit = { code: string; display?: string; system?: string };

function ConceptCodePicker({
	system,
	code,
	onChange,
}: {
	system?: string;
	code?: string;
	onChange: (next: { code?: string; display?: string }) => void;
}) {
	const client = useAidboxClient();
	const [local, setLocal] = React.useState(code ?? "");
	const [debounced, setDebounced] = React.useState(local);
	const [open, setOpen] = React.useState(false);
	const [activeIndex, setActiveIndex] = React.useState(-1);
	const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
	const inputRef = React.useRef<HTMLInputElement | null>(null);

	React.useEffect(() => {
		setLocal(code ?? "");
	}, [code]);

	React.useEffect(() => {
		const t = setTimeout(() => setDebounced(local), 250);
		return () => clearTimeout(t);
	}, [local]);

	const { data: hits } = useQuery({
		queryKey: ["valueset-builder", "concept-picker", system, debounced],
		enabled: !!system,
		queryFn: async () => {
			if (!system) return [];
			const body = {
				resourceType: "Parameters" as const,
				parameter: [
					{
						name: "valueSet",
						resource: {
							resourceType: "ValueSet" as const,
							status: "active" as const,
							compose: { include: [{ system }] },
						},
					},
					...(debounced.trim()
						? [{ name: "filter", valueString: debounced.trim() }]
						: []),
					{ name: "count", valueInteger: 15 },
				],
			};
			const res = await client.request<{
				expansion?: { contains?: ConceptHit[] };
			}>({
				method: "POST",
				url: "/fhir/ValueSet/$expand",
				body: JSON.stringify(body),
				headers: { "Content-Type": "application/fhir+json" },
			});
			if (res.isErr()) return [];
			return res.value.resource.expansion?.contains ?? [];
		},
		staleTime: 30_000,
	});

	const commit = (raw: string) => {
		setLocal(raw);
		if (raw !== code) onChange({ code: raw || undefined });
	};

	const selectHit = (h: ConceptHit) => {
		setLocal(h.code);
		onChange({ code: h.code, display: h.display });
		setOpen(false);
		setActiveIndex(-1);
	};

	const hitsList = hits ?? [];
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
				<div className="w-full">
					<HSComp.Input
						ref={inputRef}
						placeholder="Code from system"
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
							if (next?.closest("[data-concept-picker-popover='true']")) return;
							commit(local);
							setOpen(false);
						}}
						onKeyDown={(e) => {
							if (e.key === "ArrowDown") {
								e.preventDefault();
								if (hitsLength === 0) return;
								setOpen(true);
								setActiveIndex((i) => (i + 1) % hitsLength);
							} else if (e.key === "ArrowUp") {
								e.preventDefault();
								if (hitsLength === 0) return;
								setOpen(true);
								setActiveIndex((i) => (i <= 0 ? hitsLength - 1 : i - 1));
							} else if (e.key === "Enter") {
								e.preventDefault();
								if (open && activeIndex >= 0 && hitsList[activeIndex]) {
									selectHit(hitsList[activeIndex]);
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
				</div>
			</HSComp.PopoverAnchor>
			<HSComp.PopoverContent
				data-concept-picker-popover="true"
				className="w-[var(--radix-popover-trigger-width)] min-w-[360px] p-0 max-h-80 overflow-auto"
				align="start"
				onOpenAutoFocus={(e) => e.preventDefault()}
				onInteractOutside={(e) => {
					if (e.target === inputRef.current) e.preventDefault();
				}}
			>
				{!system ? (
					<div className="px-3 py-2 text-text-secondary text-sm">
						Pick a CodeSystem URL above to enable code search
					</div>
				) : hitsLength === 0 ? (
					<div className="px-3 py-2 text-text-secondary text-sm">
						No matches
					</div>
				) : (
					<ul className="py-1">
						{hitsList.map((h, i) => {
							const isActive = i === activeIndex;
							return (
								<li key={`${h.code}|${h.system ?? ""}`}>
									<button
										ref={(el) => {
											itemRefs.current[i] = el;
										}}
										type="button"
										onClick={() => selectHit(h)}
										onMouseEnter={() => setActiveIndex(i)}
										className={`w-full text-left px-3 py-1.5 focus:outline-none ${isActive ? "bg-bg-tertiary" : ""}`}
									>
										<div className="typo-body text-text-primary truncate font-mono">
											{h.code}
										</div>
										{h.display && (
											<div className="typo-body-xs text-text-secondary line-clamp-1">
												{h.display}
											</div>
										)}
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

function labelView(item: ItemInstance<TreeViewItem<ItemMeta>>) {
	const metaType = item.getItemData()?.meta?.type;
	const isFolder = item.isFolder();
	const isSectionFolder = metaType === "properties" || metaType === "include";

	const additionalClass = isSectionFolder
		? "text-text-info-primary px-1!"
		: "text-text-info-primary bg-bg-info-primary";

	const kind = item.getItemData()?.meta?.kind;
	let label: string | undefined = metaType;
	if (metaType === "include") label = kind ?? "include";
	else if (metaType === "include-row") label = "codesystem";
	else if (metaType === "include-concept") label = "concept";
	else if (metaType === "include-filter") label = "filter";

	const onLabelClickFn = (e: React.MouseEvent) => {
		if (!isFolder) return;
		e.stopPropagation();
		if (item.isExpanded()) item.collapse();
		else item.expand();
	};

	return (
		<button
			type="button"
			className={`uppercase px-1.5 py-0.5 ${isFolder ? "cursor-pointer" : ""} rounded-md ${additionalClass}`}
			onClick={onLabelClickFn}
		>
			{label}
		</button>
	);
}

export function PropertiesTree() {
	const { valueSet, updateValueSet } = useValueSetContext();

	const updateUrl = (value: string) => {
		updateValueSet((vs) => ({ ...vs, url: value || undefined }));
	};
	const updateVersion = (value: string) => {
		updateValueSet((vs) => ({ ...vs, version: value || undefined }));
	};
	const updateTitle = (value: string) => {
		updateValueSet((vs) => ({ ...vs, title: value || undefined }));
	};
	const updateDescription = (value: string) => {
		updateValueSet((vs) => ({ ...vs, description: value || undefined }));
	};

	const includes = valueSet.compose?.include ?? [];
	const excludes = valueSet.compose?.exclude ?? [];
	const entriesOf = (kind: IncludeKind) =>
		kind === "include" ? includes : excludes;

	const tree: Record<string, TreeViewItem<ItemMeta>> = React.useMemo(() => {
		const out: Record<string, TreeViewItem<ItemMeta>> = {
			root: {
				name: "root",
				children: ["_properties", "_include", "_exclude"],
			},
			_properties: {
				name: "_properties",
				meta: { type: "properties" },
				children: ["_url", "_version", "_title", "_description"],
			},
			_url: { name: "_url", meta: { type: "url" } },
			_version: { name: "_version", meta: { type: "version" } },
			_title: { name: "_title", meta: { type: "title" } },
			_description: { name: "_description", meta: { type: "description" } },
		};

		const buildKind = (kind: IncludeKind, entries: typeof includes) => {
			const sectionId = `_${kind}`;
			const addId = `_${kind}_add`;
			const entryIds = entries.map((_, i) => `${sectionId}_${i}`);
			out[sectionId] = {
				name: sectionId,
				meta: { type: "include", kind },
				children: [...entryIds, addId],
			};
			out[addId] = {
				name: addId,
				meta: { type: "include-add", kind },
			};
			// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: large nested tree-node builder
			entries.forEach((entry, i) => {
				const rowId = `${sectionId}_${i}`;
				const conceptChildren = (entry.concept ?? []).map(
					(_, ci) => `${rowId}_concept_${ci}`,
				);
				const filterChildren = (entry.filter ?? []).map(
					(_, fi) => `${rowId}_filter_${fi}`,
				);
				const hasConcept = (entry.concept?.length ?? 0) > 0;
				const hasFilter = (entry.filter?.length ?? 0) > 0;
				// vsd-3 inherited via contentReference — applies to exclude too
				const showConcept = hasConcept || !hasFilter;
				const showFilter = hasFilter || !hasConcept;
				const rowChildren: string[] = [];
				if (showConcept) rowChildren.push(`${rowId}_concept`);
				if (showFilter) rowChildren.push(`${rowId}_filter`);
				out[rowId] = {
					name: rowId,
					meta: { type: "include-row", kind, includeIndex: i },
					children: rowChildren,
				};

				if (showConcept) {
					const conceptSectionChildren = hasFilter
						? conceptChildren
						: [...conceptChildren, `${rowId}_concept_add`];
					out[`${rowId}_concept`] = {
						name: `${rowId}_concept`,
						meta: { type: "include-concept", kind, includeIndex: i },
						...(conceptSectionChildren.length > 0
							? { children: conceptSectionChildren }
							: {}),
					};
					if (!hasFilter) {
						out[`${rowId}_concept_add`] = {
							name: `${rowId}_concept_add`,
							meta: { type: "include-concept-add", kind, includeIndex: i },
						};
					}
					(entry.concept ?? []).forEach((_, ci) => {
						out[`${rowId}_concept_${ci}`] = {
							name: `${rowId}_concept_${ci}`,
							meta: {
								type: "include-concept-row",
								kind,
								includeIndex: i,
								conceptIndex: ci,
							},
						};
					});
				}

				if (showFilter) {
					const filterSectionChildren = hasConcept
						? filterChildren
						: [...filterChildren, `${rowId}_filter_add`];
					out[`${rowId}_filter`] = {
						name: `${rowId}_filter`,
						meta: { type: "include-filter", kind, includeIndex: i },
						...(filterSectionChildren.length > 0
							? { children: filterSectionChildren }
							: {}),
					};
					if (!hasConcept) {
						out[`${rowId}_filter_add`] = {
							name: `${rowId}_filter_add`,
							meta: { type: "include-filter-add", kind, includeIndex: i },
						};
					}
					(entry.filter ?? []).forEach((_, fi) => {
						out[`${rowId}_filter_${fi}`] = {
							name: `${rowId}_filter_${fi}`,
							meta: {
								type: "include-filter-row",
								kind,
								includeIndex: i,
								filterIndex: fi,
							},
						};
					});
				}
			});
		};

		buildKind("include", includes);
		buildKind("exclude", excludes);
		return out;
	}, [includes, excludes]);

	const [expandedItems, setExpandedItems] = React.useState<string[]>([
		"_properties",
		"_include",
		"_exclude",
	]);

	// auto-expand each entry's nested sections on first appearance only.
	// Without the `seen` ref this useEffect would re-expand every node on
	// each render (because includes/excludes are re-derived arrays), undoing
	// the user's manual collapse.
	const autoExpandedRef = React.useRef<Set<string>>(new Set());
	React.useEffect(() => {
		const need: string[] = [];
		const collect = (kind: IncludeKind, arr: typeof includes) => {
			arr.forEach((_, i) => {
				const row = `_${kind}_${i}`;
				const c = `${row}_concept`;
				const f = `${row}_filter`;
				for (const id of [row, c, f]) {
					if (!autoExpandedRef.current.has(id)) {
						autoExpandedRef.current.add(id);
						need.push(id);
					}
				}
			});
		};
		collect("include", includes);
		collect("exclude", excludes);
		if (need.length === 0) return;
		setExpandedItems((prev) => {
			const missing = need.filter((id) => !prev.includes(id));
			if (missing.length === 0) return prev;
			return [...prev, ...missing];
		});
	}, [includes, excludes]);

	const mutateCompose = (
		kind: IncludeKind,
		fn: (arr: typeof includes) => typeof includes,
	) => {
		updateValueSet((vs) => {
			const arr = (vs.compose?.[kind] ?? []).slice();
			const next = fn(arr);
			return {
				...vs,
				compose: {
					...(vs.compose ?? {}),
					[kind]: next.length > 0 ? next : undefined,
				},
			};
		});
	};

	const addCodeSystem = (kind: IncludeKind) =>
		mutateCompose(kind, (arr) => [...arr, { system: "" }]);

	const addValueSetEntry = (kind: IncludeKind) =>
		mutateCompose(kind, (arr) => [...arr, { valueSet: [""] }]);

	const updateEntrySystemVersion = (
		kind: IncludeKind,
		i: number,
		next: { system?: string; version?: string },
	) =>
		mutateCompose(kind, (arr) => {
			const a = arr.slice();
			a[i] = { ...a[i], system: next.system, version: next.version };
			return a;
		});

	const removeEntry = (kind: IncludeKind, i: number) =>
		mutateCompose(kind, (arr) => arr.filter((_, idx) => idx !== i));

	const mutateEntry = (
		kind: IncludeKind,
		i: number,
		fn: (
			inc: NonNullable<typeof includes>[number],
		) => (typeof includes)[number],
	) =>
		mutateCompose(kind, (arr) => {
			const a = arr.slice();
			a[i] = fn(a[i] ?? {});
			return a;
		});

	const addConcept = (kind: IncludeKind, i: number) =>
		mutateEntry(kind, i, (inc) => ({
			...inc,
			concept: [...(inc.concept ?? []), {}],
		}));
	const updateConcept = (
		kind: IncludeKind,
		i: number,
		ci: number,
		patch: { code?: string; display?: string },
	) =>
		mutateEntry(kind, i, (inc) => {
			const arr = (inc.concept ?? []).slice();
			arr[ci] = { ...arr[ci], ...patch };
			return { ...inc, concept: arr };
		});
	const removeConcept = (kind: IncludeKind, i: number, ci: number) =>
		mutateEntry(kind, i, (inc) => {
			const arr = (inc.concept ?? []).filter((_, idx) => idx !== ci);
			return { ...inc, concept: arr.length > 0 ? arr : undefined };
		});

	const updateEntryValueSet = (
		kind: IncludeKind,
		i: number,
		url: string | undefined,
	) =>
		mutateEntry(kind, i, (inc) => ({
			...inc,
			valueSet: url ? [url] : [""],
		}));

	const addFilter = (kind: IncludeKind, i: number) =>
		mutateEntry(kind, i, (inc) => ({
			...inc,
			filter: [...(inc.filter ?? []), { op: "is-a" }],
		}));
	const updateFilter = (
		kind: IncludeKind,
		i: number,
		fi: number,
		patch: { property?: string; op?: string; value?: string },
	) =>
		mutateEntry(kind, i, (inc) => {
			const arr = (inc.filter ?? []).slice();
			arr[fi] = { ...arr[fi], ...patch };
			return { ...inc, filter: arr };
		});
	const removeFilter = (kind: IncludeKind, i: number, fi: number) =>
		mutateEntry(kind, i, (inc) => {
			const arr = (inc.filter ?? []).filter((_, idx) => idx !== fi);
			return { ...inc, filter: arr.length > 0 ? arr : undefined };
		});

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: large switch over tree node types
	const customItemView = (item: ItemInstance<TreeViewItem<ItemMeta>>) => {
		const meta = item.getItemData()?.meta;
		const metaType = meta?.type;
		switch (metaType) {
			case "properties":
			case "include":
				return <div>{labelView(item)}</div>;
			case "include-row": {
				const kind = meta?.kind ?? "include";
				const idx = meta?.includeIndex ?? -1;
				const entry = entriesOf(kind)[idx];
				if (!entry) return null;
				if (isVsInclude(entry)) {
					return (
						<div className="flex w-full items-center gap-2">
							<div className="w-[202px] shrink-0">
								<button
									type="button"
									className="uppercase px-1.5 py-0.5 cursor-pointer rounded-md text-text-info-primary bg-bg-info-primary"
								>
									valueset
								</button>
							</div>
							<ValueSetPicker
								value={entry.valueSet?.[0]}
								onChange={(v) => updateEntryValueSet(kind, idx, v)}
							/>
							<HSComp.Button
								variant="link"
								size="small"
								className="shrink-0 group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
								onClick={() => removeEntry(kind, idx)}
								asChild
							>
								<span>
									<X size={14} />
								</span>
							</HSComp.Button>
						</div>
					);
				}
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[202px] shrink-0">{labelView(item)}</div>
						<CodeSystemPicker
							system={entry.system}
							version={entry.version}
							onChange={(next) => updateEntrySystemVersion(kind, idx, next)}
						/>
						<HSComp.Button
							variant="link"
							size="small"
							className="shrink-0 group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
							onClick={() => removeEntry(kind, idx)}
							asChild
						>
							<span>
								<X size={14} />
							</span>
						</HSComp.Button>
					</div>
				);
			}
			case "include-concept":
			case "include-filter":
				return <div>{labelView(item)}</div>;
			case "include-concept-row": {
				const kind = meta?.kind ?? "include";
				const idx = meta?.includeIndex ?? -1;
				const ci = meta?.conceptIndex ?? -1;
				const parent = entriesOf(kind)[idx];
				const entry = parent?.concept?.[ci];
				if (!entry) return null;
				return (
					<div className="flex w-full items-center gap-2 pl-0.5">
						<span className="text-utility-yellow bg-utility-yellow/20 rounded-md p-1 shrink-0">
							<Tag size={12} />
						</span>
						<div className="w-[152px] shrink-0">
							<ConceptCodePicker
								system={parent?.system}
								code={entry.code}
								onChange={(next) =>
									updateConcept(kind, idx, ci, {
										code: next.code,
										// auto-fill display only when picked from suggestions
										...(next.display !== undefined
											? { display: next.display }
											: {}),
									})
								}
							/>
						</div>
						<div className="flex-1 min-w-0">
							<InputView
								placeholder="Text to display for this code for this value set in this valueset"
								value={entry.display}
								onChange={(v) =>
									updateConcept(kind, idx, ci, { display: v || undefined })
								}
							/>
						</div>
						<HSComp.Button
							variant="link"
							size="small"
							className="shrink-0 group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
							onClick={() => removeConcept(kind, idx, ci)}
							asChild
						>
							<span>
								<X size={14} />
							</span>
						</HSComp.Button>
					</div>
				);
			}
			case "include-concept-add": {
				const kind = meta?.kind ?? "include";
				const idx = meta?.includeIndex ?? -1;
				if ((entriesOf(kind)[idx]?.filter?.length ?? 0) > 0) return null;
				return (
					<HSComp.Button
						variant="link"
						size="small"
						className="px-0"
						onClick={() => addConcept(kind, idx)}
						asChild
					>
						<span>
							<Plus size={16} strokeWidth={3} />
							<span className="text-xs typo-label">Concept</span>
						</span>
					</HSComp.Button>
				);
			}
			case "include-filter-row": {
				const kind = meta?.kind ?? "include";
				const idx = meta?.includeIndex ?? -1;
				const fi = meta?.filterIndex ?? -1;
				const entry = entriesOf(kind)[idx]?.filter?.[fi];
				if (!entry) return null;
				return (
					<div className="flex w-full items-center gap-2 pl-0.5">
						<span className="text-utility-yellow bg-utility-yellow/20 rounded-md p-1 shrink-0">
							<Filter size={12} />
						</span>
						<div className="w-[152px] shrink-0">
							<InputView
								placeholder="property"
								value={entry.property}
								onChange={(v) =>
									updateFilter(kind, idx, fi, { property: v || undefined })
								}
							/>
						</div>
						<div className="w-[140px] shrink-0">
							<HSComp.Select
								value={entry.op ?? ""}
								onValueChange={(v) => updateFilter(kind, idx, fi, { op: v })}
							>
								<HSComp.SelectTrigger className="h-7 py-1 px-2 bg-bg-primary border-none hover:bg-bg-quaternary focus:bg-bg-primary focus:ring-1 focus:ring-border-link group-hover/tree-item-label:bg-bg-tertiary">
									<HSComp.SelectValue placeholder="op" />
								</HSComp.SelectTrigger>
								<HSComp.SelectContent>
									{FILTER_OPS.map((op) => (
										<HSComp.SelectItem key={op} value={op}>
											{op}
										</HSComp.SelectItem>
									))}
								</HSComp.SelectContent>
							</HSComp.Select>
						</div>
						<div className="flex-1 min-w-0">
							<InputView
								placeholder="value"
								value={entry.value}
								onChange={(v) =>
									updateFilter(kind, idx, fi, { value: v || undefined })
								}
							/>
						</div>
						<HSComp.Button
							variant="link"
							size="small"
							className="shrink-0 group-hover/tree-item-label:opacity-100 opacity-0 transition-opacity"
							onClick={() => removeFilter(kind, idx, fi)}
							asChild
						>
							<span>
								<X size={14} />
							</span>
						</HSComp.Button>
					</div>
				);
			}
			case "include-filter-add": {
				const kind = meta?.kind ?? "include";
				const idx = meta?.includeIndex ?? -1;
				if ((entriesOf(kind)[idx]?.concept?.length ?? 0) > 0) return null;
				return (
					<HSComp.Button
						variant="link"
						size="small"
						className="px-0"
						onClick={() => addFilter(kind, idx)}
						asChild
					>
						<span>
							<Plus size={16} strokeWidth={3} />
							<span className="text-xs typo-label">Filter</span>
						</span>
					</HSComp.Button>
				);
			}
			case "include-add": {
				const kind = meta?.kind ?? "include";
				const label = kind === "include" ? "Include" : "Exclude";
				return (
					<HSComp.DropdownMenu>
						<HSComp.DropdownMenuTrigger asChild>
							<HSComp.Button
								variant="link"
								size="small"
								className="px-0"
								asChild
							>
								<span>
									<Plus size={16} strokeWidth={3} />
									<span className="text-xs typo-label">{label}</span>
								</span>
							</HSComp.Button>
						</HSComp.DropdownMenuTrigger>
						<HSComp.DropdownMenuContent align="start">
							<HSComp.DropdownMenuItem onSelect={() => addCodeSystem(kind)}>
								CodeSystem
							</HSComp.DropdownMenuItem>
							<HSComp.DropdownMenuItem onSelect={() => addValueSetEntry(kind)}>
								ValueSet
							</HSComp.DropdownMenuItem>
						</HSComp.DropdownMenuContent>
					</HSComp.DropdownMenu>
				);
			}
			case "url":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[226px] shrink-0">{labelView(item)}</div>
						<div className="w-[50%]">
							<InputView
								placeholder="Canonical identifier for this value set, represented as a URI (globally unique)"
								value={valueSet.url}
								onChange={updateUrl}
							/>
						</div>
					</div>
				);
			case "version":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[226px] shrink-0">{labelView(item)}</div>
						<div className="w-[50%]">
							<InputView
								placeholder="Business version of the value set"
								value={valueSet.version}
								onChange={updateVersion}
							/>
						</div>
					</div>
				);
			case "title":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[226px] shrink-0">{labelView(item)}</div>
						<div className="w-[50%]">
							<InputView
								placeholder="Name for this value set (human friendly)"
								value={valueSet.title}
								onChange={updateTitle}
							/>
						</div>
					</div>
				);
			case "description":
				return (
					<div className="flex w-full items-center gap-2">
						<div className="w-[226px] shrink-0">{labelView(item)}</div>
						<div className="flex-1 min-w-0">
							<InputView
								placeholder="Natural language description of the value set"
								value={valueSet.description}
								onChange={updateDescription}
							/>
						</div>
					</div>
				);
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
					if (metaType === "properties" || metaType === "include") {
						return "relative my-1.5 rounded-md bg-bg-info-primary cursor-pointer before:content-[''] before:absolute before:inset-x-0 before:top-0 before:bottom-0 before:-z-10 before:bg-bg-primary before:-my-1.5 after:content-[''] after:absolute after:inset-x-0 after:top-0 after:bottom-0 after:-z-10 after:bg-bg-primary after:rounded-md after:-my-1.5";
					}
					return "pr-0";
				}}
			/>
		</div>
	);
}
