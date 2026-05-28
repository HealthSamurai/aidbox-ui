import * as HSComp from "@health-samurai/react-components";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	Link,
	useNavigate,
	useParams,
	useSearch,
} from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	Loader2Icon,
	RefreshCwIcon,
	Search,
	Trash2Icon,
	X,
} from "lucide-react";
import {
	type RefObject,
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { AidboxClientR5 } from "../../AidboxClient";
import { useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useWebMCPPackageDetail } from "../../webmcp/package-detail";
import type { PackageDetailActions } from "../../webmcp/package-detail-context";

type Installation = {
	intention?: string;
	cts?: string;
	source?: { "registry-url"?: string; type?: string };
};

type PackageMeta = {
	name: string;
	version: string;
	title?: string;
	author?: string;
	homepage?: string;
	description?: string;
	type?: string;
	fhirVersions?: string[];
	dependencies?: Record<string, string>;
	installation?: Installation[];
};

function usePackageMeta(packageId: string) {
	const client = useAidboxClient();

	return useQuery<PackageMeta>({
		queryKey: ["ig-package-meta", packageId],
		staleTime: 5 * 60 * 1000,
		queryFn: async () => {
			const response = await client.rawRequest({
				method: "POST",
				url: "/rpc?_m=aidbox.introspector/get-package-meta",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					method: "aidbox.introspector/get-package-meta",
					params: { "package-coordinate": packageId },
				}),
			});
			const json = await response.response.json();
			return json.data ?? json.result ?? {};
		},
	});
}

async function rpcCall(
	client: AidboxClientR5,
	method: string,
	params: Record<string, unknown>,
) {
	const response = await client.rawRequest({
		method: "POST",
		url: `/rpc?_m=${method}`,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ method, params }),
	});
	const json = await response.response.json();
	if (json.error) throw new Error(json.error.message || "RPC error");
	return json;
}

const MANAGEABLE_SYSTEM_PACKAGES = new Set([
	"io.health-samurai.de-identification.r4",
]);

function isSystemPackage(name: string) {
	return (
		name.startsWith("io.health-samurai.") &&
		!MANAGEABLE_SYSTEM_PACKAGES.has(name)
	);
}

function isCorePackage(type?: string) {
	return type === "fhir.core" || type === "core";
}

function DeletePackageButton({
	meta,
	deleteMutate,
	deleteIsPending,
}: {
	meta: PackageMeta;
	deleteMutate: () => void;
	deleteIsPending: boolean;
}) {
	const client = useAidboxClient();
	const [dependents, setDependents] = useState<
		{ name: string; version: string }[]
	>([]);
	const [open, setOpen] = useState(false);

	const disabledReason = isSystemPackage(meta.name)
		? "Embedded Aidbox package can't be removed"
		: isCorePackage(meta.type)
			? "FHIR core package can't be removed"
			: null;

	const handleOpen = async () => {
		try {
			const result = await rpcCall(
				client,
				"aidbox.profiles/retrieve-packages-depending-on",
				{
					"package-name": meta.name,
					"package-version": meta.version,
				},
			);
			setDependents(Array.isArray(result.result) ? result.result : []);
		} catch {
			setDependents([]);
		}
		setOpen(true);
	};

	const pending = deleteIsPending;

	return (
		<HSComp.AlertDialog
			open={open}
			onOpenChange={(v) => {
				if (!pending) setOpen(v);
			}}
		>
			<HSComp.Tooltip>
				<HSComp.TooltipTrigger asChild>
					<span>
						<HSComp.Button
							variant="link"
							size="small"
							danger
							disabled={!!disabledReason}
							onClick={handleOpen}
						>
							<Trash2Icon className="w-4 h-4" />
							Delete
						</HSComp.Button>
					</span>
				</HSComp.TooltipTrigger>
				{disabledReason && (
					<HSComp.TooltipContent>{disabledReason}</HSComp.TooltipContent>
				)}
			</HSComp.Tooltip>
			<HSComp.AlertDialogContent>
				<HSComp.AlertDialogHeader>
					<HSComp.AlertDialogTitle>
						Delete {meta.name}#{meta.version}
					</HSComp.AlertDialogTitle>
				</HSComp.AlertDialogHeader>
				<HSComp.AlertDialogDescription>
					Are you sure you want to delete this package? This action cannot be
					undone.
					{dependents.length > 0 && (
						<div className="mt-3">
							<span className="font-medium text-text-primary">
								The following packages depend on this package:
							</span>
							<ul className="mt-1 list-disc pl-5 text-text-secondary">
								{dependents.map((dep) => (
									<li key={`${dep.name}#${dep.version}`}>
										{dep.name}#{dep.version}
									</li>
								))}
							</ul>
						</div>
					)}
				</HSComp.AlertDialogDescription>
				<HSComp.AlertDialogFooter>
					<HSComp.AlertDialogCancel disabled={pending}>
						Cancel
					</HSComp.AlertDialogCancel>
					<HSComp.AlertDialogAction
						danger
						disabled={pending}
						onClick={(e) => {
							e.preventDefault();
							deleteMutate();
						}}
					>
						{pending && <Loader2Icon className="w-4 h-4 animate-spin" />}
						{pending ? "Deleting…" : "Delete"}
					</HSComp.AlertDialogAction>
				</HSComp.AlertDialogFooter>
			</HSComp.AlertDialogContent>
		</HSComp.AlertDialog>
	);
}

