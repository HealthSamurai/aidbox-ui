import * as HSComp from "@health-samurai/react-components";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	Braces,
	ChevronDown,
	ChevronRight,
	Copy,
	Ellipsis,
	Eye,
	Pencil,
	Share2,
	Trash2,
} from "lucide-react";
import type * as React from "react";
import type { ColumnDef, RowProps, SortState } from "../../data-table";
import { DataTable } from "../../data-table";
import { SendFormIcon } from "../formbox/pages/questionnaires/form-dialog-fields";
import { FormShareMenuItems } from "../formbox/pages/questionnaires/form-share-menu-items";
import { classicUiLink } from "../shared/classic-ui-tab";
import { formatHumanizedDate } from "../shared/format";
import {
	type Form,
	type FormPlanDefinition,
	type FormQuestionnaire,
	findActionQuestionnaire,
	getFormKey,
	getFormKindLabel,
	getFormLabel,
	getFormOrganizationId,
	getFormShareMode,
	type UpdatedSort,
} from "./api";
import { type FormActions, toFormboxForm } from "./form-actions";

/**
 * A row of the grid: a form or package of the page, a form inside an expanded
 * package, or a full-width line of an expanded package — a note (loading, an
 * error, "no forms yet") or the gap that frames its forms.
 */
export type FormsGridRow =
	| { type: "form"; form: Form; pinned: boolean; lastPinned: boolean }
	| { type: "member"; form: FormQuestionnaire; key: string; edge: CardEdge }
	| { type: "note"; key: string; content: React.ReactNode; edge: CardEdge }
	| { type: "gap"; key: string; size: "top" | "bottom" };

/** Where a row sits in the card that frames an expanded package's forms. */
type CardEdge = { first: boolean; last: boolean };

type PackageForms =
	| { status: "loading" }
	| { status: "error"; retry: () => void }
	| { status: "ready"; questionnaires: FormQuestionnaire[] };

function packageRows(
	form: FormPlanDefinition,
	packageForms: PackageForms,
): FormsGridRow[] {
	const key = getFormKey(form);
	const edge = { first: false, last: false };
	const note = (suffix: string, content: React.ReactNode): FormsGridRow => ({
		type: "note",
		key: `${key}:${suffix}`,
		content,
		edge,
	});
	let rows: FormsGridRow[];
	if (packageForms.status === "loading") {
		rows = [note("loading", "Loading forms…")];
	} else if (packageForms.status === "error") {
		rows = [
			note(
				"error",
				<span className="flex items-center gap-2">
					Could not load this package’s forms.
					<HSComp.Button
						variant="ghost"
						size="small"
						onClick={packageForms.retry}
					>
						Retry
					</HSComp.Button>
				</span>,
			),
		];
	} else if (!form.action?.length) {
		rows = [note("empty", "This package has no forms yet.")];
	} else {
		rows = form.action.map((action, index) => {
			const questionnaire = findActionQuestionnaire(
				action,
				packageForms.questionnaires,
			);
			return questionnaire
				? {
						type: "member",
						form: questionnaire,
						key: `${key}:${action.id ?? index}`,
						edge,
					}
				: note(
						`missing-${action.id ?? index}`,
						<span className="text-text-secondary">
							Form not found:{" "}
							{action.definitionCanonical || action.title || action.id}
						</span>,
					);
		});
	}
	const last = rows.length - 1;
	const framed = rows.map((row, index) =>
		row.type === "member" || row.type === "note"
			? { ...row, edge: { first: index === 0, last: index === last } }
			: row,
	);
	return [
		{ type: "gap", key: `${key}:gap-top`, size: "top" },
		...framed,
		{ type: "gap", key: `${key}:gap-bottom`, size: "bottom" },
	];
}

