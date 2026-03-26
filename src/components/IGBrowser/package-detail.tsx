import * as HSComp from "@health-samurai/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Link,
	useNavigate,
	useParams,
	useSearch,
} from "@tanstack/react-router";
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	Loader2Icon,
	RefreshCwIcon,
	Trash2Icon,
	X,
} from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import type { AidboxClientR5 } from "../../AidboxClient";
import { useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { useDebounce } from "../../hooks/useDebounce";
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

function isSystemPackage(name: string) {
	return name.startsWith("io.health-samurai.");
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
}: {
	meta: PackageMeta;
	actionsRef: RefObject<PackageDetailActions>;
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
				search: (prev) => ({
					...prev,
					view: v === "visual" ? undefined : v,
				}),
				replace: true,
			});
		};
	});

	return (
		<HSComp.Tabs
			value={currentView}
			onValueChange={(v) => {
				setStoredView(v);
				navigate({
					search: (prev) => ({
						...prev,
						view: v === "visual" ? undefined : v,
					}),
					replace: true,
				});
			}}
			variant="tertiary"
			className="flex flex-col grow min-h-0"
		>
			<div className="flex items-center bg-bg-secondary flex-none h-10 border-b">
				<HSComp.TabsList className="py-0! border-b-0!">
					<HSComp.TabsTrigger value="visual">Visual</HSComp.TabsTrigger>
					<HSComp.TabsTrigger value="json">JSON</HSComp.TabsTrigger>
				</HSComp.TabsList>
			</div>
			<HSComp.TabsContent value="visual" className="overflow-auto pb-20">
				<VisualView meta={meta} />
			</HSComp.TabsContent>
			<HSComp.TabsContent value="json" className="relative grow min-h-0">
				<HSComp.CodeEditor
					readOnly
					currentValue={JSON.stringify(meta, null, 2)}
					mode="json"
				/>
			</HSComp.TabsContent>
		</HSComp.Tabs>
	);
}

type CanonicalEntry = {
	resource: {
		resourceType: string;
		id: string;
		url?: string;
		name?: string;
		version?: string;
		status?: string;
	};
};

type CanonicalResult = {
	total: number;
	entry: CanonicalEntry[];
};

const PAGE_SIZE = 50;

function PaginationPages({
	currentPage,
	totalPages,
	onPageChange,
}: {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}) {
	const pages: (number | string)[] = [];
	if (totalPages <= 7) {
		for (let i = 1; i <= totalPages; i++) pages.push(i);
	} else {
		pages.push(1);
		if (currentPage > 3) pages.push("ellipsis-start");
		const start = Math.max(2, currentPage - 1);
		const end = Math.min(totalPages - 1, currentPage + 1);
		for (let i = start; i <= end; i++) pages.push(i);
		if (currentPage < totalPages - 2) pages.push("ellipsis-end");
		pages.push(totalPages);
	}

	return (
		<div className="flex items-center gap-1">
			<HSComp.Button
				variant="ghost"
				size="small"
				disabled={currentPage <= 1}
				onClick={() => onPageChange(currentPage - 1)}
			>
				<ChevronLeftIcon size={16} />
			</HSComp.Button>
			{pages.map((p) =>
				typeof p === "string" ? (
					<span key={p} className="px-1 text-text-secondary">
						...
					</span>
				) : (
					<HSComp.Button
						key={p}
						variant={p === currentPage ? "secondary" : "ghost"}
						size="small"
						onClick={() => onPageChange(p)}
					>
						{p}
					</HSComp.Button>
				),
			)}
			<HSComp.Button
				variant="ghost"
				size="small"
				disabled={currentPage >= totalPages}
				onClick={() => onPageChange(currentPage + 1)}
			>
				<ChevronRightIcon size={16} />
			</HSComp.Button>
		</div>
	);
}

async function fetchCanonicals(
	client: AidboxClientR5,
	packageId: string,
	substring: string,
	page: number,
): Promise<CanonicalResult> {
	const response = await client.rawRequest({
		method: "POST",
		url: "/rpc?_m=aidbox.introspector/search-package-canonicals",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			method: "aidbox.introspector/search-package-canonicals",
			params: {
				"package-coordinate": packageId,
				...(substring ? { substring } : {}),
				count: PAGE_SIZE,
				page,
			},
		}),
	});
	const json = await response.response.json();
	return json.result ?? { total: 0, entry: [] };
}