function ReinstallPackageButton({
	meta,
	reinstallMutate,
	reinstallIsPending,
}: {
	meta: PackageMeta;
	reinstallMutate: () => void;
	reinstallIsPending: boolean;
}) {
	const [open, setOpen] = useState(false);
	const wasPendingRef = useRef(false);

	useEffect(() => {
		if (reinstallIsPending) {
			wasPendingRef.current = true;
		} else if (wasPendingRef.current) {
			wasPendingRef.current = false;
			setOpen(false);
		}
	}, [reinstallIsPending]);

	const disabledReason = isSystemPackage(meta.name)
		? "Embedded Aidbox package can't be reinstalled"
		: null;

	const pending = reinstallIsPending;

	return (
		<HSComp.AlertDialog
			open={open}
			onOpenChange={(v) => {
				if (!pending) setOpen(v);
			}}
		>
			<HSComp.Tooltip>
				<HSComp.TooltipTrigger asChild>
					<span>
						<HSComp.AlertDialogTrigger asChild>
							<HSComp.Button
								variant="ghost"
								size="small"
								disabled={!!disabledReason}
							>
								<RefreshCwIcon className="w-4 h-4" />
								Reinstall
							</HSComp.Button>
						</HSComp.AlertDialogTrigger>
					</span>
				</HSComp.TooltipTrigger>
				{disabledReason && (
					<HSComp.TooltipContent>{disabledReason}</HSComp.TooltipContent>
				)}
			</HSComp.Tooltip>
			<HSComp.AlertDialogContent>
				<HSComp.AlertDialogHeader>
					<HSComp.AlertDialogTitle>
						Reinstall {meta.name}#{meta.version}
					</HSComp.AlertDialogTitle>
				</HSComp.AlertDialogHeader>
				<HSComp.AlertDialogDescription>
					Package will be reloaded from the registry. This may take a moment.
				</HSComp.AlertDialogDescription>
				<HSComp.AlertDialogFooter>
					<HSComp.AlertDialogCancel disabled={pending}>
						Cancel
					</HSComp.AlertDialogCancel>
					<HSComp.AlertDialogAction
						disabled={pending}
						onClick={(e) => {
							e.preventDefault();
							reinstallMutate();
						}}
					>
						{pending && <Loader2Icon className="w-4 h-4 animate-spin" />}
						{pending ? "Reinstalling…" : "Reinstall"}
					</HSComp.AlertDialogAction>
				</HSComp.AlertDialogFooter>
			</HSComp.AlertDialogContent>
		</HSComp.AlertDialog>
	);
}

type KVRow = { label: string; value: React.ReactNode };

function KVRows({ rows }: { rows: KVRow[] }) {
	return (
		<div className="flex flex-col gap-3">
			{rows.map((row) => (
				<div key={row.label} className="flex gap-2">
					<span className="w-28 shrink-0 text-text-secondary text-sm">
						{row.label}
					</span>
					<span className="text-text-primary text-sm">{row.value}</span>
				</div>
			))}
		</div>
	);
}

