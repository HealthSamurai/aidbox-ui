import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { ViewDefinition } from "@aidbox-ui/fhir-types/org-sql-on-fhir-ig";
import * as HSComp from "@health-samurai/react-components";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Plus } from "lucide-react";
import * as React from "react";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import { useLocalStorage } from "../../hooks";

const SQL_QUERY_TYPE_TOKEN =
	"https://sql-on-fhir.org/ig/CodeSystem/LibraryTypesCodes|sql-query";

type ViewTab = "builder" | "lineage" | "edit";
type QueryTab = "sqlquery" | "lineage" | "edit";

function mapToViewTab(currentTab: string | undefined): ViewTab {
	if (currentTab === "lineage" || currentTab === "edit") return currentTab;
	return "builder";
}

function mapToQueryTab(currentTab: string | undefined): QueryTab {
	if (currentTab === "lineage" || currentTab === "edit") return currentTab;
	return "sqlquery";
}

type SidebarItem = {
	id: string;
	label: string;
	description?: string;
};

type LibraryResource = {
	resourceType: "Library";
	id?: string;
	name?: string;
	title?: string;
	description?: string;
};

function pickLabel(r: { id?: string; name?: string; title?: string }): string {
	return r.title || r.name || r.id || "(unnamed)";
}

const SKELETON_WIDTHS = [
	"w-32",
	"w-40",
	"w-28",
	"w-44",
	"w-36",
	"w-24",
	"w-48",
	"w-32",
];

function SkeletonRows({ count }: { count: number }) {
	const rows = React.useMemo(
		() =>
			Array.from({ length: count }, () => ({
				id: crypto.randomUUID(),
				width:
					SKELETON_WIDTHS[Math.floor(Math.random() * SKELETON_WIDTHS.length)],
			})),
		[count],
	);
	return (
		<>
			{rows.map((r) => (
				<HSComp.SidebarMenuSubItem key={r.id}>
					<div className="flex items-center h-7 pl-[11px]">
						<HSComp.Skeleton className={`h-3.5 ${r.width}`} />
					</div>
				</HSComp.SidebarMenuSubItem>
			))}
		</>
	);
}

function useViewItems() {
	const client = useAidboxClient();
	return useQuery<SidebarItem[]>({
		queryKey: ["data-lineage-sidebar-views"],
		queryFn: async () => {
			const r = await client.request<Bundle>({
				method: "GET",
				url: "/fhir/ViewDefinition",
				params: [
					["_count", "200"],
					["_sort", "_createdAt"],
				],
			});
			if (r.isErr()) return [];
			return (r.value.resource.entry ?? []).flatMap((e) => {
				const vd = e.resource as
					| (ViewDefinition & { description?: string })
					| undefined;
				if (!vd?.id) return [];
				return [
					{ id: vd.id, label: pickLabel(vd), description: vd.description },
				];
			});
		},
	});
}

function useQueryItems(client: AidboxClientR5) {
	return useQuery<SidebarItem[]>({
		queryKey: ["data-lineage-sidebar-queries"],
		queryFn: async () => {
			const r = await client.request<Bundle>({
				method: "GET",
				url: "/fhir/Library",
				params: [
					["_count", "200"],
					["_sort", "_createdAt"],
					["type", SQL_QUERY_TYPE_TOKEN],
				],
			});
			if (r.isErr()) return [];
			return (r.value.resource.entry ?? []).flatMap((e) => {
				const lib = e.resource as LibraryResource | undefined;
				if (!lib?.id) return [];
				return [
					{ id: lib.id, label: pickLabel(lib), description: lib.description },
				];
			});
		},
	});
}

function HoverTooltip({
	description,
	children,
}: {
	description?: string;
	children: React.ReactNode;
}) {
	if (!description) return <>{children}</>;
	return (
		<HSComp.Tooltip delayDuration={200}>
			<HSComp.TooltipTrigger asChild>{children}</HSComp.TooltipTrigger>
			<HSComp.TooltipContent
				side="right"
				align="start"
				sideOffset={8}
				className="max-w-sm p-3 bg-bg-primary text-text-primary border border-border-primary shadow-md"
			>
				<span className="text-xs">{description}</span>
			</HSComp.TooltipContent>
		</HSComp.Tooltip>
	);
}

