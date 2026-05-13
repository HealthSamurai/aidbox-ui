import type {
	Bundle,
	ParameterDefinition,
	RelatedArtifact,
	Resource,
} from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { Attachment } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core/Attachment";
import * as HSComp from "@health-samurai/react-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { DownloadIcon, PlusIcon, Trash2Icon, X } from "lucide-react";
import * as React from "react";
import { format as formatSQL } from "sql-formatter";
import { useAidboxClient } from "../../AidboxClient";
import {
	type BulkAction,
	type ColumnDef,
	DataTable,
	DataTableFooter,
	type SortState,
} from "../data-table";
import { EmptyState } from "../empty-state";

function formatSql(sql: string): string {
	try {
		return formatSQL(sql, { language: "postgresql" });
	} catch {
		return sql;
	}
}

const SQL_QUERY_TYPE =
	"https://sql-on-fhir.org/ig/CodeSystem/LibraryTypesCodes|sql-query";

type LibraryResource = Resource & {
	resourceType: "Library";
	name?: string;
	title?: string;
	description?: string;
	relatedArtifact?: RelatedArtifact[];
	content?: Attachment[];
	parameter?: ParameterDefinition[];
};

type QueryRow = {
	id: string;
	name: string;
	title: string;
	description: string;
	dependsOn: string[];
	parameters: ParameterDefinition[];
	sql: string;
};

type QueriesPageResult = {
	rows: QueryRow[];
	total: number;
};

function decodeBase64(b64: string): string {
	try {
		return atob(b64);
	} catch {
		return "";
	}
}

function libraryToRow(lib: LibraryResource): QueryRow | null {
	if (!lib.id) return null;
	const dependsOn = (lib.relatedArtifact ?? [])
		.filter((ra) => ra.type === "depends-on")
		.map((ra) => ra.resource ?? "")
		.filter(Boolean);
	const sql = lib.content?.[0]?.data ? decodeBase64(lib.content[0].data) : "";
	return {
		id: lib.id,
		name: lib.name ?? "",
		title: lib.title ?? "",
		description: lib.description ?? "",
		dependsOn,
		parameters: lib.parameter ?? [],
		sql,
	};
}

function useLibraries(params: {
	page: number;
	pageSize: number;
	sort: SortState;
	search: string;
}) {
	const client = useAidboxClient();
	return useQuery<QueriesPageResult>({
		queryKey: ["data-lineage-queries", params],
		queryFn: async () => {
			const sortParam = params.sort
				? `${params.sort.direction === "desc" ? "-" : ""}${params.sort.column}`
				: "-_lastUpdated";
			const queryParams: Array<[string, string]> = [
				["type", SQL_QUERY_TYPE],
				["_count", String(params.pageSize)],
				["_page", String(params.page)],
				["_sort", sortParam],
			];
			if (params.search) {
				queryParams.push(["_ilike", params.search]);
			}
			const result = await client.request<Bundle>({
				method: "GET",
				url: "/fhir/Library",
				params: queryParams,
			});
			if (result.isErr()) throw new Error("Failed to fetch queries");
			const bundle = result.value.resource;
			const entries = bundle.entry ?? [];
			const rows = entries.flatMap((entry) => {
				const lib = entry.resource as LibraryResource | undefined;
				if (!lib) return [];
				const row = libraryToRow(lib);
				return row ? [row] : [];
			});
			return { rows, total: bundle.total ?? rows.length };
		},
		placeholderData: (prev) => prev,
	});
}