function Section({
	title,
	children,
	className,
}: {
	title: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={`flex flex-col gap-3 ${className ?? ""}`}>
			<span className="text-text-primary text-sm font-medium">{title}</span>
			{children}
		</div>
	);
}

function ExpandableText({ text }: { text: string }) {
	const [expanded, setExpanded] = useState(false);
	const [clamped, setClamped] = useState(false);
	const textRef = useRef<HTMLSpanElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: text change means content changed, need to re-measure
	useEffect(() => {
		const el = textRef.current;
		if (el) setClamped(el.scrollHeight > el.clientHeight);
	}, [text]);

	return (
		<div className="flex flex-col gap-1">
			<span ref={textRef} className={expanded ? "" : "line-clamp-1"}>
				{text}
			</span>
			{(clamped || expanded) && (
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					className="text-text-link hover:underline text-sm cursor-pointer self-start"
				>
					{expanded ? "Show less" : "Show more"}
				</button>
			)}
		</div>
	);
}

function VisualView({ meta }: { meta: PackageMeta }) {
	const deps = meta.dependencies ? Object.entries(meta.dependencies) : [];

	const generalRows: KVRow[] = [];
	if (meta.title) generalRows.push({ label: "Title", value: meta.title });
	if (meta.version) generalRows.push({ label: "Version", value: meta.version });
	if (meta.author) generalRows.push({ label: "Author", value: meta.author });
	if (meta.type) generalRows.push({ label: "Type", value: meta.type });
	if (meta.homepage)
		generalRows.push({
			label: "Homepage",
			value: (
				<a
					href={meta.homepage}
					target="_blank"
					rel="noopener noreferrer"
					className="text-text-link hover:underline"
				>
					{meta.homepage}
				</a>
			),
		});
	if (meta.fhirVersions?.length)
		generalRows.push({
			label: "FHIR versions",
			value: meta.fhirVersions.join(", "),
		});
	if (meta.description)
		generalRows.push({
			label: "Description",
			value: <ExpandableText text={meta.description} />,
		});

	const installRows: KVRow[] = [];
	if (meta.installation?.length) {
		const inst = meta.installation[0];
		if (inst) {
			if (inst.intention)
				installRows.push({ label: "Intention", value: inst.intention });
			if (inst.cts)
				installRows.push({
					label: "Installed at",
					value: new Date(inst.cts).toLocaleDateString("en-GB", {
						day: "2-digit",
						month: "short",
						year: "numeric",
					}),
				});
			if (inst.source?.type)
				installRows.push({ label: "Source", value: inst.source.type });
			if (inst.source?.["registry-url"])
				installRows.push({
					label: "Registry",
					value: inst.source["registry-url"],
				});
		}
	}

	return (
		<div className="p-4 pl-7 flex flex-col gap-4 max-w-4xl">
			{generalRows.length > 0 && (
				<Section title="General">
					<KVRows rows={generalRows} />
				</Section>
			)}
			{installRows.length > 0 && (
				<Section title="Installation">
					<KVRows rows={installRows} />
				</Section>
			)}
			{deps.length > 0 && (
				<Section title="Dependencies" className="pt-4">
					<div className="flex flex-col gap-1 pl-3">
						{deps.map(([name, version]) => {
							const depId = `${name}#${version}`;
							return (
								<Link
									key={depId}
									to="/ig/$packageId"
									params={{ packageId: depId }}
									search={{
										tab: undefined,
										view: undefined,
										q: undefined,
									}}
									className="text-text-link hover:underline text-sm"
								>
									{depId}
								</Link>
							);
						})}
					</div>
				</Section>
			)}
		</div>
	);
}