function useCanonicals(packageId: string, substring: string, page: number) {
	const client = useAidboxClient();

	return useQuery<CanonicalResult>({
		queryKey: ["ig-canonicals", packageId, substring, page],
		staleTime: 5 * 60 * 1000,
		queryFn: () => fetchCanonicals(client, packageId, substring, page),
	});
}

function CanonicalsContent({
	packageId,
	actionsRef,
}: {
	packageId: string;
	actionsRef: RefObject<PackageDetailActions>;
}) {
	const client = useAidboxClient();
	const navigate = useNavigate();
	const { q, page: urlPage } = useSearch({ from: "/ig/$packageId/" });
	const substring = q ?? "";
	const page = urlPage ?? 1;
	const [search, setSearch] = useState(substring);

	useEffect(() => {
		setSearch(substring);
	}, [substring]);

	const debouncedNavigate = useDebounce((value: string) => {
		navigate({
			search: (prev) => ({
				...prev,
				q: value || undefined,
				page: undefined,
			}),
		});
	}, 300);

	const handleSearchChange = (value: string) => {
		setSearch(value);
		debouncedNavigate(value);
	};

	const setPage = (p: number) => {
		navigate({
			search: (prev) => ({
				...prev,
				page: p === 1 ? undefined : p,
			}),
		});
	};

	const { data, isLoading } = useCanonicals(packageId, substring, page);
	const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

	useEffect(() => {
		actionsRef.current.searchCanonicals = async (
			query?: string,
			p?: number,
		) => {
			const targetQuery = query ?? substring;
			const targetPage = p ?? 1;

			if (query !== undefined) {
				setSearch(query);
				navigate({
					search: (prev) => ({
						...prev,
						q: query || undefined,
						page: targetPage === 1 ? undefined : targetPage,
					}),
				});
			}
			if (p !== undefined) {
				setPage(p);
			}

			const result = await fetchCanonicals(
				client,
				packageId,
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
			const entry = data?.entry.find((item) => item.resource.id === id);
			if (entry) {
				navigate({
					to: "/ig/$packageId/resource/$resourceType/$resourceId",
					params: {
						packageId,
						resourceType: entry.resource.resourceType,
						resourceId: entry.resource.id,
					},
				});
			}
		};
	});

	return (
		<div className="flex flex-col h-full min-h-0">
			<div className="flex gap-4 items-center px-4 py-3 border-b border-border-secondary flex-none">
				<HSComp.Input
					type="text"
					className="flex-1 bg-bg-primary"
					placeholder="Search by resource type or URL, e.g. valueset birthsex"
					autoFocus
					value={search}
					onChange={(e) => handleSearchChange(e.target.value)}
					rightSlot={
						search && (
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
			<div className="grow min-h-0 overflow-hidden [&_[data-slot=table-container]]:overflow-visible [&_[data-slot=table-container]]:h-full [&_table]:flex [&_table]:flex-col [&_table]:h-full">
				<HSComp.Table zebra className="typo-code">
					<HSComp.TableHeader className="block shrink-0 overflow-y-scroll scrollbar-none [&_tr]:table [&_tr]:table-fixed [&_tr]:w-full">
						<HSComp.TableRow>
							<HSComp.TableHead className="w-48 pl-7!">
								Resource Type
							</HSComp.TableHead>
							<HSComp.TableHead>URL</HSComp.TableHead>
						</HSComp.TableRow>
					</HSComp.TableHeader>
					<HSComp.TableBody className="block grow min-h-0 overflow-y-auto pb-10 [&_tr]:table [&_tr]:table-fixed [&_tr]:w-full">
						{isLoading
							? Array.from({ length: 30 }, (_, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
									<HSComp.TableRow key={i} zebra index={i}>
										<HSComp.TableCell className="w-48 pl-7!">
											<HSComp.Skeleton
												className="h-5"
												style={{
													width: `${80 + ((i * 23) % 60)}px`,
												}}
											/>
										</HSComp.TableCell>
										<HSComp.TableCell>
											<HSComp.Skeleton
												className="h-5"
												style={{
													width: `${200 + ((i * 31) % 200)}px`,
												}}
											/>
										</HSComp.TableCell>
									</HSComp.TableRow>
								))
							: data?.entry.map((item, index) => (
									<HSComp.TableRow
										key={item.resource.id}
										zebra
										index={index}
										className="cursor-pointer"
										onClick={() =>
											navigate({
												to: "/ig/$packageId/resource/$resourceType/$resourceId",
												params: {
													packageId,
													resourceType: item.resource.resourceType,
													resourceId: item.resource.id,
												},
											})
										}
									>
										<HSComp.TableCell className="text-text-secondary text-sm w-48 pl-7!">
											{item.resource.resourceType}
										</HSComp.TableCell>
										<HSComp.TableCell className="text-text-primary text-sm">
											<Link
												to="/ig/$packageId/resource/$resourceType/$resourceId"
												params={{
													packageId,
													resourceType: item.resource.resourceType,
													resourceId: item.resource.id,
												}}
												search={{ view: undefined }}
												className="text-text-link hover:underline"
												onClick={(e) => e.stopPropagation()}
											>
												{item.resource.url}
											</Link>
										</HSComp.TableCell>
									</HSComp.TableRow>
								))}
					</HSComp.TableBody>
				</HSComp.Table>
			</div>
			<div className="flex items-center justify-end border-t bg-bg-secondary px-4 h-10 flex-none">
				{totalPages > 1 && (
					<PaginationPages
						currentPage={page}
						totalPages={totalPages}
						onPageChange={setPage}
					/>
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
		if (inst.intention) rows.intention = inst.intention;
		if (inst.cts) rows.installedAt = inst.cts;
		if (inst.source?.type) rows.sourceType = inst.source.type;
		if (inst.source?.["registry-url"])
			rows.registryUrl = inst.source["registry-url"];
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
	const [storedTab, setStoredTab] = useLocalStorage<string>({
		key: IG_TAB_KEY,
		defaultValue: "canonicals",
	});
	const currentTab = tab ?? storedTab;

	const switchTab = (v: string) => {
		setStoredTab(v);
		navigate({
			search: (prev) => ({
				...prev,
				tab: v === "canonicals" ? undefined : v,
				view: v === "package-info" ? prev.view : undefined,
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
			navigate({ to: "/ig" });
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
			switchTab("canonicals");
			return { total: 0, page: 1, totalPages: 0, entries: [] };
		},
		selectCanonical: () => {
			switchTab("canonicals");
		},
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

	return (
		<HSComp.Tabs
			value={currentTab}
			onValueChange={switchTab}
			variant="primary"
			className="flex flex-col h-full"
		>
			<div className="flex items-center bg-bg-secondary flex-none h-10 border-b border-border-secondary">
				<HSComp.TabsList className="mx-4 py-0! border-b-0!">
					<HSComp.TabsTrigger value="canonicals">Canonicals</HSComp.TabsTrigger>
					<HSComp.TabsTrigger value="package-info">
						Package Info
					</HSComp.TabsTrigger>
				</HSComp.TabsList>
				{data && (
					<div className="ml-auto flex items-center gap-2 mr-4">
						<ReinstallPackageButton
							meta={data}
							reinstallMutate={() => reinstallMutation.mutate()}
							reinstallIsPending={reinstallMutation.isPending}
						/>
						<DeletePackageButton
							meta={data}
							deleteMutate={() => deleteMutation.mutate()}
							deleteIsPending={deleteMutation.isPending}
						/>
					</div>
				)}
			</div>
			<HSComp.TabsContent
				value="canonicals"
				className="grow min-h-0 flex flex-col"
			>
				<CanonicalsContent packageId={packageId} actionsRef={actionsRef} />
			</HSComp.TabsContent>
			<HSComp.TabsContent value="package-info" className="overflow-auto">
				{isLoading ? (
					<LoadingSkeleton />
				) : data ? (
					<PackageInfoContent meta={data} actionsRef={actionsRef} />
				) : null}
			</HSComp.TabsContent>
		</HSComp.Tabs>
	);
}