function filterItems(items: SidebarItem[], q: string): SidebarItem[] {
	const needle = q.trim().toLowerCase();
	if (!needle) return items;
	return items.filter(
		(it) =>
			it.label.toLowerCase().includes(needle) ||
			(it.description ?? "").toLowerCase().includes(needle),
	);
}

function ViewsSection({
	open,
	onOpenChange,
	currentPath,
	currentTab,
	items,
	loading,
	skeletonCount,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	currentPath: string;
	currentTab: string | undefined;
	items: SidebarItem[];
	loading: boolean;
	skeletonCount: number;
}) {
	const editSearch = {
		tab: mapToViewTab(currentTab),
		mode: "json" as const,
		builderTab: "form" as const,
	};
	const createSearch = {
		tab: "builder" as const,
		mode: "json" as const,
		builderTab: "form" as const,
	};
	return (
		<HSComp.SidebarMenuItem>
			<HSComp.Collapsible
				open={open}
				onOpenChange={onOpenChange}
				className="group/collapsible"
			>
				<div className="relative">
					<HSComp.CollapsibleTrigger asChild>
						<HSComp.SidebarMenuButton className="text-xs font-normal">
							<ChevronRight className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
							<span>Views</span>
						</HSComp.SidebarMenuButton>
					</HSComp.CollapsibleTrigger>
					<HSComp.SidebarMenuAction
						asChild
						className="top-0 right-0 h-full w-auto aspect-square rounded-lg"
					>
						<Link
							to="/analytics/views/create"
							search={createSearch}
							className="text-text-link! hover:text-text-link! [&>svg]:text-text-link!"
							aria-label="Create view"
						>
							<Plus />
						</Link>
					</HSComp.SidebarMenuAction>
				</div>
				<HSComp.CollapsibleContent>
					<HSComp.SidebarMenuSub>
						{loading && skeletonCount > 0 && (
							<SkeletonRows count={skeletonCount} />
						)}
						{!loading && items.length === 0 && (
							<HSComp.SidebarMenuSubItem>
								<div className="pl-[11px] py-1 text-xs italic text-text-tertiary">
									No views
								</div>
							</HSComp.SidebarMenuSubItem>
						)}
						{!loading &&
							items.map((it) => {
								const active = currentPath === `/analytics/views/edit/${it.id}`;
								return (
									<HSComp.SidebarMenuSubItem key={it.id}>
										<HoverTooltip description={it.description}>
											<HSComp.SidebarMenuSubButton
												isActive={active}
												asChild
												className="text-xs font-normal pl-[11px] data-[active=true]:bg-bg-tertiary data-[active=true]:hover:bg-bg-tertiary"
											>
												<Link
													to="/analytics/views/edit/$id"
													params={{ id: it.id }}
													search={editSearch}
												>
													<span className="truncate">{it.label}</span>
												</Link>
											</HSComp.SidebarMenuSubButton>
										</HoverTooltip>
									</HSComp.SidebarMenuSubItem>
								);
							})}
					</HSComp.SidebarMenuSub>
				</HSComp.CollapsibleContent>
			</HSComp.Collapsible>
		</HSComp.SidebarMenuItem>
	);
}