function PackageInfoContent({
	meta,
	actionsRef,
	reinstallMutate,
	reinstallIsPending,
	deleteMutate,
	deleteIsPending,
}: {
	meta: PackageMeta;
	actionsRef: RefObject<PackageDetailActions>;
	reinstallMutate: () => void;
	reinstallIsPending: boolean;
	deleteMutate: () => void;
	deleteIsPending: boolean;
}) {
	const navigate = useNavigate();
	const { view } = useSearch({ from: "/ig/$packageId/" });
	const [storedView, setStoredView] = useLocalStorage<string>({
		key: IG_VIEW_KEY,
		defaultValue: "visual",
	});
	const currentView = view ?? storedView;

	useEffect(() => {
		actionsRef.current.setPackageInfoView = (v: string) => {
			setStoredView(v);
			navigate({
				from: "/ig/$packageId/",
				search: (prev) =>
					({
						...prev,
						view: v === "visual" ? undefined : v,
					}) as typeof prev,
				replace: true,
			});
		};
	});

	const switchView = (v: string) => {
		setStoredView(v);
		navigate({
			from: "/ig/$packageId/",
			search: (prev) =>
				({
					...prev,
					view: v === "visual" ? undefined : v,
				}) as typeof prev,
			replace: true,
		});
	};

	return (
		<div className="relative flex flex-col grow min-h-0">
			<div className="flex items-center justify-between bg-bg-secondary flex-none h-10 border-b pl-5 pr-4">
				<div className="flex items-center gap-2">
					<ReinstallPackageButton
						meta={meta}
						reinstallMutate={reinstallMutate}
						reinstallIsPending={reinstallIsPending}
					/>
					<DeletePackageButton
						meta={meta}
						deleteMutate={deleteMutate}
						deleteIsPending={deleteIsPending}
					/>
				</div>
			</div>
			<div className="relative flex-1 min-h-0">
				<div className="sticky top-0 right-0 z-10 flex justify-end pointer-events-none h-0 min-h-0 pr-4 pt-3">
					<div className="flex items-center gap-2 h-fit border rounded-full p-2 border-border-secondary bg-bg-primary pointer-events-auto">
						<HSComp.SegmentControl
							value={currentView}
							onValueChange={switchView}
							items={[
								{ value: "visual", label: "Visual" },
								{ value: "json", label: "JSON" },
							]}
						/>
					</div>
				</div>
				{currentView === "json" ? (
					<div className="h-full">
						<HSComp.CodeEditor
							readOnly
							currentValue={JSON.stringify(meta, null, 2)}
							mode="json"
						/>
					</div>
				) : (
					<div className="overflow-auto h-full pb-20">
						<VisualView meta={meta} />
					</div>
				)}
			</div>
		</div>
	);
}

type PackageEntity = {
	resourceType: string;
	id: string;
	url?: string;
	title?: string;
	name?: string;
	version?: string;
	status?: string;
	description?: string;
	purpose?: string;
	type?: string;
	derivation?: string;
	base?: string[];
};

type PackageEntityEntry = {
	resource: PackageEntity;
};

type PackageEntitiesResult = {
	total: number;
	entry: PackageEntityEntry[];
};

const PAGE_SIZE = 50;

const ENTITY_ELEMENTS =
	"id,url,name,title,version,status,description,purpose,type,derivation,base";

async function fetchPackageEntities(
	client: AidboxClientR5,
	packageId: string,
	resourceType: string,
	substring: string,
	page: number,
): Promise<PackageEntitiesResult> {
	const response = await client.rawRequest({
		method: "POST",
		url: "/rpc?_m=aidbox.introspector/get-package-entities",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			method: "aidbox.introspector/get-package-entities",
			params: {
				"package-coordinate": packageId,
				"resource-type": resourceType,
				...(substring ? { substring } : {}),
				count: PAGE_SIZE,
				page,
				elements: ENTITY_ELEMENTS,
			},
		}),
	});
	const json = await response.response.json();
	return json.result ?? { total: 0, entry: [] };
}

function usePackageEntitiesInfinite(
	packageId: string,
	resourceType: string,
	substring: string,
) {
	const client = useAidboxClient();

	return useInfiniteQuery<PackageEntitiesResult>({
		queryKey: [
			"ig-package-entities-infinite",
			packageId,
			resourceType,
			substring,
		],
		staleTime: 5 * 60 * 1000,
		initialPageParam: 1,
		queryFn: ({ pageParam }) =>
			fetchPackageEntities(
				client,
				packageId,
				resourceType,
				substring,
				pageParam as number,
			),
		getNextPageParam: (lastPage, allPages) => {
			const loaded = allPages.reduce((sum, p) => sum + p.entry.length, 0);
			return loaded < lastPage.total ? allPages.length + 1 : undefined;
		},
	});
}

