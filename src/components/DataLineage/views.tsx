import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { ViewDefinition } from "@aidbox-ui/fhir-types/org-sql-on-fhir-ig";
import * as HSComp from "@health-samurai/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { DownloadIcon, PlusIcon, Trash2Icon, X } from "lucide-react";
import * as React from "react";
import { useAidboxClient } from "../../AidboxClient";
import {
	type BulkAction,
	type ColumnDef,
	DataTable,
	DataTableFooter,
	type SortState,
} from "../data-table";
import { EmptyState } from "../empty-state";

type ViewRow = {
	id: string;
	name: string;
	resource: string;
};

type ViewsPageResult = {
	rows: ViewRow[];
	total: number;
};

function useViewDefinitions(params: {
	page: number;
	pageSize: number;
	sort: SortState;
	search: string;
}) {
	const client = useAidboxClient();
	return useQuery<ViewsPageResult>({
		queryKey: ["data-lineage-views", params],
		queryFn: async () => {
			const sortParam = params.sort
				? `${params.sort.direction === "desc" ? "-" : ""}${params.sort.column}`
				: "-_lastUpdated";
			const queryParams: Array<[string, string]> = [
				["_count", String(params.pageSize)],
				["_page", String(params.page)],
				["_sort", sortParam],
			];
			if (params.search) {
				queryParams.push(["_ilike", params.search]);
			}
			const result = await client.request<Bundle>({
				method: "GET",
				url: "/fhir/ViewDefinition",
				params: queryParams,
			});
			if (result.isErr()) throw new Error("Failed to fetch views");
			const bundle = result.value.resource;
			const entries = bundle.entry ?? [];
			const rows = entries.flatMap((entry) => {
				const vd = entry.resource as ViewDefinition | undefined;
				if (!vd?.id) return [];
				return [
					{
						id: vd.id,
						name: vd.name ?? "",
						resource: vd.resource ?? "",
					},
				];
			});
			return { rows, total: bundle.total ?? rows.length };
		},
		placeholderData: (prev) => prev,
	});
}

function downloadBundle(bundle: Bundle, filename: string) {
	const json = JSON.stringify(bundle, null, 2);
	const blob = new Blob([json], { type: "application/fhir+json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

export function DataLineageViews() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { q, page, pageSize } = useSearch({ from: "/data-lineage/views/" });
	const search = q ?? "";
	const currentPage = page ?? 1;
	const currentPageSize = pageSize ?? 20;

	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
	const [sort, setSort] = React.useState<SortState>(null);

	const setUrlParam = (
		name: "q" | "page" | "pageSize",
		value: string | number | undefined,
	) => {
		navigate({
			from: "/data-lineage/views/",
			search: (prev) => ({ ...prev, [name]: value || undefined }),
		});
	};

	const setFilterQuery = (value: string) => {
		setUrlParam("q", value);
		setUrlParam("page", 1);
	};

	const handleSortToggle = (column: string) => {
		setSort((prev) => {
			if (prev?.column !== column) return { column, direction: "asc" };
			if (prev.direction === "asc")
				return { column, direction: "desc" as const };
			return null;
		});
		setUrlParam("page", 1);
	};

	const { data, isLoading } = useViewDefinitions({
		page: currentPage,
		pageSize: currentPageSize,
		sort,
		search,
	});

	const rows = data?.rows ?? [];
	const total = data?.total ?? 0;

	const deleteMutation = useMutation({
		mutationFn: async (ids: string[]) => {
			await Promise.all(
				ids.map((id) =>
					client.request({
						method: "DELETE",
						url: `/fhir/ViewDefinition/${id}`,
					}),
				),
			);
		},
		onSuccess: () => {
			setSelectedIds(new Set());
			queryClient.invalidateQueries({ queryKey: ["data-lineage-views"] });
		},
	});

	const handleExport = async () => {
		const ids = Array.from(selectedIds);
		const entries = await Promise.all(
			ids.map(async (id) => {
				const result = await client.request<ViewDefinition>({
					method: "GET",
					url: `/fhir/ViewDefinition/${id}`,
				});
				if (result.isErr()) return null;
				return { resource: result.value.resource };
			}),
		);
		const bundle: Bundle = {
			resourceType: "Bundle",
			type: "collection",
			entry: entries.filter((e): e is { resource: ViewDefinition } => !!e),
		};
		downloadBundle(bundle, `view-definitions-${Date.now()}.json`);
	};

	const bulkActions: BulkAction[] = [
		{
			id: "export",
			label: "Export",
			icon: <DownloadIcon size={16} />,
			onClick: handleExport,
		},
		{
			id: "delete",
			label: "Delete",
			icon: <Trash2Icon size={16} />,
			variant: "danger",
			disabled: deleteMutation.isPending,
			onClick: () => deleteMutation.mutate(Array.from(selectedIds)),
			confirm: {
				title: `Delete ${selectedIds.size} ${
					selectedIds.size === 1 ? "view" : "views"
				}?`,
				description:
					"Are you sure you want to delete the selected views? This action cannot be undone.",
				actionLabel: "Delete",
			},
		},
	];

	const columns: ColumnDef<ViewRow>[] = [
		{
			id: "id",
			header: "ID",
			width: "w-64",
			cell: (row) => (
				<Link
					to="/data-lineage/views/edit/$id"
					params={{ id: row.id }}
					search={{
						tab: "builder" as const,
						mode: "json" as const,
						builderTab: "form" as const,
					}}
					className="text-text-link hover:underline"
				>
					{row.name || row.id}
				</Link>
			),
		},
		{
			id: "resource",
			header: "Resource",
			width: "w-full",
			cell: (row) => row.resource,
		},
	];

	return (
		<div className="overflow-hidden h-full flex flex-col">
			<div className="flex gap-4 items-center px-4 py-3 border-b border-border-secondary">
				<HSComp.Input
					autoFocus
					type="text"
					className="flex-1 bg-bg-primary"
					placeholder="Search views"
					value={search}
					onChange={(e) => setFilterQuery(e.target.value)}
					rightSlot={
						search && (
							<HSComp.IconButton
								icon={<X />}
								aria-label="Clear"
								variant="link"
								onClick={() => setFilterQuery("")}
							/>
						)
					}
				/>
				<HSComp.Button variant="secondary" asChild>
					<Link
						to="/data-lineage/views/create"
						search={{
							tab: "builder" as const,
							mode: "json" as const,
							builderTab: "form" as const,
						}}
					>
						<PlusIcon className="text-fg-link" />
						Create
					</Link>
				</HSComp.Button>
			</div>
			<div className="flex-1 overflow-auto">
				<DataTable<ViewRow>
					data={rows}
					columns={columns}
					rowKey={(row) => row.id}
					loading={isLoading}
					selectable
					selectedIds={selectedIds}
					onSelectionChange={setSelectedIds}
					sort={sort}
					onSortToggle={handleSortToggle}
					emptyState={
						<EmptyState
							title="No views found"
							description="Try a different search query"
						/>
					}
				/>
			</div>
			<DataTableFooter
				total={total}
				currentPage={currentPage}
				pageSize={currentPageSize}
				selectedCount={selectedIds.size}
				bulkActions={bulkActions}
				onPageChange={(p) => setUrlParam("page", p)}
				onPageSizeChange={(s) => {
					setUrlParam("pageSize", s);
					setUrlParam("page", 1);
				}}
			/>
		</div>
	);
}