/** The grid's rows: pinned forms first, then the page, packages unfolded. */
export function buildFormsGridRows({
	pinnedForms,
	forms,
	expanded,
	packageForms,
}: {
	pinnedForms: Form[];
	forms: Form[];
	expanded: Set<string>;
	packageForms: PackageForms;
}): FormsGridRow[] {
	const entries = [
		...pinnedForms.map((form, index) => ({
			form,
			pinned: true,
			lastPinned: index === pinnedForms.length - 1,
		})),
		...forms.map((form) => ({ form, pinned: false, lastPinned: false })),
	];
	return entries.flatMap(({ form, pinned, lastPinned }) => {
		const row: FormsGridRow = { type: "form", form, pinned, lastPinned };
		if (form.resourceType !== "PlanDefinition") return [row];
		if (!expanded.has(getFormKey(form))) return [row];
		return [row, ...packageRows(form, packageForms)];
	});
}

export function gridRowKey(row: FormsGridRow) {
	return row.type === "form" ? getFormKey(row.form) : row.key;
}

function rowForm(row: FormsGridRow): Form | undefined {
	return row.type === "form" || row.type === "member" ? row.form : undefined;
}

function FormStatusTag({ status }: { status?: string }) {
	if (!status) return null;
	const color =
		status === "active"
			? "green"
			: status === "draft" || status === "retired"
				? "gray"
				: "contrast";
	return (
		<HSComp.Tag size="small" color={color} vibrance="subtle">
			{status}
		</HSComp.Tag>
	);
}

function ShareTag({ label, hint }: { label: string; hint: string }) {
	return (
		<HSComp.Tooltip>
			<HSComp.TooltipTrigger asChild>
				<HSComp.Tag size="small" color="gray" vibrance="subtle">
					{label}
				</HSComp.Tag>
			</HSComp.TooltipTrigger>
			<HSComp.TooltipContent side="top" className="max-w-xs">
				{hint}
			</HSComp.TooltipContent>
		</HSComp.Tooltip>
	);
}

/**
 * Where a form lives among organizations. Nothing on a box without
 * organization-based access control: only it writes these extensions.
 */
function FormShareTags({ form }: { form: Form }) {
	const organizationId = getFormOrganizationId(form);
	const shareMode = getFormShareMode(form);
	return (
		<span className="flex items-center gap-1">
			{organizationId ? (
				<ShareTag
					label="organization"
					hint={`This form belongs to organization ${organizationId}.`}
				/>
			) : null}
			{shareMode === "system-shared" ? (
				<ShareTag
					label="global"
					hint="This form is shared with every organization. It can only be modified from the root level."
				/>
			) : null}
			{shareMode === "shared" ? (
				<ShareTag
					label="shared"
					hint="This form is shared with the child organizations of its owner."
				/>
			) : null}
		</span>
	);
}

/** Where a click on a form goes: the Form Builder, or a package's resource. */
export function formBuilderHref(form: Form): string | undefined {
	if (form.resourceType !== "Questionnaire" || !form.id) return undefined;
	return classicUiLink("Questionnaire", form.id)?.href;
}

function NameCell({
	row,
	expanded,
	onToggle,
}: {
	row: FormsGridRow;
	expanded: boolean;
	onToggle: (form: Form) => void;
}) {
	if (row.type === "note") {
		return <span className="block truncate pl-4">{row.content}</span>;
	}
	const form = rowForm(row);
	if (!form) return null;
	const label = getFormLabel(form);
	if (form.resourceType === "PlanDefinition") {
		const count = form.action?.length ?? 0;
		return (
			<span className="flex min-w-0 items-baseline gap-2">
				<button
					type="button"
					className="truncate text-text-link hover:underline cursor-pointer"
					aria-expanded={expanded}
					onClick={() => onToggle(form)}
					data-test-id="forms-table__package-name"
				>
					{label}
				</button>
				<span className="shrink-0 text-text-secondary typo-body-xs">
					{count} {count === 1 ? "item" : "items"}
				</span>
			</span>
		);
	}
	const href = formBuilderHref(form);
	return (
		<span
			className={HSComp.cn("block min-w-0", row.type === "member" && "pl-4")}
		>
			{href ? (
				<a
					href={href}
					className="block truncate text-text-link hover:underline"
					title={label}
					data-test-id="forms-table__name-link"
				>
					{label}
				</a>
			) : (
				<span className="block truncate" title={label}>
					{label}
				</span>
			)}
		</span>
	);
}