function usePackageResourceTypes(packageId: string) {
	const client = useAidboxClient();

	return useQuery<string[]>({
		queryKey: ["ig-package-resource-types", packageId],
		staleTime: 5 * 60 * 1000,
		queryFn: async () => {
			const response = await client.rawRequest({
				method: "POST",
				url: "/rpc?_m=aidbox.introspector/list-package-resource-types",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					method: "aidbox.introspector/list-package-resource-types",
					params: { "package-coordinate": packageId },
				}),
			});
			const json = await response.response.json();
			return json.result?.["resource-types"] ?? [];
		},
	});
}

function pickEntityTitle(r: PackageEntity): string {
	return r.name || r.title || r.id;
}

function pickEntityDescription(r: PackageEntity): string | undefined {
	return r.description || r.url;
}

const PER_RESOURCE_TYPE_TAG_FIELDS: Record<string, (keyof PackageEntity)[]> = {
	StructureDefinition: ["type", "derivation"],
	SearchParameter: ["base"],
};

const COMMON_TAG_FIELDS: (keyof PackageEntity)[] = ["status"];

function pickEntityTags(r: PackageEntity): string[] {
	const fields = [
		...(PER_RESOURCE_TYPE_TAG_FIELDS[r.resourceType] ?? []),
		...COMMON_TAG_FIELDS,
	];
	return fields.flatMap((f) => {
		const v = r[f];
		if (typeof v === "string" && v.length > 0) return [v];
		if (Array.isArray(v))
			return v.filter(
				(x): x is string => typeof x === "string" && x.length > 0,
			);
		return [];
	});
}

function PackageEntityCard({
	packageId,
	resource,
	focused,
}: {
	packageId: string;
	resource: PackageEntity;
	focused: boolean;
}) {
	const tags = pickEntityTags(resource);
	const title = pickEntityTitle(resource);
	const description = pickEntityDescription(resource);

	return (
		<li
			className={`relative transition-colors hover:bg-bg-secondary border-b border-border-default ${focused ? "bg-bg-secondary" : ""}`}
		>
			<Link
				to="/ig/$packageId/resource/$resourceType/$resourceId"
				params={{
					packageId,
					resourceType: resource.resourceType,
					resourceId: resource.id,
				}}
				search={{ view: undefined }}
				className="block"
			>
				<div className="flex flex-col px-4 py-3 min-w-0">
					<div className="typo-body text-text-primary truncate">{title}</div>
					{description && description !== title && (
						<div className="typo-body-xs text-text-secondary mt-0.5 line-clamp-1">
							{description}
						</div>
					)}
					{tags.length > 0 && (
						<div className="flex flex-nowrap items-center gap-x-2 mt-2 overflow-hidden">
							{tags.map((tag) => (
								<span
									key={tag}
									className="shrink-0 text-[11px] leading-4 normal-case whitespace-nowrap text-text-info-primary"
								>
									#{tag}
								</span>
							))}
						</div>
					)}
				</div>
			</Link>
		</li>
	);
}

function PackageEntityCardSkeleton({ index }: { index: number }) {
	return (
		<li className="border-b border-border-default">
			<div className="flex flex-col gap-2 px-4 py-3">
				<HSComp.Skeleton
					className="h-5"
					style={{ width: `${140 + ((index * 23) % 200)}px` }}
				/>
				<HSComp.Skeleton
					className="h-4"
					style={{ width: `${200 + ((index * 17) % 200)}px` }}
				/>
				<div className="flex gap-2">
					<HSComp.Skeleton className="h-4 w-12" />
					<HSComp.Skeleton className="h-4 w-16" />
				</div>
			</div>
		</li>
	);
}

