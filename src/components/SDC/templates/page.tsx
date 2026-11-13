import * as HSComp from "@health-samurai/react-components";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Braces, Ellipsis, ExternalLink, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import {
	type BulkAction,
	type ColumnDef,
	DataTable,
	DataTableFooter,
} from "../../data-table";
import { EmptyState } from "../../empty-state";
import {
	getTemplateLabel,
	type LiquidTemplateLibrary,
	type TemplateUsage,
	useDeleteLiquidTemplates,
	useLiquidTemplates,
	useTemplateUsage,
} from "../formbox/api/templates";
import { pageAfterDeleting } from "../formbox/pages/responses/pagination";
import {
	getLiquidTemplateEditorUrl,
	getNewLiquidTemplateUrl,
} from "../formbox/utils";
import { formatHumanizedDate } from "../shared/format";
import { FilterField, SearchInput } from "../shared/grid-filters";
import { DeleteTemplatesDialog } from "./delete-templates-dialog";
import { DEFAULT_PAGE_SIZE, type TemplatesSearch } from "./search";

function useTemplatesSearch() {
	const search = useSearch({ from: "/forms/templates" });
	const navigate = useNavigate({ from: "/forms/templates" });
	const update = (next: Partial<TemplatesSearch>) =>
		navigate({
			search: (previous) => ({ ...previous, ...next }),
			replace: true,
		});
	return { search, update };
}

const openNewTemplate = () => window.location.assign(getNewLiquidTemplateUrl());

function NewTemplateButton({ testId }: { testId: string }) {
	return (
		<HSComp.Button
			size="small"
			className="h-8 px-3"
			data-test-id={testId}
			onClick={openNewTemplate}
		>
			<Plus className="size-4" />
			New Template
		</HSComp.Button>
	);
}

/** Muted text with the full value on hover, or a dash when there is none. */
function text(value: string | undefined, title = value) {
	return value ? (
		<span className="block truncate text-text-secondary" title={title}>
			{value}
		</span>
	) : (
		<span className="text-text-tertiary">—</span>
	);
}

function NameCell({ template }: { template: LiquidTemplateLibrary }) {
	const label = getTemplateLabel(template);
	const reference = template.url ?? template.id ?? "";
	return (
		<div
			className="flex min-w-0 flex-col"
			title={[label, reference].filter(Boolean).join("\n")}
		>
			{template.id ? (
				<a
					href={getLiquidTemplateEditorUrl(template.id)}
					// The row opens the editor too; the link only adds a real href.
					onClick={(event) => event.stopPropagation()}
					className="block truncate text-text-link hover:underline"
					data-test-id="templates-table__name-link"
				>
					{label}
				</a>
			) : (
				<span className="block truncate">{label}</span>
			)}
			<span
				className="block truncate text-xs text-text-tertiary"
				data-test-id="templates-table__id-text"
			>
				{reference}
			</span>
		</div>
	);
}

function ActionsCell({
	template,
	onDelete,
}: {
	template: LiquidTemplateLibrary;
	onDelete: (id: string) => void;
}) {
	const id = template.id;
	return (
		<HSComp.DropdownMenu>
			<HSComp.DropdownMenuTrigger asChild>
				<HSComp.IconButton
					variant="ghost"
					aria-label={`Open actions for ${getTemplateLabel(template)}`}
					data-test-id="templates-table__row-menu-button"
					icon={<Ellipsis className="size-4" />}
				/>
			</HSComp.DropdownMenuTrigger>
			{/* The menu is portalled, but React still bubbles its clicks to
				    the row, which would open the editor. */}
			<HSComp.DropdownMenuContent
				align="end"
				data-test-id="templates-table__row-menu"
				onClick={(event) => event.stopPropagation()}
			>
				<HSComp.DropdownMenuItem
					className="justify-start text-text-secondary"
					data-test-id="templates-table__row-menu-open-button"
					disabled={!id}
					onClick={() => {
						if (id) window.location.assign(getLiquidTemplateEditorUrl(id));
					}}
				>
					<ExternalLink className="size-4" />
					Open
				</HSComp.DropdownMenuItem>
				{id ? (
					<HSComp.DropdownMenuItem
						asChild
						className="justify-start text-text-secondary"
						data-test-id="templates-table__row-menu-resource-link"
					>
						<Link
							to="/resource/$resourceType/edit/$id"
							params={{ resourceType: "Library", id }}
							search={{ tab: "edit", mode: "json", builderTab: "form" }}
						>
							<Braces className="size-4" />
							Open resource
						</Link>
					</HSComp.DropdownMenuItem>
				) : null}
				<HSComp.DropdownMenuItem
					variant="destructive"
					className="justify-start"
					data-test-id="templates-table__row-menu-delete-button"
					disabled={!id}
					onClick={() => {
						if (id) onDelete(id);
					}}
				>
					<Trash2 className="size-4" />
					Delete
				</HSComp.DropdownMenuItem>
			</HSComp.DropdownMenuContent>
		</HSComp.DropdownMenu>
	);
}