function ExpandCell({
	row,
	expanded,
	onToggle,
}: {
	row: FormsGridRow;
	expanded: boolean;
	onToggle: (form: Form) => void;
}) {
	if (row.type !== "form" || row.form.resourceType !== "PlanDefinition") {
		return null;
	}
	const form = row.form;
	const label = getFormLabel(form);
	return (
		<HSComp.IconButton
			aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
			aria-expanded={expanded}
			onClick={() => onToggle(form)}
			data-test-id="forms-table__expand-button"
			icon={
				expanded ? (
					<ChevronDown className="size-4" />
				) : (
					<ChevronRight className="size-4" />
				)
			}
		/>
	);
}

function PinCell({
	row,
	onTogglePin,
}: {
	row: FormsGridRow;
	onTogglePin: (form: Form) => void;
}) {
	if (row.type !== "form" || !row.form.id) return null;
	const form = row.form;
	const label = getFormLabel(form);
	return (
		<HSComp.IconButton
			className={HSComp.cn(
				"transition-opacity group-hover/form:opacity-50 focus-visible:opacity-100",
				row.pinned ? "opacity-50" : "opacity-0",
			)}
			aria-label={row.pinned ? `Unpin ${label}` : `Pin ${label}`}
			aria-pressed={row.pinned}
			data-test-id="forms-table__pin-button"
			onClick={() => onTogglePin(form)}
			icon={<HSComp.PinIcon />}
		/>
	);
}

function ActionButton({
	label,
	tooltip,
	testId,
	icon,
	onClick,
	className,
}: {
	label: string;
	tooltip: string;
	testId: string;
	icon: React.ReactNode;
	onClick: () => void;
	className?: string;
}) {
	return (
		<HSComp.Tooltip>
			<HSComp.TooltipTrigger asChild>
				<HSComp.IconButton
					className={className}
					aria-label={label}
					data-test-id={testId}
					onClick={onClick}
					icon={icon}
				/>
			</HSComp.TooltipTrigger>
			<HSComp.TooltipContent side="bottom">{tooltip}</HSComp.TooltipContent>
		</HSComp.Tooltip>
	);
}

/**
 * Formbox's row actions. A form inside an expanded package is only previewed
 * there: it is shared, sent and managed on its own row.
 */