function EntitiesContent({
	packageId,
	resourceType,
	actionsRef,
}: {
	packageId: string;
	resourceType: string;
	actionsRef: RefObject<PackageDetailActions>;
}) {
	const client = useAidboxClient();
	const navigate = useNavigate();
	const { q } = useSearch({ from: "/ig/$packageId/" });
	const urlText = q ?? "";

	const [inputText, setInputText] = useState(urlText);
	const substring = useDeferredValue(inputText);

	const lastUrlTextRef = useRef(urlText);
	useEffect(() => {
		if (urlText !== lastUrlTextRef.current) {
			lastUrlTextRef.current = urlText;
			setInputText(urlText);
		}
	}, [urlText]);

	const urlSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const setUrlText = useCallback(
		(next: string) => {
			if (urlSyncTimerRef.current) clearTimeout(urlSyncTimerRef.current);
			urlSyncTimerRef.current = setTimeout(() => {
				lastUrlTextRef.current = next;
				navigate({
					from: "/ig/$packageId/",
					search: (prev) => ({ ...prev, q: next || undefined }),
					replace: true,
				});
			}, 200);
		},
		[navigate],
	);
	useEffect(
		() => () => {
			if (urlSyncTimerRef.current) clearTimeout(urlSyncTimerRef.current);
		},
		[],
	);

	const handleSearchChange = (next: string) => {
		setInputText(next);
		setUrlText(next);
	};

	const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
		usePackageEntitiesInfinite(packageId, resourceType, substring);

	const items = useMemo(
		() => data?.pages.flatMap((p) => p.entry) ?? [],
		[data],
	);

	const scrollRef = useRef<HTMLDivElement | null>(null);
	const searchWrapperRef = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		const id = requestAnimationFrame(() => {
			searchWrapperRef.current
				?.querySelector<HTMLInputElement>("input")
				?.focus();
		});
		return () => cancelAnimationFrame(id);
	}, []);

	const rowVirtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => 90,
		overscan: 8,
		getItemKey: (i) => items[i]?.resource.id ?? i,
	});

	const virtualItems = rowVirtualizer.getVirtualItems();
	useEffect(() => {
		const last = virtualItems[virtualItems.length - 1];
		if (!last) return;
		if (last.index >= items.length - 5 && hasNextPage && !isFetchingNextPage) {
			fetchNextPage();
		}
	}, [
		virtualItems,
		items.length,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
	]);

	const [focusedIndex, setFocusedIndex] = useState(-1);
	useEffect(() => {
		if (focusedIndex < 0) return;
		rowVirtualizer.scrollToIndex(focusedIndex, { align: "auto" });
	}, [focusedIndex, rowVirtualizer]);

	useEffect(() => {
		if (substring && items.length > 0) setFocusedIndex(0);
		else setFocusedIndex(-1);
	}, [substring, items.length]);

	const navigateToResource = useCallback(
		(resource: PackageEntity) => {
			navigate({
				to: "/ig/$packageId/resource/$resourceType/$resourceId",
				params: {
					packageId,
					resourceType: resource.resourceType,
					resourceId: resource.id,
				},
				search: { view: undefined },
			});
		},
		[navigate, packageId],
	);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
			e.preventDefault();
			setFocusedIndex((p) => Math.min(p + 1, items.length - 1));
		} else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
			e.preventDefault();
			setFocusedIndex((p) => Math.max(p - 1, -1));
		} else if (e.key === "Enter") {
			if (focusedIndex < 0) return;
			const it = items[focusedIndex];
			if (!it) return;
			e.preventDefault();
			navigateToResource(it.resource);
		}
	};

	useEffect(() => {
		actionsRef.current.searchCanonicals = async (
			query?: string,
			p?: number,
		) => {
			const targetQuery = query ?? substring;
			const targetPage = p ?? 1;

			if (query !== undefined) {
				setInputText(query);
				lastUrlTextRef.current = query;
				navigate({
					from: "/ig/$packageId/",
					search: (prev) => ({ ...prev, q: query || undefined }),
				});
			}

			const result = await fetchPackageEntities(
				client,
				packageId,
				resourceType,
				targetQuery,
				targetPage,
			);

			const entries = result.entry.map((item) => ({
				resourceType: item.resource.resourceType,
				url: item.resource.url ?? "",
				id: item.resource.id,
			}));
			return {
				total: result.total,
				page: targetPage,
				totalPages: Math.ceil(result.total / PAGE_SIZE),
				entries,
			};
		};

		actionsRef.current.selectCanonical = (id: string) => {
			const entry = items.find((item) => item.resource.id === id);
			if (entry) navigateToResource(entry.resource);
		};
	});

	return (
		<div ref={scrollRef} className="h-full overflow-y-auto pb-[250px]">
			<div className="sticky top-0 z-10 bg-bg-primary py-4 shadow-[0_10px_10px_0_var(--color-bg-primary)]">
				<div ref={searchWrapperRef} className="mx-auto max-w-[990px] px-8">
					<HSComp.Input
						type="text"
						className="bg-bg-primary"
						placeholder={`Search ${resourceType}`}
						leftSlot={<Search />}
						value={inputText}
						onChange={(e) => handleSearchChange(e.target.value)}
						onKeyDown={handleKeyDown}
						rightSlot={
							inputText && (
								<HSComp.IconButton
									icon={<X />}
									aria-label="Clear"
									variant="link"
									onClick={() => handleSearchChange("")}
								/>
							)
						}
					/>
				</div>
			</div>
			<div className="mx-auto max-w-[990px] px-8 bg-bg-primary">
				{isLoading ? (
					<ul>
						{Array.from({ length: 15 }, (_, i) => (
							<PackageEntityCardSkeleton
								// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
								key={`skeleton-${i}`}
								index={i}
							/>
						))}
					</ul>
				) : (
					<ul
						style={{
							position: "relative",
							height: rowVirtualizer.getTotalSize(),
						}}
					>
						{virtualItems.map((vi) => {
							const it = items[vi.index];
							if (!it) return null;
							return (
								<div
									key={it.resource.id}
									ref={rowVirtualizer.measureElement}
									data-index={vi.index}
									style={{
										position: "absolute",
										top: 0,
										left: 0,
										right: 0,
										transform: `translateY(${vi.start}px)`,
									}}
								>
									<PackageEntityCard
										packageId={packageId}
										resource={it.resource}
										focused={vi.index === focusedIndex}
									/>
								</div>
							);
						})}
					</ul>
				)}
				{isFetchingNextPage && (
					<div className="flex items-center justify-center py-4 text-text-secondary text-sm">
						<Loader2Icon className="size-4 animate-spin mr-2" />
						Loading more…
					</div>
				)}
			</div>
		</div>
	);
}