function templatesColumns({
	usage,
	onDelete,
}: {
	usage: Map<string, TemplateUsage>;
	onDelete: (id: string) => void;
}): ColumnDef<LiquidTemplateLibrary>[] {
	const usageOf = (template: LiquidTemplateLibrary) =>
		template.id ? usage.get(template.id) : undefined;
	return [
		{
			id: "name",
			header: "Template",
			grow: true,
			minSize: 180,
			cell: (template) => <NameCell template={template} />,
		},
		{
			id: "status",
			header: "Status",
			minSize: 80,
			cell: (template) => text(template.status),
		},
		{
			id: "forms",
			header: "Forms",
			minSize: 64,
			cell: (template) => {
				const forms = usageOf(template)?.forms ?? [];
				return forms.length > 0
					? text(
							String(forms.length),
							forms.map((form) => form.label).join("\n"),
						)
					: text(undefined);
			},
		},
		{
			id: "purpose",
			header: "Purpose",
			minSize: 96,
			cell: (template) => {
				const purposes = usageOf(template)?.purposes ?? [];
				return text(
					purposes.length > 0 ? purposes.join(", ") : undefined,
					purposes.join("\n"),
				);
			},
		},
		{
			id: "updated",
			header: "Updated",
			minSize: 112,
			cell: (template) => {
				const updated = template.meta?.lastUpdated;
				return text(
					updated ? formatHumanizedDate(updated) : undefined,
					updated,
				);
			},
		},
		{
			id: "actions",
			header: "Actions",
			fixedSize: 72,
			className: "px-2",
			cell: (template) => (
				<ActionsCell template={template} onDelete={onDelete} />
			),
		},
	];
}

/**
 * Liquid templates (Libraries with the liquid-template topic), as in Formbox:
 * `$render` turns a response into HTML or a PDF through them. They are edited
 * in the classic template editor, which a row opens.
 */