function ActionsCell({
	row,
	actions,
}: {
	row: FormsGridRow;
	actions: FormActions;
}) {
	const navigate = useNavigate();
	const form = rowForm(row);
	if (!form?.id) return null;
	const formId = form.id;
	const label = getFormLabel(form);
	const preview = (
		<ActionButton
			label={`Preview ${label}`}
			tooltip="Preview"
			testId="forms-table__preview-button"
			icon={<Eye className="size-4" />}
			onClick={() => actions.preview(form)}
		/>
	);
	if (row.type === "member") {
		return <div className="flex items-center gap-1">{preview}</div>;
	}
	return (
		<div className="flex items-center gap-1">
			{preview}
			<ActionButton
				label={`Share ${label}`}
				tooltip="Share"
				testId="forms-table__share-button"
				icon={<Share2 className="size-4" />}
				onClick={() => actions.share(form)}
			/>
			<ActionButton
				label={`Send ${label}`}
				tooltip="Send"
				testId="forms-table__send-button"
				className="[&>svg]:size-5"
				icon={<SendFormIcon className="size-5" />}
				onClick={() => actions.send(form)}
			/>
			<HSComp.DropdownMenu>
				<HSComp.DropdownMenuTrigger asChild>
					<HSComp.IconButton
						aria-label={`Open actions for ${label}`}
						data-test-id="forms-table__row-menu-button"
						icon={<Ellipsis className="size-4" />}
					/>
				</HSComp.DropdownMenuTrigger>
				{/* The menu is portalled, but React still bubbles its clicks to
				    the row, which would open the form. */}
				<HSComp.DropdownMenuContent
					align="end"
					data-test-id="forms-table__row-menu"
					onClick={(event) => event.stopPropagation()}
				>
					{form.resourceType === "PlanDefinition" ? (
						<HSComp.DropdownMenuItem
							className="justify-start"
							data-test-id="forms-table__row-menu-edit-package-button"
							onClick={() =>
								navigate({
									to: "/forms/packages/$packageId",
									params: { packageId: formId },
								})
							}
						>
							<Pencil className="size-4" />
							Edit package
						</HSComp.DropdownMenuItem>
					) : null}
					<HSComp.DropdownMenuItem
						className="justify-start"
						data-test-id="forms-table__row-menu-duplicate-button"
						onClick={() => actions.duplicate(form)}
					>
						<Copy className="size-4" />
						Duplicate
					</HSComp.DropdownMenuItem>
					<FormShareMenuItems form={toFormboxForm(form)} />
					<HSComp.DropdownMenuItem
						asChild
						className="justify-start"
						data-test-id="forms-table__resource-link"
					>
						<Link
							to="/resource/$resourceType/edit/$id"
							params={{ resourceType: form.resourceType, id: formId }}
							search={{ tab: "edit", mode: "json", builderTab: "form" }}
						>
							<Braces className="size-4" />
							Open resource
						</Link>
					</HSComp.DropdownMenuItem>
					<HSComp.DropdownMenuItem
						variant="destructive"
						className="justify-start"
						data-test-id="forms-table__row-menu-delete-button"
						onClick={() => actions.delete(form)}
					>
						<Trash2 className="size-4" />
						Delete
					</HSComp.DropdownMenuItem>
				</HSComp.DropdownMenuContent>
			</HSComp.DropdownMenu>
		</div>
	);
}

/** Only forms and packages of the page are picked, not the forms inside one. */
function selectableForms(rows: FormsGridRow[]): Form[] {
	return rows.flatMap((row) =>
		row.type === "form" && row.form.id ? [row.form] : [],
	);
}

export type FormsSelection = {
	selected: Map<string, Form>;
	onChange: (selected: Map<string, Form>) => void;
};

function SelectAllCheckbox({
	rows,
	selection,
}: {
	rows: FormsGridRow[];
	selection: FormsSelection;
}) {
	const forms = selectableForms(rows);
	const selectedCount = forms.filter((form) =>
		selection.selected.has(getFormKey(form)),
	).length;
	const all = forms.length > 0 && selectedCount === forms.length;
	return (
		<HSComp.Checkbox
			size="small"
			className="border-border-primary"
			aria-label="Select all forms on page"
			data-test-id="forms-table__select-all-checkbox"
			disabled={forms.length === 0}
			checked={all ? true : selectedCount > 0 ? "indeterminate" : false}
			onCheckedChange={() => {
				const next = new Map(selection.selected);
				for (const form of forms) {
					if (all) next.delete(getFormKey(form));
					else next.set(getFormKey(form), form);
				}
				selection.onChange(next);
			}}
		/>
	);
}

function SelectCell({
	row,
	selection,
}: {
	row: FormsGridRow;
	selection: FormsSelection;
}) {
	if (row.type !== "form" || !row.form.id) return null;
	const form = row.form;
	const key = getFormKey(form);
	return (
		<HSComp.Checkbox
			size="small"
			className="border-border-primary"
			aria-label={`Select ${getFormLabel(form)}`}
			data-test-id="forms-table__select-checkbox"
			checked={selection.selected.has(key)}
			onCheckedChange={(checked) => {
				const next = new Map(selection.selected);
				if (checked === true) next.set(key, form);
				else next.delete(key);
				selection.onChange(next);
			}}
		/>
	);
}

