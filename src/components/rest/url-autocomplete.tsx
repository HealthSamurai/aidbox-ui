import {
	cn,
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useAidboxClient } from "../../AidboxClient";

// ─── Types ──────────────────────────────────────────────────────────────────

type RoutesTree = Record<string, unknown>;

interface Suggestion {
	label: string;
	value: string;
	type: "path" | "resource-type" | "operation" | "search-param";
	description?: string;
	expression?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const INTERNAL_KEYS = new Set([...HTTP_METHODS, "route-map/enum"]);
const HIDDEN_RESOURCE_TYPES = new Set(["FHIRSchema"]);
const MAX_SUGGESTIONS = 30;

const COMMON_SEARCH_PARAMS = [
	"_id",
	"_lastUpdated",
	"_tag",
	"_profile",
	"_security",
	"_text",
	"_content",
	"_sort",
	"_count",
	"_include",
	"_revinclude",
	"_summary",
	"_total",
	"_elements",
];

// ─── Route tree helpers ─────────────────────────────────────────────────────

function getChildKeys(node: RoutesTree): string[] {
	return Object.keys(node).filter((k) => !INTERNAL_KEYS.has(k));
}

function isParamKey(key: string): boolean {
	return key.startsWith("[:") && key.endsWith("]");
}

function getNode(parent: RoutesTree, key: string): RoutesTree | null {
	const val = parent[key];
	if (val && typeof val === "object" && !Array.isArray(val)) {
		return val as RoutesTree;
	}
	return null;
}

function getEnum(node: RoutesTree): string[] {
	const val = node["route-map/enum"];
	return Array.isArray(val) ? (val as string[]) : [];
}

function matchSegment(
	node: RoutesTree,
	segment: string,
): { next: RoutesTree; paramKey?: string } | null {
	if (!isParamKey(segment)) {
		const literal = getNode(node, segment);
		if (literal) return { next: literal };
	}

	for (const key of getChildKeys(node)) {
		if (!isParamKey(key)) continue;
		const child = getNode(node, key);
		if (!child) continue;
		const enumVals = getEnum(child);
		if (enumVals.length === 0 || enumVals.includes(segment)) {
			return { next: child, paramKey: key };
		}
	}

	return null;
}

function nodeSupportsMethod(node: RoutesTree, method: string): boolean {
	if (method in node) return true;
	for (const key of getChildKeys(node)) {
		const child = getNode(node, key);
		if (child && nodeSupportsMethod(child, method)) return true;
	}
	return false;
}

// ─── Suggestion computation ─────────────────────────────────────────────────

function computePathSuggestions(
	tree: RoutesTree,
	input: string,
	method: string,
): Suggestion[] {
	if (input.includes("?")) return [];

	const normalized = input.startsWith("/") ? input : `/${input}`;
	const segments = normalized.split("/").slice(1);
	let currentNode = tree;

	for (let i = 0; i < segments.length - 1; i++) {
		const match = matchSegment(currentNode, segments[i]);
		if (!match) return [];
		currentNode = match.next;
	}

	const partial = segments[segments.length - 1].toLowerCase();
	const basePath = `/${segments.slice(0, -1).join("/")}`;
	const prefix = basePath === "/" ? "/" : `${basePath}/`;
	const suggestions: Suggestion[] = [];
	const seen = new Set<string>();

	// Only show resource types under /fhir/, not at root level
	const isRootLevel = segments.length === 1;

	for (const key of getChildKeys(currentNode)) {
		if (isParamKey(key)) {
			if (partial.length === 0) continue;
			if (isRootLevel) continue;
			const child = getNode(currentNode, key);
			if (!child) continue;
			if (!nodeSupportsMethod(child, method)) continue;
			for (const val of getEnum(child)) {
				if (HIDDEN_RESOURCE_TYPES.has(val)) continue;
				if (!val.toLowerCase().startsWith(partial)) continue;
				if (seen.has(val)) continue;
				seen.add(val);
				suggestions.push({
					label: val,
					value: prefix + val,
					type: "resource-type",
				});
			}
		} else {
			if (!key.toLowerCase().startsWith(partial)) continue;
			if (isRootLevel && key[0] >= "A" && key[0] <= "Z") continue;
			const child = getNode(currentNode, key);
			if (child && !nodeSupportsMethod(child, method)) continue;
			if (seen.has(key)) continue;
			seen.add(key);
			suggestions.push({
				label: key,
				value: prefix + key,
				type: key.startsWith("$") || key.startsWith("_") ? "operation" : "path",
			});
		}
	}

	suggestions.sort((a, b) => {
		const aFhir = a.label === "fhir" ? 0 : 1;
		const bFhir = b.label === "fhir" ? 0 : 1;
		if (aFhir !== bFhir) return aFhir - bFhir;
		const order = {
			path: 0,
			operation: 1,
			"resource-type": 2,
			"search-param": 3,
		};
		const diff = order[a.type] - order[b.type];
		return diff !== 0 ? diff : a.label.localeCompare(b.label);
	});

	return suggestions.slice(0, MAX_SUGGESTIONS);
}

function detectResourceType(tree: RoutesTree, path: string): string | null {
	const normalized = path.startsWith("/") ? path : `/${path}`;
	const pathPart = normalized.split("?")[0];
	const segments = pathPart.split("/").filter(Boolean);
	let node = tree;
	let lastResourceType: string | null = null;

	for (const segment of segments) {
		for (const key of getChildKeys(node)) {
			if (!isParamKey(key)) continue;
			const child = getNode(node, key);
			if (child && getEnum(child).includes(segment)) {
				lastResourceType = segment;
				break;
			}
		}

		const match = matchSegment(node, segment);
		if (!match) break;
		node = match.next;
	}

	return lastResourceType;
}

function filterExpression(
	expression: string | undefined,
	resourceType: string | null,
): string | undefined {
	if (!expression || !resourceType) return expression;
	const parts = expression.split("|").map((p) => p.trim());
	const matched = parts.filter((p) => p.startsWith(`${resourceType}.`));
	return matched.length > 0 ? matched.join(" | ") : expression;
}

function computeSearchParamSuggestions(
	path: string,
	searchParams: { code: string; type?: string; expression?: string }[],
	resourceType: string | null,
): Suggestion[] {
	const queryIndex = path.indexOf("?");
	if (queryIndex === -1) return [];

	const pathPart = path.substring(0, queryIndex);
	const queryPart = path.substring(queryIndex + 1);
	const params = queryPart.split("&");
	const lastParam = params[params.length - 1];

	if (lastParam.includes("=")) return [];

	const partial = lastParam.toLowerCase();
	const usedParams = new Set(
		params.slice(0, -1).map((p) => p.split("=")[0].toLowerCase()),
	);

	const allParams: { code: string; type?: string; expression?: string }[] = [
		...searchParams,
		...COMMON_SEARCH_PARAMS.map((p) => ({ code: p })),
	];

	const suggestions: Suggestion[] = [];
	const seen = new Set<string>();

	for (const param of allParams) {
		if (usedParams.has(param.code.toLowerCase())) continue;
		if (partial.length > 0 && !param.code.toLowerCase().startsWith(partial))
			continue;
		if (seen.has(param.code)) continue;
		seen.add(param.code);

		const newParams = [...params.slice(0, -1), `${param.code}=`];
		suggestions.push({
			label: param.code,
			value: `${pathPart}?${newParams.join("&")}`,
			type: "search-param",
			description: param.type,
			expression: filterExpression(param.expression, resourceType),
		});
	}

	suggestions.sort((a, b) => a.label.localeCompare(b.label));
	return suggestions.slice(0, MAX_SUGGESTIONS);
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

function useRoutes() {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["$routes"],
		queryFn: async () => {
			const result = await client.rawRequest({
				method: "GET",
				url: "/$routes",
				headers: { Accept: "application/json" },
			});
			return (await result.response.json()) as RoutesTree;
		},
		staleTime: Number.POSITIVE_INFINITY,
		refetchOnWindowFocus: false,
		retry: 1,
	});
}