function LoadingSkeleton() {
	return (
		<div className="p-4 flex flex-col gap-3">
			{Array.from({ length: 5 }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
				<div key={i} className="flex gap-4 py-2">
					<HSComp.Skeleton className="h-5 w-36 shrink-0" />
					<HSComp.Skeleton
						className="h-5"
						style={{ width: `${120 + ((i * 47) % 200)}px` }}
					/>
				</div>
			))}
		</div>
	);
}

const IG_TAB_KEY = "ig-browser-tab";
const IG_VIEW_KEY = "ig-browser-view";

function formatPackageInfoVisual(meta: PackageMeta) {
	const rows: Record<string, string> = {};
	if (meta.title) rows.title = meta.title;
	if (meta.version) rows.version = meta.version;
	if (meta.author) rows.author = meta.author;
	if (meta.type) rows.type = meta.type;
	if (meta.homepage) rows.homepage = meta.homepage;
	if (meta.fhirVersions?.length)
		rows.fhirVersions = meta.fhirVersions.join(", ");
	if (meta.description) rows.description = meta.description;
	if (meta.dependencies)
		rows.dependencies = Object.entries(meta.dependencies)
			.map(([n, v]) => `${n}#${v}`)
			.join(", ");
	if (meta.installation?.length) {
		const inst = meta.installation[0];
		if (inst) {
			if (inst.intention) rows.intention = inst.intention;
			if (inst.cts) rows.installedAt = inst.cts;
			if (inst.source?.type) rows.sourceType = inst.source.type;
			if (inst.source?.["registry-url"])
				rows.registryUrl = inst.source["registry-url"];
		}
	}
	return rows;
}

