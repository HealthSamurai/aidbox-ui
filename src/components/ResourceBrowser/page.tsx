import { defaultToastPlacement } from "@aidbox-ui/components/config";
import type { Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import * as HSComp from "@health-samurai/react-components";
import * as ReactQuery from "@tanstack/react-query";
import * as Router from "@tanstack/react-router";
import * as Lucide from "lucide-react";
import * as React from "react";
import type { AidboxClientR5 } from "../../AidboxClient";
import * as ApiUtils from "../../api/utils";
import * as Humanize from "../../humanize";
import * as Utils from "../../utils";
import type * as VDTypes from "../ViewDefinition/types";
import * as Constants from "./constants";
import type * as Types from "./types";

type FhirSchema = {
	elements: Record<string, unknown>;
	url: string;
	name: string;
	version: string;
};

interface Schema {
	differential: Array<VDTypes.Snapshot>;
	snapshot: Array<VDTypes.Snapshot>;
	entity: FhirSchema;
	"default?": boolean;
}

interface SchemaData {
	result: Record<string, Schema>;
}

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

	const handleClear = () => {
		if (inputRef.current) {
			inputRef.current.value = Constants.DEFAULT_SEARCH_QUERY;
			inputRef.current.focus();
		}
	};

	const handleCopy = () => {
		if (inputRef.current) {
			navigator.clipboard.writeText(inputRef.current.value);
		}
	};

	return (
		<div className="relative flex-1 min-w-0">
			<HSComp.Input
				ref={inputRef}
				autoFocus
				type="text"
				name="searchQuery"
				className="pr-14!"
				defaultValue={decodedSearchQuery}
				prefixValue={
					<span className="flex gap-1 text-nowrap text-elements-assistive">
						<span className="font-bold">GET</span>
						<span>/fhir/{resourcesPageContext.resourceType}?</span>
					</span>
				}
			/>
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
			search={{ tab: "code", mode: "json" }}
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

const fetchSchemas = async (
	client: AidboxClientR5,
	resourceType: string,
): Promise<Record<string, Schema> | undefined> => {
	const response = await client.rawRequest({
		method: "POST",
		url: "/rpc?_m=aidbox.introspector/get-schemas-by-resource-type",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			method: "aidbox.introspector/get-schemas-by-resource-type",
			params: { "resource-type": resourceType },
		}),
	});

	const data: SchemaData = await response.response.json();

	if (!data?.result) return undefined;

	return data.result;
};

