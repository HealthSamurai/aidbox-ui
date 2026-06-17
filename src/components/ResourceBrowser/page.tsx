import { defaultToastPlacement } from "@aidbox-ui/components/config";
import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Router from "@tanstack/react-router";
import * as Lucide from "lucide-react";
import * as React from "react";
import type { AidboxClientR5 } from "../../AidboxClient";
import {
	fetchProfileElements,
	fetchSchemas as fetchSchemasApi,
	type Schema,
} from "../../api/schemas";
import * as ApiUtils from "../../api/utils";
import * as Humanize from "../../humanize";
import * as Utils from "../../utils";
import { copyToClipboard } from "../../utils/clipboard";
import { useWebMCPResourceInstances } from "../../webmcp/resource-instances";
import type { ResourceInstancesActions } from "../../webmcp/resource-instances-context";
import {
	type BulkAction,
	type ColumnDef,
	DataTable,
	DataTableFooter,
	type SortState,
} from "../data-table";
import { EmptyState } from "../empty-state";
import { defaultTabFor } from "../ResourceEditor/types";
import { UrlAutocomplete } from "../rest/url-autocomplete";
import {
	formatCount,
	formatMs,
	formatRelativeTime,
} from "../SearchParameter/format";
import { rpcCall } from "../SearchParameter/suggest-index";
import type {
	SearchParamShape,
	SearchParamStat,
} from "../SearchParameter/types";
import * as Constants from "./constants";
import type * as Types from "./types";

const ResourcesPageContext = React.createContext<Types.ResourcesPageContext>({
	resourceType: "",
});

const ResourcesTabContentContext =
	React.createContext<Types.ResourcesTabContentContext>({
		resourcesLoading: false,
	});

export const ResourcePageTabList = () => {
	return (
		<div className="border-b w-full h-10">
			<HSComp.TabsList className="px-4">
				<HSComp.TabsTrigger value="resources">Instances</HSComp.TabsTrigger>
				<HSComp.TabsTrigger value="profiles">Profiles</HSComp.TabsTrigger>
				<HSComp.TabsTrigger value="extensions">
					Search parameters
				</HSComp.TabsTrigger>
			</HSComp.TabsList>
		</div>
	);
};

export const ResourcesTabSarchInput = () => {
	const resourcesPageContext = React.useContext(ResourcesPageContext);
	const inputRef = React.useRef<HTMLInputElement>(null);

	const search = Router.useSearch({
		strict: false,
	});

	const decodedSearchQuery = search.searchQuery
		? atob(search.searchQuery)
		: Constants.DEFAULT_SEARCH_QUERY;

	const [queryValue, setQueryValue] = React.useState(decodedSearchQuery);

	React.useEffect(() => {
		setQueryValue(decodedSearchQuery);
	}, [decodedSearchQuery]);

	const fullPath = `/fhir/${resourcesPageContext.resourceType}?${queryValue}`;

	const handleSelectSuggestion = (path: string) => {
		const qIdx = path.indexOf("?");
		setQueryValue(qIdx >= 0 ? path.substring(qIdx + 1) : path);
	};

	const handleSubmit = () => {
		inputRef.current?.closest("form")?.requestSubmit();
	};

	const handleClear = () => {
		setQueryValue(Constants.DEFAULT_SEARCH_QUERY);
		inputRef.current?.focus();
	};

	const handleCopy = () => {
		copyToClipboard(queryValue);
	};

	return (
		<div className="relative flex-1 min-w-0">
			<UrlAutocomplete
				path={fullPath}
				method="GET"
				onSelectSuggestion={handleSelectSuggestion}
				onSubmit={handleSubmit}
			>
				<HSComp.Input
					ref={inputRef}
					autoFocus
					type="text"
					name="searchQuery"
					className="pr-14!"
					value={queryValue}
					onChange={(e) => setQueryValue(e.target.value)}
					prefixValue={
						<span className="flex gap-1 text-nowrap text-elements-assistive">
							<span className="font-medium">GET</span>
							<span>/fhir/{resourcesPageContext.resourceType}?</span>
						</span>
					}
				/>
			</UrlAutocomplete>
			<div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 items-center">
				<HSComp.IconButton
					variant="link"
					icon={<Lucide.CircleXIcon size={16} />}
					aria-label="Clear search"
					onClick={handleClear}
				/>
				<HSComp.IconButton
					variant="link"
					icon={<Lucide.CopyIcon size={16} />}
					aria-label="Copy search query"
					onClick={handleCopy}
				/>
			</div>
		</div>
	);
};

export const ResourcesTabCreateButton = () => {
	const resourcesPageContext = React.useContext(ResourcesPageContext);

	return (
		<Router.Link
			to="/resource/$resourceType/create"
			params={{ resourceType: resourcesPageContext.resourceType }}
			search={{
				tab: defaultTabFor(resourcesPageContext.resourceType),
				mode: "json" as const,
				builderTab: "form" as const,
			}}
		>
			<HSComp.Button variant="secondary">
				<Lucide.PlusIcon className="text-fg-link" />
				Create
			</HSComp.Button>
		</Router.Link>
	);
};

export const ResourcesTabSearchButton = () => {
	const resourcesTabContentContext = React.useContext(
		ResourcesTabContentContext,
	);

	return (
		<HSComp.Button
			variant="primary"
			type="submit"
			disabled={resourcesTabContentContext.resourcesLoading}
		>
			<Lucide.SearchIcon size={16} />
			Search
		</HSComp.Button>
	);
};