function useSearchParams(resourceType: string | null) {
	const client = useAidboxClient();
	return useQuery({
		queryKey: ["search-params", resourceType],
		queryFn: async () => {
			const response = await client.rawRequest({
				method: "GET",
				url: `/fhir/SearchParameter?base=${resourceType}&_count=500&_elements=code,type,expression`,
				headers: { "Content-Type": "application/json" },
			});
			const data = (await response.response.json()) as {
				entry?: {
					resource: { code: string; type?: string; expression?: string };
				}[];
			};
			return (data.entry || []).map((e) => e.resource);
		},
		enabled: !!resourceType,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
	});
}

// ─── Component ──────────────────────────────────────────────────────────────

interface UrlAutocompleteProps {
	path: string;
	method: string;
	onSelectSuggestion: (path: string) => void;
	onSubmit: () => void;
	children: ReactNode;
}

export function UrlAutocomplete({
	path,
	method,
	onSelectSuggestion,
	onSubmit,
	children,
}: UrlAutocompleteProps) {
	const [focused, setFocused] = useState(false);
	const [suppressed, setSuppressed] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const blurTimerRef = useRef<ReturnType<typeof setTimeout>>();

	const { data: routesTree } = useRoutes();

	const resourceType = useMemo(
		() => (routesTree ? detectResourceType(routesTree, path) : null),
		[routesTree, path],
	);

	const { data: searchParams } = useSearchParams(resourceType);

	const suggestions = useMemo(() => {
		if (!path || !routesTree) return [];
		if (path.includes("?")) {
			return computeSearchParamSuggestions(
				path,
				searchParams || [],
				resourceType,
			);
		}
		return computePathSuggestions(routesTree, path, method);
	}, [path, method, routesTree, searchParams, resourceType]);

	const open = focused && suggestions.length > 0 && !suppressed;

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset index when suggestions change
	useEffect(() => {
		setSelectedIndex(0);
	}, [suggestions]);

	useEffect(() => {
		if (!open || !listRef.current) return;
		const item = listRef.current.children[selectedIndex] as HTMLElement;
		item?.scrollIntoView({ block: "nearest" });
	}, [selectedIndex, open]);

	useEffect(() => {
		return () => clearTimeout(blurTimerRef.current);
	}, []);

	const applySuggestion = useCallback(
		(suggestion: Suggestion) => {
			setSuppressed(true);
			onSelectSuggestion(suggestion.value);
		},
		[onSelectSuggestion],
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (open) {
				switch (event.key) {
					case "ArrowDown":
						event.preventDefault();
						setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
						return;
					case "ArrowUp":
						event.preventDefault();
						setSelectedIndex((i) => Math.max(i - 1, 0));
						return;
					case "Enter":
					case "Tab":
						event.preventDefault();
						applySuggestion(suggestions[selectedIndex]);
						return;
					case "Escape":
						event.preventDefault();
						setSuppressed(true);
						return;
				}
			}

			if (
				event.key === "Enter" &&
				!event.ctrlKey &&
				!event.shiftKey &&
				!event.metaKey &&
				!event.altKey
			) {
				event.preventDefault();
				onSubmit();
			}
		},
		[open, suggestions, selectedIndex, applySuggestion, onSubmit],
	);

	return (
		<Popover open={open}>
			<PopoverAnchor asChild>
				{/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard shortcut handler on layout container */}
				<div
					ref={wrapperRef}
					className="w-full"
					onKeyDown={handleKeyDown}
					onInputCapture={() => setSuppressed(false)}
					onFocusCapture={() => {
						clearTimeout(blurTimerRef.current);
						setFocused(true);
					}}
					onBlurCapture={() => {
						blurTimerRef.current = setTimeout(() => {
							setFocused(false);
							setSuppressed(false);
						}, 200);
					}}
				>
					{children}
				</div>
			</PopoverAnchor>
			{open && (
				<PopoverContent
					align="start"
					sideOffset={4}
					alignOffset={(() => {
						const wrapper = wrapperRef.current;
						const input = wrapper?.querySelector<HTMLElement>(
							'[data-slot="input"]',
						);
						if (!wrapper || !input) return 0;
						return (
							input.getBoundingClientRect().left -
							wrapper.getBoundingClientRect().left
						);
					})()}
					className="p-1 overflow-hidden"
					style={{
						width: wrapperRef.current
							?.querySelector<HTMLElement>('[data-slot="input"]')
							?.getBoundingClientRect().width,
					}}
					onOpenAutoFocus={(e) => e.preventDefault()}
					onCloseAutoFocus={(e) => e.preventDefault()}
				>
					{/* biome-ignore lint/a11y/useSemanticElements: custom popover listbox pattern */}
					<div
						ref={listRef}
						role="listbox"
						className="max-h-60 overflow-y-auto"
					>
						{suggestions.map((suggestion, index) => (
							// biome-ignore lint/a11y/useFocusableInteractive: keyboard handled by parent wrapper
							// biome-ignore lint/a11y/useSemanticElements: custom popover listbox pattern
							<div
								role="option"
								aria-selected={index === selectedIndex}
								key={suggestion.value}
								className={cn(
									"flex flex-col px-2 py-1.5 rounded-sm cursor-pointer",
									index === selectedIndex
										? "bg-bg-tertiary text-text-primary"
										: "text-text-secondary hover:bg-bg-secondary",
								)}
								onMouseDown={(e) => {
									e.preventDefault();
									applySuggestion(suggestion);
								}}
								onMouseEnter={() => setSelectedIndex(index)}
							>
								<span className="flex items-baseline gap-2 text-xs">
									<span className="truncate text-text-primary">
										{suggestion.label}
									</span>
									<SuggestionBadge
										type={suggestion.type}
										description={suggestion.description}
									/>
								</span>
								{suggestion.expression && (
									<span className="truncate text-text-tertiary text-xs leading-normal">
										{suggestion.expression}
									</span>
								)}
							</div>
						))}
					</div>
				</PopoverContent>
			)}
		</Popover>
	);
}

function SuggestionBadge({
	type,
	description,
}: {
	type: Suggestion["type"];
	description?: string;
}) {
	const label =
		type === "search-param"
			? description || "param"
			: type === "resource-type"
				? "resource"
				: type === "operation"
					? "op"
					: null;

	if (!label) return null;

	return (
		<span className="text-text-tertiary typo-label-tiny shrink-0">{label}</span>
	);
}