const fetchDefaultSchema = async (
	client: AidboxClientR5,
	resourceType: string,
): Promise<Schema | undefined> => {
	const schemas = await fetchSchemas(client, resourceType);

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

export const ResourcesTabTable = ({
	data,
	selectedIds,
	setSelectedIds,
}: Types.ResourcesTabTableProps) => {
	const resourcesPageContext = React.useContext(ResourcesPageContext);
	const resourcesTabContentContext = React.useContext(
		ResourcesTabContentContext,
	);

	if (resourcesTabContentContext.resourcesLoading) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Loading...</div>
				</div>
			</div>
		);
	}

	if (!data || !data.resources || data.resources.length === 0) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="flex flex-col items-center gap-4">
					<div className="flex flex-col items-center gap-2">
						<img src="/no-resources.svg" alt="" />
						<span className="text-lg font-semibold">No resources found</span>
					</div>
					<span className="text-text-secondary">
						If you feel lonely create a new resource
					</span>
				</div>
			</div>
		);
	}

	const { resources, resourceKeys, snapshot } = data;

	const allIds = resources.map((r) => r.id).filter(Boolean) as string[];
	const allSelected =
		allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
	const someSelected = !allSelected && allIds.some((id) => selectedIds.has(id));

	const toggleAll = () => {
		if (allSelected) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(allIds));
		}
	};

	const toggleOne = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const dynamicKeys = resourceKeys.filter((k) => k !== "id" && k !== "meta");

	return (
		<HSComp.Table zebra stickyHeader>
			<HSComp.TableHeader>
				<HSComp.TableRow>
					<HSComp.TableHead className="w-[52px] min-w-[52px]">
						<HSComp.Checkbox
							size="small"
							className="border-border-primary"
							checked={
								allSelected ? true : someSelected ? "indeterminate" : false
							}
							onCheckedChange={toggleAll}
							aria-label="Select all"
						/>
					</HSComp.TableHead>
					<HSComp.TableHead className="w-0">Id</HSComp.TableHead>
					<HSComp.TableHead
						className={dynamicKeys.length > 0 ? "w-0" : undefined}
					>
						LastUpdated
					</HSComp.TableHead>
					{dynamicKeys.map((k, i) => (
						<HSComp.TableHead
							key={k}
							className={i < dynamicKeys.length - 1 ? "w-0" : undefined}
						>
							{k}
						</HSComp.TableHead>
					))}
				</HSComp.TableRow>
			</HSComp.TableHeader>
			<HSComp.TableBody>
				{resources.map((resource, index) => {
					const id = resource.id ?? "";
					const isSelected = selectedIds.has(id);
					return (
						<HSComp.TableRow
							key={id || index}
							zebra
							index={index}
							selected={isSelected}
						>
							<HSComp.TableCell>
								<HSComp.Checkbox
									size="small"
									className="border-border-primary"
									checked={isSelected}
									onCheckedChange={() => toggleOne(id)}
									aria-label={`Select ${id}`}
								/>
							</HSComp.TableCell>
							<HSComp.TableCell type="link">
								<Router.Link
									className="text-text-link hover:underline"
									to="/resource/$resourceType/edit/$id"
									search={{ tab: "code", mode: "json" }}
									params={{
										resourceType: resourcesPageContext.resourceType,
										id,
									}}
								>
									{id}
								</Router.Link>
							</HSComp.TableCell>
							<HSComp.TableCell>
								{Humanize.humanizeValue(
									"lastUpdated",
									resource.meta?.lastUpdated,
									{},
								)}
							</HSComp.TableCell>
							{dynamicKeys.map((k) => (
								<HSComp.TableCell key={k}>
									{Humanize.humanizeValue(
										k,
										(resource as Record<string, unknown>)[k],
										snapshot ?? {},
									)}
								</HSComp.TableCell>
							))}
						</HSComp.TableRow>
					);
				})}
			</HSComp.TableBody>
		</HSComp.Table>
	);
};

const PaginationPages = ({
	currentPage,
	totalPages,
	onPageChange,
}: {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}) => {
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
				<Lucide.ChevronLeftIcon size={16} />
			</HSComp.Button>
			{pages.map((page) =>
				typeof page === "string" ? (
					<span key={page} className="px-1 text-elements-assistive">
						...
					</span>
				) : (
					<HSComp.Button
						key={page}
						variant={page === currentPage ? "secondary" : "ghost"}
						size="small"
						onClick={() => onPageChange(page)}
					>
						{page}
					</HSComp.Button>
				),
			)}
			<HSComp.Button
				variant="ghost"
				size="small"
				disabled={currentPage >= totalPages}
				onClick={() => onPageChange(currentPage + 1)}
			>
				<Lucide.ChevronRightIcon size={16} />
			</HSComp.Button>
		</div>
	);
};

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