export const ResourcesTabHeader = ({
	handleSearch,
}: Types.ResourcesTabHeaderProps) => {
	return (
		<form className="px-4 py-3 border-b flex gap-2" onSubmit={handleSearch}>
			<ResourcesTabSarchInput />
			<div className="flex gap-2 items-center">
				<ResourcesTabSearchButton />
				<ResourcesTabCreateButton />
			</div>
		</form>
	);
};

const fetchDefaultSchema = async (
	client: AidboxClientR5,
	resourceType: string,
): Promise<Schema | undefined> => {
	const schemas = await fetchSchemasApi(client, resourceType);

	if (!schemas) return undefined;

	const defaultSchema = Object.values(schemas).find(
		(schema: Schema) => schema["default?"] === true,
	);

	return defaultSchema;
};

const resourcesWithKeys = (
	profiles: Schema | undefined,
	resources: Resource[],
) => {
	const resourceKeys: Record<string, undefined> = resources.reduce(
		(acc: Record<string, undefined>, resource: Resource) => {
			Object.keys(resource).forEach((key) => {
				acc[key] = undefined;
			});
			return acc;
		},
		{},
	);

	const snapshot = profiles?.entity?.elements;

	return {
		resources: resources.map((resource) => ({ ...resourceKeys, ...resource })),
		resourceKeys: Object.keys(resourceKeys).filter(
			(k) =>
				k !== "id" &&
				k !== "createdAt" &&
				k !== "lastUpdated" &&
				k !== "resourceType",
		),
		...(snapshot ? { snapshot: snapshot as Humanize.Snapshot } : {}),
	};
};

const parseSearchParam = (
	query: string,
	key: string,
	fallback: number,
): number => {
	const params = new URLSearchParams(query);
	const val = params.get(key);
	return val ? Number.parseInt(val, 10) || fallback : fallback;
};

const parseOptionalIntParam = (query: string, key: string): number | null => {
	const params = new URLSearchParams(query);
	const val = params.get(key);
	if (!val) return null;
	const n = Number.parseInt(val, 10);
	return Number.isFinite(n) && n > 0 ? n : null;
};

const ROW_HEIGHT_PX = 28;
const HEADER_HEIGHT_PX = 32;
const MIN_FIT_PAGE_SIZE = 5;

const parseSortParam = (query: string): Types.SortState => {
	const params = new URLSearchParams(query);
	const sort = params.get("_sort");
	if (!sort) return null;
	if (sort.startsWith("-")) {
		return { column: sort.slice(1), direction: "desc" };
	}
	return { column: sort, direction: "asc" };
};

const columnToSortKey = (column: string): string => {
	if (column === "id") return "_id";
	if (column === "lastUpdated") return "_lastUpdated";
	return column;
};