export function TemplatesPage() {
	const { search, update } = useTemplatesSearch();
	const page = search.page ?? 1;
	const pageSize = search.pageSize ?? DEFAULT_PAGE_SIZE;

	const templates = useLiquidTemplates({ q: search.q }, page, pageSize);
	const { data: usage = new Map<string, TemplateUsage>() } = useTemplateUsage();
	const deleteTemplates = useDeleteLiquidTemplates();
	const rows = templates.data?.templates ?? [];
	const total = templates.data?.total ?? 0;

	// Selection belongs to the rows on screen, so a new page or search drops it.
	const scope = JSON.stringify([search.q, page, pageSize]);
	const [selection, setSelection] = React.useState({
		scope,
		ids: new Set<string>(),
	});
	const selected =
		selection.scope === scope ? selection.ids : new Set<string>();
	const setSelected: React.Dispatch<React.SetStateAction<Set<string>>> = (
		next,
	) =>
		setSelection((previous) => {
			const current =
				previous.scope === scope ? previous.ids : new Set<string>();
			return {
				scope,
				ids: typeof next === "function" ? next(current) : next,
			};
		});

	const [idsPendingDelete, setIdsPendingDelete] = React.useState<string[]>([]);
	const formsPendingDelete = [
		...new Map(
			idsPendingDelete.flatMap((id) =>
				(usage.get(id)?.forms ?? []).map((form) => [form.id, form] as const),
			),
		).values(),
	];

	const confirmDelete = async () => {
		const ids = idsPendingDelete;
		try {
			await deleteTemplates.mutateAsync(ids);
		} catch (error) {
			HSComp.toast.error(
				error instanceof Error ? error.message : "Failed to delete templates",
			);
			return;
		}
		HSComp.toast.success(
			ids.length === 1 ? "Template deleted" : `${ids.length} templates deleted`,
		);
		setSelected((previous) => {
			const next = new Set(previous);
			for (const id of ids) next.delete(id);
			return next;
		});
		setIdsPendingDelete([]);
		const nextPage = pageAfterDeleting({
			currentPage: page,
			deletedCount: ids.length,
			pageSize,
			total,
		});
		if (nextPage !== page) {
			update({ page: nextPage > 1 ? nextPage : undefined });
		}
	};

	const bulkActions: BulkAction[] = [
		{
			id: "delete",
			label: "Delete",
			icon: <Trash2 className="size-4" />,
			variant: "danger",
			onClick: () => setIdsPendingDelete([...selected]),
		},
	];

	let content: React.ReactNode;
	if (templates.isLoading) {
		content = (
			<div className="flex h-full items-center justify-center text-text-secondary">
				Loading…
			</div>
		);
	} else if (templates.isError) {
		content = (
			<EmptyState
				grayscale
				title="Templates could not be loaded"
				description="The box did not return liquid template Libraries."
			/>
		);
	} else if (rows.length === 0) {
		content = search.q ? (
			<EmptyState
				grayscale
				title="No templates matched"
				description="Try a broader search."
			/>
		) : (
			<EmptyState
				grayscale
				title="No templates yet"
				description="Templates turn form responses into formatted documents, such as summaries and PDFs."
				action={
					<NewTemplateButton testId="templates-empty-state__new-template-button" />
				}
			/>
		);
	} else {
		content = (
			<DataTable<LiquidTemplateLibrary>
				data={rows}
				columns={templatesColumns({
					usage,
					onDelete: (id) => setIdsPendingDelete([id]),
				})}
				rowKey={(template, index) => template.id ?? `template-${index}`}
				selectable
				selectedIds={selected}
				onSelectionChange={setSelected}
				resizable
				tableId="templates-table"
				rowProps={(template) => ({
					"data-test-id": "templates-table__row",
					"data-template-id": template.id,
				})}
				onRowClick={(template) => {
					if (template.id) {
						window.location.assign(getLiquidTemplateEditorUrl(template.id));
					}
				}}
			/>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div
				className="flex flex-wrap items-end gap-3 border-b border-border-secondary bg-bg-primary px-4 py-4"
				data-test-id="templates-filters"
			>
				<FilterField
					label="Search"
					className="w-full sm:w-auto sm:min-w-64 sm:flex-1"
					testId="templates-filters__search-field"
				>
					<SearchInput
						placeholder="Template name or id"
						testId="templates-filters__search-input"
						value={search.q ?? ""}
						onChange={(q) => update({ q: q || undefined, page: undefined })}
					/>
				</FilterField>
				<div className="ml-auto shrink-0">
					<NewTemplateButton testId="templates-page__new-template-button" />
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-auto">{content}</div>
			{total > 0 ? (
				<DataTableFooter
					total={total}
					currentPage={page}
					pageSize={pageSize}
					selectedCount={selected.size}
					bulkActions={bulkActions}
					summary={`${total} ${total === 1 ? "template" : "templates"}`}
					onPageChange={(next) => update({ page: next > 1 ? next : undefined })}
					onPageSizeChange={(size) =>
						update({
							pageSize: size === DEFAULT_PAGE_SIZE ? undefined : size,
							page: undefined,
						})
					}
				/>
			) : null}
			<DeleteTemplatesDialog
				count={idsPendingDelete.length}
				forms={formsPendingDelete}
				isDeleting={deleteTemplates.isPending}
				open={idsPendingDelete.length > 0}
				onConfirm={() => void confirmDelete()}
				onOpenChange={(open) => {
					if (!open && !deleteTemplates.isPending) setIdsPendingDelete([]);
				}}
			/>
		</div>
	);
}