const ResourcesTabFooter = ({
	total,
	currentPage,
	pageSize,
	selectedIds,
	onPageChange,
	onPageSizeChange,
	onExport,
	onDelete,
	isDeleting,
}: Types.ResourcesTabFooterProps) => {
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const selectionCount = selectedIds.size;
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

	return (
		<div className="flex items-center justify-between border-t bg-bg-secondary px-4 h-10">
			<div className="flex items-center gap-4">
				{selectionCount > 0 && (
					<>
						<span className="typo-default text-text-primary">
							{selectionCount} selected:
						</span>
						<HSComp.Button
							variant="ghost"
							size="small"
							className="text-text-secondary!"
							onClick={onExport}
						>
							<Lucide.DownloadIcon size={16} />
							Export
							<Lucide.ChevronDownIcon size={16} />
						</HSComp.Button>
						<HSComp.Button
							variant="ghost"
							size="small"
							className="text-text-secondary!"
							disabled={isDeleting}
							onClick={() => setIsDeleteDialogOpen(true)}
						>
							<Lucide.Trash2Icon size={16} />
							Delete
						</HSComp.Button>
						<HSComp.AlertDialog
							open={isDeleteDialogOpen}
							onOpenChange={setIsDeleteDialogOpen}
						>
							<HSComp.AlertDialogContent>
								<HSComp.AlertDialogHeader>
									<HSComp.AlertDialogTitle>
										Delete {selectionCount}{" "}
										{selectionCount === 1 ? "resource" : "resources"}?
									</HSComp.AlertDialogTitle>
								</HSComp.AlertDialogHeader>
								<HSComp.AlertDialogDescription>
									Are you sure you want to delete the selected{" "}
									{selectionCount === 1 ? "resource" : "resources"}? This action
									cannot be undone.
								</HSComp.AlertDialogDescription>
								<HSComp.AlertDialogFooter>
									<HSComp.AlertDialogCancel>Cancel</HSComp.AlertDialogCancel>
									<HSComp.AlertDialogAction
										variant="primary"
										danger
										onClick={() => {
											onDelete();
											setIsDeleteDialogOpen(false);
										}}
									>
										<Lucide.Trash2Icon className="w-4 h-4" />
										Delete
									</HSComp.AlertDialogAction>
								</HSComp.AlertDialogFooter>
							</HSComp.AlertDialogContent>
						</HSComp.AlertDialog>
					</>
				)}
			</div>
			<div className="flex items-center gap-4">
				<HSComp.DropdownMenu>
					<HSComp.DropdownMenuTrigger asChild>
						<HSComp.Button variant="ghost" size="small">
							{pageSize}/page
							<Lucide.ChevronDownIcon size={14} />
						</HSComp.Button>
					</HSComp.DropdownMenuTrigger>
					<HSComp.DropdownMenuContent align="end">
						{PAGE_SIZE_OPTIONS.map((size) => (
							<HSComp.DropdownMenuItem
								key={size}
								onClick={() => onPageSizeChange(size)}
							>
								{size}/page
							</HSComp.DropdownMenuItem>
						))}
					</HSComp.DropdownMenuContent>
				</HSComp.DropdownMenu>
				<PaginationPages
					currentPage={currentPage}
					totalPages={totalPages}
					onPageChange={onPageChange}
				/>
			</div>
		</div>
	);
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

const ResourcesTabContent = ({
	client,
	resourceType,
}: Types.ResourcesPageProps) => {
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
	const pageSize = parseSearchParam(decodedSearchQuery, "_count", 30);

	const { data, isLoading, error } = ReactQuery.useQuery({
		queryKey: [Constants.PageID, "resource-list", decodedSearchQuery],
		queryFn: async () => {
			const result = await client.searchType({
				type: resourcesPageContext.resourceType,
				query: Utils.formatSearchQuery(decodedSearchQuery),
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
			const schema = await fetchDefaultSchema(client, resourceType);
			return { ...resourcesWithKeys(schema, resources), total };
		},
		retry: false,
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset selection when search query changes
	React.useEffect(() => {
		setSelectedIds(new Set());
	}, [decodedSearchQuery]);

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

	return (
		<ResourcesTabContentContext.Provider
			value={{ resourcesLoading: isLoading }}
		>
			<div className="flex flex-col h-full">
				<ResourcesTabHeader handleSearch={handleSearch} />
				<div className="flex-1 overflow-auto">
					<ResourcesTabTable
						data={data}
						total={total}
						selectedIds={selectedIds}
						setSelectedIds={setSelectedIds}
					/>
				</div>
				<ResourcesTabFooter
					total={total}
					currentPage={currentPage}
					pageSize={pageSize}
					selectedIds={selectedIds}
					onPageChange={handlePageChange}
					onPageSizeChange={handlePageSizeChange}
					onExport={handleExport}
					onDelete={() => deleteMutation.mutate()}
					isDeleting={deleteMutation.isPending}
				/>
			</div>
		</ResourcesTabContentContext.Provider>
	);
};

const ProfilesTabContent = ({
	client,
	resourceType,
}: Types.ResourcesPageProps) => {
	const [selectedProfile, setSelectedProfile] = React.useState<Schema | null>(
		null,
	);
	const [detailTab, setDetailTab] = React.useState<string>("differential");

	const { data, isLoading } = ReactQuery.useQuery({
		queryKey: [Constants.PageID, "resource-profiles-list"],
		queryFn: async () => {
			const schema = await fetchSchemas(client, resourceType);
			return schema;
		},
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

	const profilesTable = (
		<HSComp.Table zebra stickyHeader>
			<HSComp.TableHeader>
				<HSComp.TableRow>
					<HSComp.TableHead>URL</HSComp.TableHead>
					<HSComp.TableHead className="w-[100px]">Name</HSComp.TableHead>
					<HSComp.TableHead className="w-[80px]">Version</HSComp.TableHead>
					<HSComp.TableHead className="w-[80px]">IG</HSComp.TableHead>
					<HSComp.TableHead className="w-[80px]">Default</HSComp.TableHead>
				</HSComp.TableRow>
			</HSComp.TableHeader>
			<HSComp.TableBody>
				{schemas.map((schema, index) => {
					const entity = schema.entity;
					const ig = entity ? `${entity.name}#${entity.version}` : "-";
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
							<HSComp.TableCell className="w-[80px]">{ig}</HSComp.TableCell>
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
					<div className="h-full flex flex-col">
						<div className="border-b h-10 flex items-center justify-between px-4">
							<HSComp.Tabs
								value={detailTab}
								onValueChange={setDetailTab}
								className="flex-1"
							>
								<HSComp.TabsList>
									<HSComp.TabsTrigger value="differential">
										Differential
									</HSComp.TabsTrigger>
									<HSComp.TabsTrigger value="snapshot">
										Snapshot
									</HSComp.TabsTrigger>
									<HSComp.TabsTrigger value="fhirschema">
										FHIRSchema
									</HSComp.TabsTrigger>
								</HSComp.TabsList>
							</HSComp.Tabs>
							<HSComp.Button
								variant="ghost"
								size="small"
								onClick={() => setSelectedProfile(null)}
							>
								<Lucide.XIcon size={16} />
							</HSComp.Button>
						</div>
						<div className="flex-1 overflow-auto p-4">
							<HSComp.Tabs value={detailTab}>
								<HSComp.TabsContent value="differential">
									<HSComp.FhirStructureView
										tree={Utils.transformSnapshotToTree(
											selectedProfile.differential,
										)}
									/>
								</HSComp.TabsContent>
								<HSComp.TabsContent value="snapshot">
									<HSComp.FhirStructureView
										tree={Utils.transformSnapshotToTree(
											selectedProfile.snapshot,
										)}
									/>
								</HSComp.TabsContent>
								<HSComp.TabsContent value="fhirschema">
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
							</HSComp.Tabs>
						</div>
					</div>
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

	if (isLoading) {
		return <div>Loading...</div>;
	}

	if (!data || data.length === 0) {
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
			<HSComp.Table zebra stickyHeader>
				<HSComp.TableHeader>
					<HSComp.TableRow>
						<HSComp.TableHead>Definition</HSComp.TableHead>
						<HSComp.TableHead className="w-0">Code</HSComp.TableHead>
						<HSComp.TableHead className="w-0">Name</HSComp.TableHead>
						<HSComp.TableHead className="w-0">Type</HSComp.TableHead>
						<HSComp.TableHead>Description</HSComp.TableHead>
					</HSComp.TableRow>
				</HSComp.TableHeader>
				<HSComp.TableBody>
					{data.map((param, index) => (
						<HSComp.TableRow key={param.id} zebra index={index}>
							<HSComp.TableCell type="link">
								<Router.Link
									className="text-text-link hover:underline"
									to="/resource/$resourceType/edit/$id"
									search={{ tab: "code", mode: "json" }}
									params={{
										resourceType: "SearchParameter",
										id: param.id,
									}}
								>
									{param.url || "-"}
								</Router.Link>
							</HSComp.TableCell>
							<HSComp.TableCell>{param.code || "-"}</HSComp.TableCell>
							<HSComp.TableCell>{param.name || "-"}</HSComp.TableCell>
							<HSComp.TableCell>{param.type || "-"}</HSComp.TableCell>
							<HSComp.TableCell>{param.description || "-"}</HSComp.TableCell>
						</HSComp.TableRow>
					))}
				</HSComp.TableBody>
			</HSComp.Table>
		</div>
	);
};

export const ResourcesPage = ({
	client,
	resourceType,
}: Types.ResourcesPageProps) => {
	return (
		<ResourcesPageContext.Provider value={{ resourceType }}>
			<HSComp.Tabs defaultValue="resources">
				<ResourcePageTabList />
				<HSComp.TabsContent value="resources" className="overflow-hidden">
					<ResourcesTabContent client={client} resourceType={resourceType} />
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