const ResourcesTabContent = ({
	client,
	resourceType,
	actionsRef,
}: Types.ResourcesPageProps & {
	actionsRef: React.RefObject<ResourceInstancesActions | null>;
}) => {
	const resourcesPageContext = React.useContext(ResourcesPageContext);
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
	const queryClient = ReactQuery.useQueryClient();

	const navigate = Router.useNavigate();
	const search = Router.useSearch({
		strict: false,
	});

	const decodedSearchQuery = search.searchQuery
		? atob(search.searchQuery)
		: Constants.DEFAULT_SEARCH_QUERY;

	const currentPage = parseSearchParam(decodedSearchQuery, "_page", 1);
	const explicitPageSize = parseOptionalIntParam(decodedSearchQuery, "_count");
	const [autoPageSize, setAutoPageSize] = React.useState<number | null>(null);
	const pageSizeReady = explicitPageSize !== null || autoPageSize !== null;
	const pageSize = explicitPageSize ?? autoPageSize ?? 30;
	const scrollAreaRef = React.useRef<HTMLDivElement>(null);

	const sort = parseSortParam(decodedSearchQuery);

	const { data: indexData } = ReactQuery.useQuery({
		queryKey: [Constants.PageID, "index-for-sorting", resourceType],
		queryFn: async () => {
			const response = await client.rawRequest({
				method: "POST",
				url: "/$index-for-sorting",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					"resource-type": resourceType,
					"sort-value": "_lastUpdated",
				}),
			});
			const json = await response.response.json();
			return json["has-index"] as boolean;
		},
		retry: false,
	});

	const handleSortToggle = (column: string) => {
		const params = new URLSearchParams(decodedSearchQuery);
		const sortKey = columnToSortKey(column);
		if (sort?.column !== sortKey) {
			params.set("_sort", `-${sortKey}`);
		} else if (sort.direction === "desc") {
			params.set("_sort", sortKey);
		} else {
			params.delete("_sort");
		}
		params.set("_page", "1");
		navigate({ to: ".", search: { searchQuery: btoa(params.toString()) } });
	};

	const { data: schema } = ReactQuery.useQuery({
		queryKey: [Constants.PageID, "default-schema", resourceType],
		queryFn: () => fetchDefaultSchema(client, resourceType),
	});

	const effectiveSearchQuery = React.useMemo(() => {
		const params = new URLSearchParams(decodedSearchQuery);
		if (!params.has("_count")) params.set("_count", String(pageSize));
		return params.toString();
	}, [decodedSearchQuery, pageSize]);

	const { data, isLoading, error } = ReactQuery.useQuery({
		queryKey: [
			Constants.PageID,
			"resource-list",
			resourceType,
			effectiveSearchQuery,
		],
		enabled: pageSizeReady,
		queryFn: async () => {
			const result = await client.searchType({
				type: resourcesPageContext.resourceType,
				query: Utils.formatSearchQuery(effectiveSearchQuery),
			});
			if (result.isErr())
				throw new Error("error obtaining resource list", {
					cause: result.value.resource,
				});

			const { resource: bundle } = result.value;

			const total = bundle?.total ?? 0;
			const resources =
				bundle?.entry?.flatMap(({ resource }) => (resource ? resource : [])) ??
				[];
			return { ...resourcesWithKeys(schema, resources), total };
		},
		retry: false,
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset selection when search query changes
	React.useEffect(() => {
		setSelectedIds(new Set());
	}, [decodedSearchQuery]);

	React.useLayoutEffect(() => {
		if (explicitPageSize !== null) return;
		const el = scrollAreaRef.current;
		if (!el) return;
		const compute = () => {
			const usable = el.clientHeight - HEADER_HEIGHT_PX;
			const fit = Math.max(
				MIN_FIT_PAGE_SIZE,
				Math.floor(usable / ROW_HEIGHT_PX),
			);
			setAutoPageSize((prev) => (prev === fit ? prev : fit));
		};
		compute();
		const ro = new ResizeObserver(compute);
		ro.observe(el);
		return () => ro.disconnect();
	}, [explicitPageSize]);

	const deleteMutation = ReactQuery.useMutation({
		mutationFn: async () => {
			const ids = Array.from(selectedIds);
			const result = await client.transaction({
				format: "application/json",
				bundle: {
					resourceType: "Bundle",
					type: "transaction",
					entry: ids.map((id) => ({
						request: {
							method: "DELETE" as const,
							url: `${resourcesPageContext.resourceType}/${id}`,
						},
					})),
				},
			});
			if (result.isErr()) {
				throw new Error("Failed to delete resources", {
					cause: result.value.resource,
				});
			}
			return result.value.resource;
		},
		onError: ApiUtils.onMutationError,
		onSuccess: () => {
			setSelectedIds(new Set());
			queryClient.invalidateQueries({
				queryKey: [Constants.PageID, "resource-list"],
			});
			HSComp.toast.success("Resources deleted", defaultToastPlacement);
		},
	});

	if (error)
		return (
			<div className="flex items-center justify-center h-full text-red-500">
				<div className="text-center">
					<div className="text-lg mb-2">Failed to load resource</div>
					<div className="text-sm">{error.message}</div>
				</div>
			</div>
		);

	const total = data?.total ?? 0;

	const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		navigate({
			to: ".",
			search: {
				searchQuery: btoa(e.currentTarget.searchQuery.value),
			},
		});
	};

	const handlePageChange = (page: number) => {
		const params = new URLSearchParams(decodedSearchQuery);
		params.set("_page", String(page));
		navigate({
			to: ".",
			search: {
				searchQuery: btoa(params.toString()),
			},
		});
	};

	const handleExport = () => {
		const selected = (data?.resources ?? []).filter(
			(r) => r.id && selectedIds.has(r.id),
		);
		const bundle = {
			resourceType: "Bundle",
			type: "collection",
			entry: selected.map((resource) => ({ resource })),
		};
		const blob = new Blob([JSON.stringify(bundle, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${resourcesPageContext.resourceType}-export.json`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const handlePageSizeChange = (size: number) => {
		const params = new URLSearchParams(decodedSearchQuery);
		params.set("_count", String(size));
		params.set("_page", "1");
		navigate({
			to: ".",
			search: {
				searchQuery: btoa(params.toString()),
			},
		});
	};

	if (actionsRef.current) {
		actionsRef.current.instancesGetSelected = () => Array.from(selectedIds);

		actionsRef.current.instancesSelect = (ids, selected) => {
			if (ids.length === 1 && ids[0] === "*") {
				const allIds = (data?.resources ?? [])
					.map((r) => r.id)
					.filter(Boolean) as string[];
				setSelectedIds(selected ? new Set(allIds) : new Set());
			} else {
				setSelectedIds((prev) => {
					const next = new Set(prev);
					for (const id of ids) {
						if (selected) next.add(id);
						else next.delete(id);
					}
					return next;
				});
			}
		};

		actionsRef.current.instancesDeleteSelected = async () => {
			const ids = Array.from(selectedIds);
			if (ids.length === 0) throw new Error("No resources selected");
			await deleteMutation.mutateAsync();
			return ids;
		};

		actionsRef.current.instancesExportSelected = () => {
			const selected = (data?.resources ?? []).filter(
				(r) => r.id && selectedIds.has(r.id),
			);
			if (selected.length === 0) return null;
			return {
				resourceType: "Bundle",
				type: "collection",
				entry: selected.map((resource) => ({ resource })),
			};
		};
	}

	const dynamicKeys =
		data?.resourceKeys.filter((k) => k !== "id" && k !== "meta") ?? [];
	const snapshot = data?.snapshot;

	const columns: ColumnDef<Resource>[] = [
		{
			id: "id",
			header: "Id",
			width: "w-0",
			maxSize: 400,
			cell: (resource) => (
				<div className="group/id flex items-center gap-1">
					<Router.Link
						className="text-text-link hover:underline"
						to="/resource/$resourceType/edit/$id"
						params={{
							resourceType: resourcesPageContext.resourceType,
							id: resource.id ?? "",
						}}
						search={{
							tab: "edit" as const,
							mode: "json" as const,
							builderTab: "form" as const,
						}}
					>
						{resource.id}
					</Router.Link>
					<span className="opacity-0 group-hover/id:opacity-100 transition-opacity [&_svg]:size-3.5 text-text-tertiary hover:text-text-primary">
						<HSComp.CopyIcon
							text={resource.id ?? ""}
							tooltipText="Copy ID"
							showToast={false}
						/>
					</span>
				</div>
			),
		},
		{
			id: "lastUpdated",
			header: "LastUpdated",
			width: dynamicKeys.length > 0 ? "w-0" : undefined,
			defaultSize: 260,
			maxSize: 600,
			sortable: true,
			headerTooltip:
				indexData === false
					? "Sort might be slow — no index for '_lastUpdated'"
					: undefined,
			headerTooltipClassName:
				indexData === false
					? "bg-bg-warning-primary_inverse text-neutral-900"
					: undefined,
			cell: (resource) =>
				Humanize.humanizeValue("lastUpdated", resource.meta?.lastUpdated, {}),
		},
		...dynamicKeys.map<ColumnDef<Resource>>((k, i) => ({
			id: k,
			header: k,
			width: i < dynamicKeys.length - 1 ? "w-0" : undefined,
			className: "max-w-[300px]",
			maxSize: 300,
			cell: (resource) => {
				const v = (resource as unknown as Record<string, unknown>)[k];
				const hasValue = v != null;
				return (
					<HSComp.Tooltip
						delayDuration={250}
						disableHoverableContent
						open={hasValue ? undefined : false}
					>
						<HSComp.TooltipTrigger asChild>
							<span className="block truncate">
								{Humanize.humanizeValue(k, v, snapshot ?? {})}
							</span>
						</HSComp.TooltipTrigger>
						<HSComp.TooltipContent
							collisionPadding={8}
							className="max-w-[500px] typo-code pointer-events-none"
						>
							<pre className="whitespace-pre-wrap break-all text-xs">
								{typeof v === "object"
									? JSON.stringify(v, null, 2)
									: String(v ?? "")}
							</pre>
						</HSComp.TooltipContent>
					</HSComp.Tooltip>
				);
			},
		})),
	];

	const apiToColumnId: Record<string, string> = {
		_id: "id",
		_lastUpdated: "lastUpdated",
	};
	const tableSort: SortState = sort
		? {
				column: apiToColumnId[sort.column] ?? sort.column,
				direction: sort.direction,
			}
		: null;

	const bulkActions: BulkAction[] = [
		{
			id: "export",
			label: (
				<>
					Export <Lucide.ChevronDownIcon size={16} />
				</>
			),
			icon: <Lucide.DownloadIcon size={16} />,
			onClick: handleExport,
		},
		{
			id: "delete",
			label: "Delete",
			icon: <Lucide.Trash2Icon size={16} />,
			variant: "danger",
			disabled: deleteMutation.isPending,
			onClick: () => deleteMutation.mutate(),
			confirm: {
				title: `Delete ${selectedIds.size} ${
					selectedIds.size === 1 ? "resource" : "resources"
				}?`,
				description:
					"Are you sure you want to delete the selected resources? This action cannot be undone.",
				actionLabel: "Delete",
			},
		},
	];

	return (
		<ResourcesTabContentContext.Provider
			value={{ resourcesLoading: isLoading }}
		>
			<div className="flex flex-col h-full">
				<ResourcesTabHeader handleSearch={handleSearch} />
				<div ref={scrollAreaRef} className="flex-1 overflow-auto">
					<DataTable<Resource>
						data={data?.resources ?? []}
						columns={columns}
						rowKey={(r) => r.id ?? ""}
						loading={isLoading}
						selectable
						selectedIds={selectedIds}
						onSelectionChange={setSelectedIds}
						sort={tableSort}
						onSortToggle={handleSortToggle}
						resizable
						tableId={`resource-browser-instances:${resourcesPageContext.resourceType}`}
						emptyState={
							<EmptyState
								title="No resources found"
								description="If you feel lonely create a new resource"
							/>
						}
					/>
				</div>
				<DataTableFooter
					total={total}
					currentPage={currentPage}
					pageSize={pageSize}
					selectedCount={selectedIds.size}
					bulkActions={bulkActions}
					onPageChange={handlePageChange}
					onPageSizeChange={handlePageSizeChange}
				/>
			</div>
		</ResourcesTabContentContext.Provider>
	);
};

const StructureDefinitionTab = ({
	client,
	url,
}: {
	client: AidboxClientR5;
	url: string;
}) => {
	const { data, isLoading } = ReactQuery.useQuery({
		queryKey: [Constants.PageID, "structure-definition", url],
		queryFn: async () => {
			const response = await client.rawRequest({
				url: `/fhir/StructureDefinition?url=${encodeURIComponent(url)}`,
				method: "GET",
			});
			const bundle: {
				entry?: Array<{ resource: unknown }>;
			} = await response.response.json();
			return bundle.entry?.[0]?.resource ?? null;
		},
		retry: false,
	});

	if (isLoading) {
		return <div>Loading...</div>;
	}

	if (!data) {
		return (
			<div className="text-text-secondary">No StructureDefinition found</div>
		);
	}

	return (
		<HSComp.CodeEditor
			readOnly
			currentValue={JSON.stringify(data, null, "  ")}
			mode="json"
		/>
	);
};

const ProfileElementsView = ({
	client,
	method,
	packageCoordinate,
	url,
}: {
	client: AidboxClientR5;
	method: string;
	packageCoordinate: string;
	url: string;
}) => {
	const { data, isLoading } = ReactQuery.useQuery({
		queryKey: [
			Constants.PageID,
			"profile-elements",
			method,
			packageCoordinate,
			url,
		],
		queryFn: () => fetchProfileElements(client, method, packageCoordinate, url),
		enabled: !!packageCoordinate && !!url,
		retry: false,
	});

	if (isLoading) {
		return <div className="text-text-secondary p-4">Loading...</div>;
	}

	return (
		<HSComp.FhirStructureView tree={Utils.transformSnapshotToTree(data)} />
	);
};

const ProfilesTabContent = ({
	client,
	resourceType,
}: Types.ResourcesPageProps) => {
	const navigate = Router.useNavigate();
	const search = Router.useSearch({ strict: false }) as {
		profile?: string;
		detailTab?: string;
	};

	const setSelectedProfile = (schema: Schema | null) => {
		navigate({
			from: "/resource/$resourceType/",
			search: (prev) => {
				if (!schema) {
					const {
						profile: _,
						detailTab: __,
						...rest
					} = prev as typeof prev & { profile?: string; detailTab?: string };
					return rest as typeof prev;
				}
				return {
					...prev,
					profile: schema.entity.url,
					detailTab: "differential",
				} as typeof prev;
			},
		});
	};

	const detailTab = search.detailTab || "differential";
	const setDetailTab = (value: string) => {
		navigate({
			from: "/resource/$resourceType/",
			search: (prev) =>
				({
					...prev,
					detailTab: value,
				}) as typeof prev,
		});
	};

	const { data, isLoading } = ReactQuery.useQuery({
		queryKey: [Constants.PageID, "resource-profiles-list", resourceType],
		queryFn: () => fetchSchemasApi(client, resourceType),
		retry: false,
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Loading...</div>
				</div>
			</div>
		);
	}

	if (!data || Object.keys(data).length === 0) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">No profiles found</div>
				</div>
			</div>
		);
	}

	const schemas = Object.values(data);

	const selectedProfile = search.profile
		? (schemas.find((s) => s.entity.url === search.profile) ?? null)
		: null;

	const profilesTable = (
		<HSComp.Table zebra stickyHeader className="typo-code">
			<HSComp.TableHeader>
				<HSComp.TableRow>
					<HSComp.TableHead>URL</HSComp.TableHead>
					<HSComp.TableHead className="w-[100px]">Name</HSComp.TableHead>
					<HSComp.TableHead className="w-[80px]">Version</HSComp.TableHead>
					<HSComp.TableHead className="w-[80px]">Default</HSComp.TableHead>
				</HSComp.TableRow>
			</HSComp.TableHeader>
			<HSComp.TableBody>
				{schemas.map((schema, index) => {
					const entity = schema.entity;
					return (
						<HSComp.TableRow
							key={entity?.url ?? index}
							zebra
							index={index}
							className="cursor-pointer"
							onClick={() => setSelectedProfile(schema)}
						>
							<HSComp.TableCell type="link">
								{entity?.url || "-"}
							</HSComp.TableCell>
							<HSComp.TableCell className="w-[100px]">
								{entity?.name || "-"}
							</HSComp.TableCell>
							<HSComp.TableCell className="w-[80px]">
								{entity?.version || "-"}
							</HSComp.TableCell>
							<HSComp.TableCell className="w-[80px]">
								{schema["default?"] ? "Default" : "-"}
							</HSComp.TableCell>
						</HSComp.TableRow>
					);
				})}
			</HSComp.TableBody>
		</HSComp.Table>
	);

	if (!selectedProfile) {
		return <div className="h-full overflow-auto">{profilesTable}</div>;
	}

	return (
		<div className="h-full overflow-hidden">
			<HSComp.ResizablePanelGroup
				direction="horizontal"
				autoSaveId="profiles-tab-horizontal-panel"
			>
				<HSComp.ResizablePanel minSize={30}>
					<div className="h-full overflow-auto">{profilesTable}</div>
				</HSComp.ResizablePanel>
				<HSComp.ResizableHandle />
				<HSComp.ResizablePanel minSize={30}>
					<HSComp.Tabs
						variant="tertiary"
						value={detailTab}
						onValueChange={setDetailTab}
						className="flex flex-col h-full"
					>
						<div className="flex items-center justify-between bg-bg-secondary flex-none h-10 border-b">
							<HSComp.TabsList className="py-0! border-b-0!">
								<HSComp.TabsTrigger value="differential">
									Differential
								</HSComp.TabsTrigger>
								<HSComp.TabsTrigger value="snapshot">
									Snapshot
								</HSComp.TabsTrigger>
								<HSComp.TabsTrigger value="fhirschema">
									FHIRSchema
								</HSComp.TabsTrigger>
								<HSComp.TabsTrigger value="structuredefinition">
									StructureDefinition
								</HSComp.TabsTrigger>
							</HSComp.TabsList>
							<HSComp.Button
								variant="ghost"
								size="small"
								className="mr-2"
								onClick={() => setSelectedProfile(null)}
							>
								<Lucide.XIcon size={16} />
							</HSComp.Button>
						</div>
						<HSComp.TabsContent
							value="differential"
							className="overflow-auto p-4"
						>
							<ProfileElementsView
								client={client}
								method="aidbox.introspector/get-profile-differential"
								packageCoordinate={selectedProfile["package-coordinate"]}
								url={selectedProfile.entity.url}
							/>
						</HSComp.TabsContent>
						<HSComp.TabsContent value="snapshot" className="overflow-auto p-4">
							<ProfileElementsView
								client={client}
								method="aidbox.introspector/get-profile-snapshot"
								packageCoordinate={selectedProfile["package-coordinate"]}
								url={selectedProfile.entity.url}
							/>
						</HSComp.TabsContent>
						<HSComp.TabsContent
							value="fhirschema"
							className="relative grow min-h-0"
						>
							<HSComp.CodeEditor
								readOnly
								currentValue={JSON.stringify(
									selectedProfile.entity,
									null,
									"  ",
								)}
								mode="json"
							/>
						</HSComp.TabsContent>
						<HSComp.TabsContent
							value="structuredefinition"
							className="relative grow min-h-0"
						>
							<StructureDefinitionTab
								client={client}
								url={selectedProfile.entity.url}
							/>
						</HSComp.TabsContent>
					</HSComp.Tabs>
				</HSComp.ResizablePanel>
			</HSComp.ResizablePanelGroup>
		</div>
	);
};

type SearchParameterResource = {
	id: string;
	url?: string;
	code?: string;
	name?: string;
	type?: string;
	description?: string;
};

type SearchParameterBundle = {
	entry?: { resource: SearchParameterResource }[];
};

const HOT_CALLS_THRESHOLD = 100;
const SLOW_MEAN_MS_THRESHOLD = 200;

type StatsSortCol = "calls" | "mean" | "last";
type StatsSortDir = "asc" | "desc";

const SearchParametersTabContent = ({
	client,
	resourceType,
}: Types.ResourcesPageProps) => {
	const { data, isLoading } = ReactQuery.useQuery({
		queryKey: [
			Constants.PageID,
			"resource-search-parameters-list",
			resourceType,
		],
		queryFn: async () => {
			const response = await client.rawRequest({
				method: "GET",
				url: `/fhir/SearchParameter?base=${resourceType}`,
				headers: {
					"Content-Type": "application/json",
				},
			});

			const data: SearchParameterBundle = await response.response.json();
			return data.entry?.map((e) => e.resource) ?? [];
		},
		retry: false,
	});

	const statsQuery = ReactQuery.useQuery({
		queryKey: [Constants.PageID, "resource-search-param-stats", resourceType],
		queryFn: async () => {
			try {
				const json = await rpcCall(
					client,
					"aidbox.index/get-search-param-stats",
					{
						"resource-type": resourceType,
						by: "param",
						limit: 1000,
						"flush-first": true,
					},
				);
				return (json.result ?? []) as SearchParamStat[];
			} catch {
				return [] as SearchParamStat[];
			}
		},
		retry: false,
		refetchInterval: 30_000,
	});

	const shapesQuery = ReactQuery.useQuery({
		queryKey: [Constants.PageID, "resource-search-param-shapes", resourceType],
		queryFn: async () => {
			try {
				const json = await rpcCall(
					client,
					"aidbox.index/get-search-param-stats",
					{
						"resource-type": resourceType,
						by: "shape",
						limit: 1000,
					},
				);
				return (json.result ?? []) as SearchParamShape[];
			} catch {
				return [] as SearchParamShape[];
			}
		},
		retry: false,
		refetchInterval: 30_000,
	});

	const statsByParam = React.useMemo(() => {
		const m = new Map<string, SearchParamStat>();
		for (const s of statsQuery.data ?? []) m.set(s.search_param, s);
		return m;
	}, [statsQuery.data]);

	const shapesByParam = React.useMemo(() => {
		const m = new Map<string, SearchParamShape[]>();
		for (const s of shapesQuery.data ?? []) {
			for (const sp of s.search_params) {
				if (!m.has(sp)) m.set(sp, []);
				m.get(sp)?.push(s);
			}
		}
		for (const [, arr] of m) arr.sort((a, b) => b.calls - a.calls);
		return m;
	}, [shapesQuery.data]);

	const [sort, setSort] = React.useState<{
		col: StatsSortCol;
		dir: StatsSortDir;
	}>({ col: "calls", dir: "desc" });

	const toggleSort = (col: StatsSortCol) => {
		setSort((prev) => ({
			col,
			dir: prev.col === col && prev.dir === "desc" ? "asc" : "desc",
		}));
	};

	const sortedHead = (col: StatsSortCol): "asc" | "desc" | false =>
		sort.col === col ? sort.dir : false;

	const sortedData = React.useMemo(() => {
		if (!data) return data;
		const dirMul = sort.dir === "desc" ? -1 : 1;
		const value = (param: SearchParameterResource): number | null => {
			const s = param.code ? statsByParam.get(param.code) : undefined;
			if (!s) return null;
			if (sort.col === "calls") return s.calls;
			if (sort.col === "mean") return s.mean_time_ms;
			if (sort.col === "last")
				return s.last_used_at ? Date.parse(s.last_used_at) : null;
			return null;
		};
		return [...data].sort((a, b) => {
			const av = value(a);
			const bv = value(b);
			// Rows without stats sink to the bottom regardless of direction.
			if (av == null && bv == null) return 0;
			if (av == null) return 1;
			if (bv == null) return -1;
			return (av - bv) * dirMul;
		});
	}, [data, statsByParam, sort]);

	if (isLoading) {
		return <div>Loading...</div>;
	}

	if (!sortedData || sortedData.length === 0) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">No search parameters found</div>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full overflow-auto">
			<HSComp.Table zebra stickyHeader className="typo-code">
				<HSComp.TableHeader>
					<HSComp.TableRow>
						<HSComp.TableHead className="w-6 px-1">
							<span className="sr-only">Alert</span>
						</HSComp.TableHead>
						<HSComp.TableHead>Definition</HSComp.TableHead>
						<HSComp.TableHead
							className="w-0 text-right"
							sortable
							sorted={sortedHead("calls")}
							onClick={() => toggleSort("calls")}
						>
							Calls
						</HSComp.TableHead>
						<HSComp.TableHead
							className="w-0 text-right"
							sortable
							sorted={sortedHead("mean")}
							onClick={() => toggleSort("mean")}
						>
							Mean&nbsp;ms
						</HSComp.TableHead>
						<HSComp.TableHead
							className="w-0"
							sortable
							sorted={sortedHead("last")}
							onClick={() => toggleSort("last")}
						>
							Last used
						</HSComp.TableHead>
						<HSComp.TableHead className="w-0">Code</HSComp.TableHead>
						<HSComp.TableHead className="w-0">Name</HSComp.TableHead>
						<HSComp.TableHead className="w-0">Type</HSComp.TableHead>
						<HSComp.TableHead>Description</HSComp.TableHead>
					</HSComp.TableRow>
				</HSComp.TableHeader>
				<HSComp.TableBody>
					{sortedData.map((param, index) => {
						const stats = param.code ? statsByParam.get(param.code) : undefined;
						const shapes = param.code
							? shapesByParam.get(param.code)
							: undefined;
						const alert =
							stats && !stats.has_index && stats.calls > HOT_CALLS_THRESHOLD
								? {
										message:
											"Frequent search-param use without an index. Consider creating one.",
									}
								: stats?.has_index &&
										stats.mean_time_ms > SLOW_MEAN_MS_THRESHOLD
									? {
											message:
												"Search uses an index but mean time is high. May benefit from a more selective or partial index.",
										}
									: null;
						return (
							<HSComp.TableRow key={param.id} zebra index={index}>
								<HSComp.TableCell className="w-6 px-1 align-middle">
									{alert ? (
										<HSComp.Tooltip>
											<HSComp.TooltipTrigger asChild>
												<span className="text-[var(--color-illustrations-solid)] inline-flex items-center align-middle">
													<Lucide.TriangleAlertIcon size={16} />
												</span>
											</HSComp.TooltipTrigger>
											<HSComp.TooltipContent
												side="right"
												className="bg-bg-warning-primary_inverse text-neutral-900 max-w-xs"
											>
												{alert.message}
											</HSComp.TooltipContent>
										</HSComp.Tooltip>
									) : null}
								</HSComp.TableCell>
								<HSComp.TableCell type="link">
									<Router.Link
										className="text-text-link hover:underline"
										to="/resource/$resourceType/edit/$id"
										params={{
											resourceType: "SearchParameter",
											id: param.id,
										}}
										search={{
											tab: "builder" as const,
											mode: "json" as const,
											builderTab: "form" as const,
										}}
									>
										{param.url || "-"}
									</Router.Link>
								</HSComp.TableCell>
								<HSComp.TableCell className="text-right tabular-nums">
									{stats && shapes && shapes.length > 0 ? (
										<HSComp.Tooltip>
											<HSComp.TooltipTrigger asChild>
												<span className="cursor-help underline decoration-dotted decoration-text-tertiary underline-offset-2">
													{formatCount(stats.calls)}
												</span>
											</HSComp.TooltipTrigger>
											<HSComp.TooltipContent
												side="left"
												className="max-w-md p-2"
											>
												<div className="space-y-1 typo-code text-xs">
													<div className="font-medium pb-1 mb-1 border-b border-border-secondary">
														Queries containing &lsquo;{param.code}&rsquo;
													</div>
													{shapes.map((s) => (
														<div
															key={s.search_params.join("|")}
															className="flex justify-between gap-4"
														>
															<span className="truncate">
																?{s.search_params.join("&")}
															</span>
															<span className="tabular-nums shrink-0 text-text-secondary">
																{formatCount(s.calls)} ·{" "}
																{formatMs(s.mean_time_ms)} ms
															</span>
														</div>
													))}
												</div>
											</HSComp.TooltipContent>
										</HSComp.Tooltip>
									) : stats ? (
										formatCount(stats.calls)
									) : (
										"—"
									)}
								</HSComp.TableCell>
								<HSComp.TableCell className="text-right tabular-nums">
									{stats ? formatMs(stats.mean_time_ms) : "—"}
								</HSComp.TableCell>
								<HSComp.TableCell
									title={stats?.last_used_at ?? undefined}
									className="whitespace-nowrap"
								>
									{formatRelativeTime(stats?.last_used_at)}
								</HSComp.TableCell>
								<HSComp.TableCell>{param.code || "-"}</HSComp.TableCell>
								<HSComp.TableCell>{param.name || "-"}</HSComp.TableCell>
								<HSComp.TableCell>{param.type || "-"}</HSComp.TableCell>
								<HSComp.TableCell>{param.description || "-"}</HSComp.TableCell>
							</HSComp.TableRow>
						);
					})}
				</HSComp.TableBody>
			</HSComp.Table>
		</div>
	);
};

export const ResourcesPage = ({
	client,
	resourceType,
}: Types.ResourcesPageProps) => {
	const navigate = Router.useNavigate();
	const queryClient = ReactQuery.useQueryClient();
	const search = Router.useSearch({ strict: false });
	const currentTab = (search as { tab?: string }).tab || "resources";

	const encodedSearchQuery = (search as { searchQuery?: string }).searchQuery;
	const decodedSearchQuery = encodedSearchQuery
		? atob(encodedSearchQuery)
		: Constants.DEFAULT_SEARCH_QUERY;

	const actionsRef = React.useRef<ResourceInstancesActions>(null);

	actionsRef.current = {
		switchTab: (tab) => {
			navigate({
				from: "/resource/$resourceType/",
				search: (prev) => {
					const {
						profile: _,
						detailTab: __,
						...rest
					} = prev as typeof prev & { profile?: string; detailTab?: string };
					return { ...rest, tab } as typeof prev;
				},
			});
		},
		instancesGetSearch: () => decodedSearchQuery,
		instancesSearch: (query) => {
			navigate({ to: ".", search: { searchQuery: btoa(query) } });
		},
		instancesGetResults: () => {
			type CachedData =
				| {
						resources: Resource[];
						resourceKeys: string[];
						total: number;
				  }
				| undefined;
			const data = queryClient.getQueryData<CachedData>([
				Constants.PageID,
				"resource-list",
				resourceType,
				decodedSearchQuery,
			]);
			if (!data) return null;
			return {
				total: data.total,
				page: parseSearchParam(decodedSearchQuery, "_page", 1),
				pageSize: parseSearchParam(decodedSearchQuery, "_count", 30),
				resourceType,
				searchQuery: decodedSearchQuery,
				columns: data.resourceKeys,
				resources: data.resources,
			};
		},
		instancesGetPage: () => {
			type CachedData = { total: number } | undefined;
			const data = queryClient.getQueryData<CachedData>([
				Constants.PageID,
				"resource-list",
				resourceType,
				decodedSearchQuery,
			]);
			return {
				page: parseSearchParam(decodedSearchQuery, "_page", 1),
				pageSize: parseSearchParam(decodedSearchQuery, "_count", 30),
				total: data?.total ?? 0,
			};
		},
		// Stubs — overridden by ResourcesTabContent when mounted
		instancesGetSelected: () => [],
		instancesSelect: () => {},
		instancesDeleteSelected: async () => [],
		instancesExportSelected: () => null,
		instancesChangePage: (page) => {
			const params = new URLSearchParams(decodedSearchQuery);
			params.set("_page", String(page));
			navigate({ to: ".", search: { searchQuery: btoa(params.toString()) } });
		},
		instancesChangePageSize: (pageSize) => {
			const params = new URLSearchParams(decodedSearchQuery);
			params.set("_count", String(pageSize));
			params.set("_page", "1");
			navigate({ to: ".", search: { searchQuery: btoa(params.toString()) } });
		},
		instancesNavigateToResource: (id) => {
			navigate({
				to: "/resource/$resourceType/edit/$id",
				params: { resourceType, id },
				search: {
					tab: defaultTabFor(resourceType),
					mode: "json" as const,
					builderTab: "form" as const,
				},
			});
		},
		instancesOpenCreatePage: () => {
			navigate({
				to: "/resource/$resourceType/create",
				params: { resourceType },
				search: {
					tab: defaultTabFor(resourceType),
					mode: "json" as const,
					builderTab: "form" as const,
				},
			});
		},
		profilesList: async () => {
			const schemas = await queryClient.fetchQuery({
				queryKey: [Constants.PageID, "resource-profiles-list"],
				queryFn: () => fetchSchemasApi(client, resourceType),
			});
			if (!schemas) return [];
			return Object.values(schemas).map((s) => ({
				url: s.entity.url,
				name: s.entity.name,
				version: s.entity.version,
				isDefault: s["default?"] === true,
			}));
		},
		profilesSelect: (url) => {
			navigate({
				from: "/resource/$resourceType/",
				search: (prev) =>
					({
						...prev,
						tab: "profiles",
						profile: url,
						detailTab: "differential",
					}) as typeof prev,
			});
		},
		profilesSelectTab: (tab) => {
			navigate({
				from: "/resource/$resourceType/",
				search: (prev) =>
					({
						...prev,
						detailTab: tab,
					}) as typeof prev,
			});
		},
		searchParamsList: async () => {
			const data = await queryClient.fetchQuery({
				queryKey: [
					Constants.PageID,
					"resource-search-parameters-list",
					resourceType,
				],
				queryFn: async () => {
					const response = await client.rawRequest({
						method: "GET",
						url: `/fhir/SearchParameter?base=${resourceType}`,
						headers: { "Content-Type": "application/json" },
					});
					const bundle: SearchParameterBundle = await response.response.json();
					return bundle.entry?.map((e) => e.resource) ?? [];
				},
			});
			return (data ?? []).map((p) => ({
				id: p.id,
				url: p.url ?? "",
				code: p.code ?? "",
				name: p.name ?? "",
				type: p.type ?? "",
				description: p.description ?? "",
			}));
		},
	};

	useWebMCPResourceInstances(actionsRef);

	const handleTabChange = (value: string) => {
		navigate({
			from: "/resource/$resourceType/",
			search: (prev) => {
				const {
					profile: _,
					detailTab: __,
					...rest
				} = prev as typeof prev & { profile?: string; detailTab?: string };
				return { ...rest, tab: value } as typeof prev;
			},
		});
	};

	return (
		<ResourcesPageContext.Provider value={{ resourceType }}>
			<HSComp.Tabs value={currentTab} onValueChange={handleTabChange}>
				<ResourcePageTabList />
				<HSComp.TabsContent value="resources" className="overflow-hidden">
					<ResourcesTabContent
						client={client}
						resourceType={resourceType}
						actionsRef={actionsRef}
					/>
				</HSComp.TabsContent>
				<HSComp.TabsContent value="profiles">
					<ProfilesTabContent client={client} resourceType={resourceType} />
				</HSComp.TabsContent>
				<HSComp.TabsContent value="extensions">
					<SearchParametersTabContent
						client={client}
						resourceType={resourceType}
					/>
				</HSComp.TabsContent>
			</HSComp.Tabs>
		</ResourcesPageContext.Provider>
	);
};