export function PackageDetail() {
	const { packageId } = useParams({ from: "/ig/$packageId/" });
	const { tab } = useSearch({ from: "/ig/$packageId/" });
	const navigate = useNavigate();
	const client = useAidboxClient();
	const queryClient = useQueryClient();
	const { data, isLoading } = usePackageMeta(packageId);
	const { data: resourceTypes, isPending: resourceTypesPending } =
		usePackageResourceTypes(packageId);
	const [storedTab, setStoredTab] = useLocalStorage<string>({
		key: IG_TAB_KEY,
		defaultValue: "",
	});
	const defaultTab = resourceTypes?.[0] ?? "package-info";
	const requestedTab = tab ?? storedTab;
	const currentTab =
		requestedTab &&
		(requestedTab === "package-info" || resourceTypes?.includes(requestedTab))
			? requestedTab
			: defaultTab;

	const switchTab = (v: string) => {
		setStoredTab(v);
		navigate({
			from: "/ig/$packageId/",
			search: (prev) => ({
				...prev,
				tab: v,
				view: v === "package-info" ? prev.view : undefined,
				q: undefined,
			}),
			replace: true,
		});
	};

	const reinstallMutation = useMutation({
		mutationFn: () =>
			rpcCall(client, "aidbox.profiles/reinstall-package", {
				"package-name": data?.name ?? "",
				"package-version": data?.version ?? "",
			}),
		onError: Utils.onMutationError,
		onSuccess: () => {
			HSComp.toast.success("Package reinstalled", {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
			queryClient.invalidateQueries({ queryKey: ["ig-browser-packages"] });
			queryClient.invalidateQueries({
				queryKey: ["ig-package-meta", packageId],
			});
		},
	});

	const deleteMutation = useMutation({
		mutationFn: () =>
			rpcCall(client, "aidbox.profiles/delete-package", {
				"package-name": data?.name ?? "",
				"package-version": data?.version ?? "",
			}),
		onError: Utils.onMutationError,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["ig-browser-packages"] });
			navigate({ to: "/ig", search: { q: undefined, tags: undefined } });
		},
	});

	const actionsRef = useRef<PackageDetailActions>({
		getActiveTab: () => currentTab,
		setActiveTab: switchTab,
		getPackageInfo: (format) => {
			if (!data) return null;
			return format === "json" ? data : formatPackageInfoVisual(data);
		},
		setPackageInfoView: (v) => {
			switchTab("package-info");
			// Will be overridden when PackageInfoContent mounts
			void v;
		},
		searchCanonicals: async () => {
			return { total: 0, page: 1, totalPages: 0, entries: [] };
		},
		selectCanonical: () => {},
		reinstallPackage: () => reinstallMutation.mutate(),
		deletePackage: () => deleteMutation.mutate(),
	});

	useEffect(() => {
		actionsRef.current.getActiveTab = () => currentTab;
		actionsRef.current.setActiveTab = switchTab;
		actionsRef.current.getPackageInfo = (format) => {
			if (!data) return null;
			return format === "json" ? data : formatPackageInfoVisual(data);
		};
		actionsRef.current.reinstallPackage = () => reinstallMutation.mutate();
		actionsRef.current.deletePackage = () => deleteMutation.mutate();
	});

	useWebMCPPackageDetail(actionsRef);

	if (resourceTypesPending) {
		return <LoadingSkeleton />;
	}

	return (
		<HSComp.Tabs
			value={currentTab}
			onValueChange={switchTab}
			className="flex flex-col h-full"
		>
			<div className="flex items-center bg-bg-primary flex-none border-b border-border-secondary">
				<HSComp.TabsList className="pl-4">
					<HSComp.TabsTrigger value="package-info">
						Package Info
					</HSComp.TabsTrigger>
					{(resourceTypes ?? []).map((rt) => (
						<HSComp.TabsTrigger key={rt} value={rt}>
							{rt}
						</HSComp.TabsTrigger>
					))}
				</HSComp.TabsList>
			</div>
			<HSComp.TabsContent value="package-info" className="overflow-auto">
				{isLoading ? (
					<LoadingSkeleton />
				) : data ? (
					<PackageInfoContent
						meta={data}
						actionsRef={actionsRef}
						reinstallMutate={() => reinstallMutation.mutate()}
						reinstallIsPending={reinstallMutation.isPending}
						deleteMutate={() => deleteMutation.mutate()}
						deleteIsPending={deleteMutation.isPending}
					/>
				) : null}
			</HSComp.TabsContent>
			{(resourceTypes ?? []).map((rt) => (
				<HSComp.TabsContent
					key={rt}
					value={rt}
					className="grow min-h-0 flex flex-col"
				>
					{currentTab === rt && (
						<EntitiesContent
							packageId={packageId}
							resourceType={rt}
							actionsRef={actionsRef}
						/>
					)}
				</HSComp.TabsContent>
			))}
		</HSComp.Tabs>
	);
}