function QueriesSection({
	open,
	onOpenChange,
	currentPath,
	currentTab,
	items,
	loading,
	skeletonCount,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	currentPath: string;
	currentTab: string | undefined;
	items: SidebarItem[];
	loading: boolean;
	skeletonCount: number;
}) {
	const editSearch = {
		tab: mapToQueryTab(currentTab),
		mode: "json" as const,
		builderTab: "form" as const,
	};
	const createSearch = {
		tab: "sqlquery" as const,
		mode: "json" as const,
		builderTab: "form" as const,
	};
	return (
		<HSComp.SidebarMenuItem>
			<HSComp.Collapsible
				open={open}
				onOpenChange={onOpenChange}
				className="group/collapsible"
			>
				<div className="relative">
					<HSComp.CollapsibleTrigger asChild>
						<HSComp.SidebarMenuButton className="text-xs font-normal">
							<ChevronRight className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
							<span>Queries</span>
						</HSComp.SidebarMenuButton>
					</HSComp.CollapsibleTrigger>
					<HSComp.SidebarMenuAction
						asChild
						className="top-0 right-0 h-full w-auto aspect-square rounded-lg"
					>
						<Link
							to="/analytics/queries/create"
							search={createSearch}
							className="text-text-link! hover:text-text-link! [&>svg]:text-text-link!"
							aria-label="Create query"
						>
							<Plus />
						</Link>
					</HSComp.SidebarMenuAction>
				</div>
				<HSComp.CollapsibleContent>
					<HSComp.SidebarMenuSub>
						{loading && skeletonCount > 0 && (
							<SkeletonRows count={skeletonCount} />
						)}
						{!loading && items.length === 0 && (
							<HSComp.SidebarMenuSubItem>
								<div className="pl-[11px] py-1 text-xs italic text-text-tertiary">
									No queries
								</div>
							</HSComp.SidebarMenuSubItem>
						)}
						{!loading &&
							items.map((it) => {
								const active =
									currentPath === `/analytics/queries/edit/${it.id}`;
								return (
									<HSComp.SidebarMenuSubItem key={it.id}>
										<HoverTooltip description={it.description}>
											<HSComp.SidebarMenuSubButton
												isActive={active}
												asChild
												className="text-xs font-normal pl-[11px] data-[active=true]:bg-bg-tertiary data-[active=true]:hover:bg-bg-tertiary"
											>
												<Link
													to="/analytics/queries/edit/$id"
													params={{ id: it.id }}
													search={editSearch}
												>
													<span className="truncate">{it.label}</span>
												</Link>
											</HSComp.SidebarMenuSubButton>
										</HoverTooltip>
									</HSComp.SidebarMenuSubItem>
								);
							})}
					</HSComp.SidebarMenuSub>
				</HSComp.CollapsibleContent>
			</HSComp.Collapsible>
		</HSComp.SidebarMenuItem>
	);
}

export function DataLineageSidebar() {
	const routerState = useRouterState();
	const currentPath = routerState.location.pathname;
	const currentTab = (routerState.location.search as { tab?: string }).tab;
	const client = useAidboxClient();
	const views = useViewItems();
	const queries = useQueryItems(client);

	const [openViews, setOpenViews] = useLocalStorage<boolean>({
		key: "data-lineage-sidebar:open-views",
		defaultValue: true,
		getInitialValueInEffect: false,
	});
	const [openQueries, setOpenQueries] = useLocalStorage<boolean>({
		key: "data-lineage-sidebar:open-queries",
		defaultValue: true,
		getInitialValueInEffect: false,
	});
	const [viewsCount, setViewsCount] = useLocalStorage<number | null>({
		key: "data-lineage-sidebar:views-count",
		defaultValue: null,
		getInitialValueInEffect: false,
	});
	const [queriesCount, setQueriesCount] = useLocalStorage<number | null>({
		key: "data-lineage-sidebar:queries-count",
		defaultValue: null,
		getInitialValueInEffect: false,
	});
	const [searchQ, setSearchQ] = React.useState("");

	React.useEffect(() => {
		if (views.data) setViewsCount(views.data.length);
	}, [views.data, setViewsCount]);
	React.useEffect(() => {
		if (queries.data) setQueriesCount(queries.data.length);
	}, [queries.data, setQueriesCount]);

	const filteredViews = filterItems(views.data ?? [], searchQ);
	const filteredQueries = filterItems(queries.data ?? [], searchQ);

	return (
		<HSComp.Sidebar collapsible="none" className="w-full! border-r-0">
			<div className="h-10 px-4 flex items-center border-b shrink-0">
				<input
					value={searchQ}
					onChange={(e) => setSearchQ(e.target.value)}
					placeholder="Search…"
					className="w-full bg-transparent outline-none typo-body text-text-primary placeholder:text-text-tertiary"
				/>
			</div>
			<HSComp.SidebarContent>
				<HSComp.SidebarMenu>
					<ViewsSection
						open={openViews || searchQ.trim() !== ""}
						onOpenChange={setOpenViews}
						currentPath={currentPath}
						currentTab={currentTab}
						items={filteredViews}
						loading={views.isLoading}
						skeletonCount={viewsCount ?? 0}
					/>
					<QueriesSection
						open={openQueries || searchQ.trim() !== ""}
						onOpenChange={setOpenQueries}
						currentPath={currentPath}
						currentTab={currentTab}
						items={filteredQueries}
						loading={queries.isLoading}
						skeletonCount={queriesCount ?? 0}
					/>
				</HSComp.SidebarMenu>
			</HSComp.SidebarContent>
		</HSComp.Sidebar>
	);
}