function formsColumns({
	rows,
	expanded,
	selection,
	actions,
	onToggle,
	onTogglePin,
}: {
	rows: FormsGridRow[];
	expanded: Set<string>;
	selection: FormsSelection;
	actions: FormActions;
	onToggle: (form: Form) => void;
	onTogglePin: (form: Form) => void;
}): ColumnDef<FormsGridRow>[] {
	const isExpanded = (row: FormsGridRow) =>
		row.type === "form" && expanded.has(getFormKey(row.form));
	return [
		{
			id: "select",
			header: <SelectAllCheckbox rows={rows} selection={selection} />,
			fixedSize: 40,
			headerClassName: "px-2",
			className: "px-2",
			cell: (row) => <SelectCell row={row} selection={selection} />,
		},
		{
			id: "pin",
			header: (
				<span className="flex justify-center opacity-50">
					<HSComp.PinIcon />
				</span>
			),
			fixedSize: 36,
			headerClassName: "px-1",
			className: "px-1 text-center",
			cell: (row) => <PinCell row={row} onTogglePin={onTogglePin} />,
		},
		{
			id: "expand",
			header: <span className="sr-only">Expand</span>,
			fixedSize: 36,
			headerClassName: "px-1",
			className: "px-1 text-center",
			cell: (row) => (
				<ExpandCell row={row} expanded={isExpanded(row)} onToggle={onToggle} />
			),
		},
		{
			id: "name",
			header: "Name",
			grow: true,
			minSize: 200,
			cell: (row) => (
				<NameCell row={row} expanded={isExpanded(row)} onToggle={onToggle} />
			),
		},
		{
			id: "version",
			header: "Version",
			minSize: 70,
			maxSize: 160,
			cell: (row) => rowForm(row)?.version ?? "",
		},
		{
			id: "status",
			header: "Status",
			minSize: 80,
			cell: (row) => <FormStatusTag status={rowForm(row)?.status} />,
		},
		{
			id: "sharing",
			header: "Sharing",
			minSize: 80,
			cell: (row) => {
				const form = rowForm(row);
				return form ? <FormShareTags form={form} /> : null;
			},
		},
		{
			id: "kind",
			header: "Type",
			minSize: 80,
			cell: (row) => {
				const form = rowForm(row);
				return form ? getFormKindLabel(form) : "";
			},
		},
		{
			id: "updated",
			header: "Updated",
			sortable: true,
			minSize: 100,
			cell: (row) => {
				const updated = rowForm(row)?.meta?.lastUpdated;
				return <span title={updated}>{formatHumanizedDate(updated)}</span>;
			},
		},
		{
			id: "author",
			header: "Author",
			minSize: 80,
			// A long publisher would otherwise eat the room the name needs.
			maxSize: 200,
			cell: (row) => {
				const form = rowForm(row);
				// Forms without a publisher show their machine name, as Formbox does.
				const author = form ? (form.publisher ?? form.name ?? "") : "";
				return (
					<span
						className="block truncate"
						title={author}
						data-test-id="forms-table__author-text"
					>
						{author}
					</span>
				);
			},
		},
		{
			id: "actions",
			header: "Actions",
			fixedSize: 160,
			className: "px-2",
			cell: (row) => <ActionsCell row={row} actions={actions} />,
		},
	];
}

function gridRowProps(expanded: Set<string>) {
	return (row: FormsGridRow): RowProps => {
		switch (row.type) {
			case "form":
				return {
					className: HSComp.cn(
						"group/form",
						row.lastPinned && "border-b-2 border-border-primary",
						expanded.has(getFormKey(row.form)) && "border-b-0 bg-bg-tertiary",
					),
					"data-test-id": "forms-table__row",
					"data-form-key": getFormKey(row.form),
					"data-pinned": row.pinned,
				};
			case "member":
				return {
					className: cardRowClassName(row.edge),
					"data-test-id": "forms-table__package-form-row",
					"data-form-key": getFormKey(row.form),
				};
			case "note":
				return {
					className: HSComp.cn(
						cardRowClassName(row.edge),
						"text-text-secondary",
					),
					"data-test-id": "forms-table__package-note-row",
				};
			case "gap":
				return {
					className: HSComp.cn(
						"h-auto border-b-0 bg-bg-tertiary [&>td]:p-0",
						row.size === "top" ? "[&>td]:h-1" : "[&>td]:h-3",
					),
				};
		}
	};
}