function CollapsedCell({
	content,
	empty = "—",
}: {
	content: React.ReactNode;
	empty?: string;
}) {
	const isEmpty =
		!content ||
		(typeof content === "string" && content.length === 0) ||
		(Array.isArray(content) && content.length === 0);
	if (isEmpty) return <span className="text-text-tertiary">{empty}</span>;
	return (
		<HSComp.Tooltip delayDuration={250}>
			<HSComp.TooltipTrigger asChild>
				<span className="cursor-help text-text-tertiary">[...]</span>
			</HSComp.TooltipTrigger>
			<HSComp.TooltipContent
				side="bottom"
				align="start"
				className="max-w-2xl p-3 bg-bg-primary text-text-primary border border-border-primary shadow-md"
			>
				{content}
			</HSComp.TooltipContent>
		</HSComp.Tooltip>
	);
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

export function DataLineageQueries() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { q, page, pageSize } = useSearch({ from: "/data-lineage/queries/" });
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
			from: "/data-lineage/queries/",
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

	const { data, isLoading } = useLibraries({
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
						url: `/fhir/Library/${id}`,
					}),
				),
			);
		},
		onSuccess: () => {
			setSelectedIds(new Set());
			queryClient.invalidateQueries({ queryKey: ["data-lineage-queries"] });
		},
	});

	const handleExport = async () => {
		const ids = Array.from(selectedIds);
		const entries = await Promise.all(
			ids.map(async (id) => {
				const result = await client.request<LibraryResource>({
					method: "GET",
					url: `/fhir/Library/${id}`,
				});
				if (result.isErr()) return null;
				return { resource: result.value.resource };
			}),
		);
		const bundle: Bundle = {
			resourceType: "Bundle",
			type: "collection",
			entry: entries.filter(
				(e): e is { resource: LibraryResource } => e !== null,
			),
		};
		downloadBundle(bundle, `sql-queries-${Date.now()}.json`);
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
					selectedIds.size === 1 ? "query" : "queries"
				}?`,
				description:
					"Are you sure you want to delete the selected queries? This action cannot be undone.",
				actionLabel: "Delete",
			},
		},
	];

	const columns: ColumnDef<QueryRow>[] = [
		{
			id: "title",
			header: "Title",
			width: "w-64",
			cell: (row) => (
				<Link
					to="/data-lineage/queries/edit/$id"
					params={{ id: row.id }}
					search={{
						tab: "sqlquery" as const,
						mode: "json" as const,
						builderTab: "form" as const,
					}}
					className="text-text-link hover:underline"
				>
					{row.title || row.name || row.id}
				</Link>
			),
		},
		{
			id: "dependencies",
			header: "Dependencies",
			width: "w-40",
			cell: (row) => (
				<CollapsedCell
					content={
						row.dependsOn.length === 0 ? null : (
							<ul className="list-disc pl-4 space-y-0.5">
								{row.dependsOn.map((url) => (
									<li key={url} className="text-xs font-mono">
										{url}
									</li>
								))}
							</ul>
						)
					}
				/>
			),
		},
		{
			id: "parameters",
			header: "Parameters",
			width: "w-40",
			cell: (row) => (
				<CollapsedCell
					content={
						row.parameters.length === 0 ? null : (
							<ul className="list-disc pl-4 space-y-0.5">
								{row.parameters.map((p) => (
									<li
										key={`${p.type}-${p.name ?? ""}`}
										className="text-xs font-mono"
									>
										<span>{p.name ?? "—"}</span>{" "}
										<span className="text-text-tertiary">({p.type})</span>
									</li>
								))}
							</ul>
						)
					}
				/>
			),
		},
		{
			id: "sql",
			header: "SQL",
			width: "w-full",
			cell: (row) => (
				<CollapsedCell
					content={
						row.sql ? (
							<div className="w-[600px] max-h-[400px] overflow-auto">
								<HSComp.CodeEditor
									readOnly
									currentValue={formatSql(row.sql)}
									mode="sql"
									foldGutter={false}
									lineNumbers={false}
								/>
							</div>
						) : null
					}
				/>
			),
		},
		{
			id: "description",
			header: "Description",
			width: "w-64",
			cell: (row) =>
				row.description ? (
					<span className="block truncate" title={row.description}>
						{row.description}
					</span>
				) : (
					<span className="text-text-tertiary">—</span>
				),
		},
	];

	return (
		<div className="overflow-hidden h-full flex flex-col">
			<div className="flex gap-4 items-center px-4 py-3 border-b border-border-secondary">
				<HSComp.Input
					autoFocus
					type="text"
					className="flex-1 bg-bg-primary"
					placeholder="Search queries"
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
						to="/data-lineage/queries/create"
						search={{
							tab: "sqlquery" as const,
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
				<DataTable<QueryRow>
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
							title="No queries found"
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