/**
 * The forms of an expanded package sit in a white card (6px radius, 1px
 * border) that starts at the name column, as in Formbox. The table collapses
 * its borders, and browsers drop border-radius on collapsed cells, so both ends
 * of the card are pseudo-elements; the middle cells draw their share of the
 * horizontal lines as inset shadows. Full literals: Tailwind only generates
 * classes it can read in the source.
 */
const CARD_BASE = [
	"border-b-0 bg-bg-tertiary hover:bg-bg-tertiary",
	// Left end: the name cell.
	"[&>td:nth-child(4)]:relative [&>td:nth-child(4)>*]:relative",
	"[&>td:nth-child(4)]:before:absolute [&>td:nth-child(4)]:before:inset-0",
	"[&>td:nth-child(4)]:before:border-l [&>td:nth-child(4)]:before:border-b",
	"[&>td:nth-child(4)]:before:border-border-secondary [&>td:nth-child(4)]:before:bg-bg-primary",
	// Right end: the actions cell, leaving a strip of the grey block outside.
	"[&>td:last-child]:relative [&>td:last-child>*]:relative",
	"[&>td:last-child]:before:absolute [&>td:last-child]:before:inset-y-0 [&>td:last-child]:before:left-0 [&>td:last-child]:before:right-4",
	"[&>td:last-child]:before:border-r [&>td:last-child]:before:border-b",
	"[&>td:last-child]:before:border-border-secondary [&>td:last-child]:before:bg-bg-primary",
	// Middle cells.
	"[&>td:nth-child(n+5):not(:last-child)]:bg-bg-primary",
].join(" ");

function cardRowClassName(edge: CardEdge) {
	return HSComp.cn(
		CARD_BASE,
		edge.first
			? "[&>td:nth-child(4)]:before:rounded-tl-[6px] [&>td:nth-child(4)]:before:border-t [&>td:last-child]:before:rounded-tr-[6px] [&>td:last-child]:before:border-t [&>td:nth-child(n+5):not(:last-child)]:shadow-[inset_0_1px_0_0_var(--color-border-secondary),inset_0_-1px_0_0_var(--color-border-secondary)]"
			: "[&>td:nth-child(n+5):not(:last-child)]:shadow-[inset_0_-1px_0_0_var(--color-border-secondary)]",
		edge.last &&
			"[&>td:nth-child(4)]:before:rounded-bl-[6px] [&>td:last-child]:before:rounded-br-[6px]",
	);
}

function gridFullWidthRow(row: FormsGridRow): React.ReactNode {
	if (row.type === "gap") return <div aria-hidden="true" />;
	return undefined;
}

export function FormsTable({
	rows,
	expanded,
	selection,
	actions,
	updatedSort,
	onToggle,
	onTogglePin,
	onToggleUpdatedSort,
	onOpen,
}: {
	rows: FormsGridRow[];
	expanded: Set<string>;
	selection: FormsSelection;
	actions: FormActions;
	updatedSort: UpdatedSort;
	onToggle: (form: Form) => void;
	onTogglePin: (form: Form) => void;
	onToggleUpdatedSort: () => void;
	/** A click on a row outside its links and buttons. */
	onOpen: (form: Form) => void;
}) {
	const sort: SortState = { column: "updated", direction: updatedSort };
	return (
		<DataTable<FormsGridRow>
			keepSelectionAcrossPages
			data={rows}
			columns={formsColumns({
				rows,
				expanded,
				selection,
				actions,
				onToggle,
				onTogglePin,
			})}
			rowKey={gridRowKey}
			resizable
			tableId="forms-table"
			zebra={false}
			sort={sort}
			onSortToggle={(column) => {
				if (column === "updated") onToggleUpdatedSort();
			}}
			rowProps={gridRowProps(expanded)}
			fullWidthRow={gridFullWidthRow}
			onRowClick={(row) => {
				const form = rowForm(row);
				if (form) onOpen(form);
			}}
		/>
	);
}
