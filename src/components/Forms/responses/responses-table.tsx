import type {
	ColumnDef,
	RowProps,
} from "@aidbox-ui/components/data-table/index";
import { DataTable } from "@aidbox-ui/components/data-table/index";
import type {
	PlanDefinition,
	QuestionnaireResponse,
	RequestGroup,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import * as HSComp from "@health-samurai/react-components";
import {
	Braces,
	ChevronDown,
	ChevronRight,
	CircleStop,
	Ellipsis,
	FileText,
	Info,
	Trash2,
} from "lucide-react";
import type * as React from "react";
import { getFormLabel } from "../api/forms-list";
import { formatHumanizedDate } from "../format";
import {
	formatInstant,
	getCanonicalReferenceVersion,
	getQuestionnaireResponseCompletionDate,
	getQuestionnaireResponseJsonUrl,
	getQuestionnaireResponseSubjectLabel,
	getRequestGroupRendererUrl,
	getResponseRendererUrl,
	normalizeCanonicalReference,
} from "../utils";
import type { ResponseGroup, SdcWorkflow } from "./api";
import {
	canCancelResponseSending,
	getDeliveryDate,
	getDeliveryStatus,
} from "./delivery";
import { ResponseCompletionStatusTag } from "./response-completion-status-tag";
import { ResponseDeliveryStatusTag } from "./response-delivery-status-tag";
import type { QuestionnaireCatalog } from "./response-labels";

/**
 * A row of the grid: a response on its own, a package sent to a patient (a
 * RequestGroup), a response inside an expanded package, or the note of an
 * expanded package that has no responses yet.
 */
export type ResponsesGridRow =
	| { type: "response"; response: QuestionnaireResponse; group?: ResponseGroup }
	| { type: "group"; group: ResponseGroup }
	| { type: "empty"; key: string };

/**
 * The rows as Formbox lists them: newest first, a package where its newest
 * response would be (or by its own date while it has none), its responses
 * under it when expanded.
 */
export function buildResponsesGridRows({
	responses,
	groups,
	expanded,
}: {
	responses: QuestionnaireResponse[];
	groups: ResponseGroup[];
	expanded: Set<string>;
}): ResponsesGridRow[] {
	const groupByResponse = new Map(
		groups.flatMap((group) =>
			group.responses.map((response) => [response.id, group] as const),
		),
	);
	const emptyGroups = new Map(
		groups
			.filter((group) => !group.responses.length)
			.map((group) => [group.requestGroup.id, group] as const),
	);
	const items: (QuestionnaireResponse | RequestGroup)[] = [
		...responses,
		...[...emptyGroups.values()].map((group) => group.requestGroup),
	].sort(
		(left, right) =>
			(right.meta?.lastUpdated ?? "").localeCompare(
				left.meta?.lastUpdated ?? "",
			) ||
			`${left.resourceType}/${left.id}`.localeCompare(
				`${right.resourceType}/${right.id}`,
			),
	);
	const shown = new Set<string>();
	return items.flatMap((resource): ResponsesGridRow[] => {
		const group =
			resource.resourceType === "RequestGroup"
				? emptyGroups.get(resource.id)
				: groupByResponse.get(resource.id);
		const groupId = group?.requestGroup.id;
		if (!group || !groupId) {
			return resource.resourceType === "QuestionnaireResponse"
				? [{ type: "response", response: resource }]
				: [];
		}
		if (shown.has(groupId)) return [];
		shown.add(groupId);
		const row: ResponsesGridRow = { type: "group", group };
		if (!expanded.has(groupId)) return [row];
		if (!group.responses.length) {
			return [row, { type: "empty", key: `${groupKey(groupId)}:empty` }];
		}
		return [
			row,
			...group.responses.map(
				(response): ResponsesGridRow => ({ type: "response", response, group }),
			),
		];
	});
}

export function groupKey(requestGroupId: string) {
	return `RequestGroup/${requestGroupId}`;
}

export function gridRowKey(row: ResponsesGridRow, index: number) {
	switch (row.type) {
		case "response":
			return row.response.id ?? `response-${index}`;
		case "group":
			return groupKey(row.group.requestGroup.id ?? `${index}`);
		case "empty":
			return row.key;
	}
}

function groupResponseIds(group: ResponseGroup) {
	return group.responses.flatMap((response) =>
		response.id ? [response.id] : [],
	);
}

/** What a row says about itself, whatever its kind. */
export type RowView = {
	label: string;
	version: string;
	rendererUrl?: string;
	deliveryStatus?: string | null;
	deliveryDate?: string | null;
	completionStatus?: QuestionnaireResponse["status"];
	completedAt?: string;
	subject?: string;
	workflow?: SdcWorkflow;
	isSendingCanceled: boolean;
	canCancelSending: boolean;
};

export type ResponsesTableContext = {
	planDefinitions: PlanDefinition[];
	questionnaireCatalog: QuestionnaireCatalog;
	workflowsByResponseId: Record<string, SdcWorkflow>;
	workflowsByRequestGroupId: Record<string, SdcWorkflow>;
	/** Responses and RequestGroups cancelled here, until the workflow says so. */
	canceledIds: Set<string>;
};

function packageTitle(group: ResponseGroup, planDefinitions: PlanDefinition[]) {
	const reference = group.requestGroup.instantiatesCanonical?.[0] ?? "";
	const planDefinition = planDefinitions.find(
		(planDefinition) =>
			(planDefinition.url || `PlanDefinition/${planDefinition.id}`) ===
			reference.split("|")[0],
	);
	return planDefinition ? getFormLabel(planDefinition) : reference || "Package";
}

function groupView(
	group: ResponseGroup,
	context: ResponsesTableContext,
): RowView {
	const id = group.requestGroup.id ?? "";
	const reference = group.requestGroup.instantiatesCanonical?.[0] ?? "";
	const workflow = context.workflowsByRequestGroupId[id];
	const isSendingCanceled = context.canceledIds.has(id);
	const status = group.requestGroup.status;
	return {
		label: packageTitle(group, context.planDefinitions),
		version: getCanonicalReferenceVersion(reference) ?? "",
		rendererUrl: id ? getRequestGroupRendererUrl(id) : undefined,
		deliveryStatus: isSendingCanceled
			? "canceled"
			: getDeliveryStatus(workflow),
		deliveryDate: getDeliveryDate(workflow),
		completionStatus:
			status === "completed"
				? "completed"
				: status === "revoked"
					? "stopped"
					: "in-progress",
		subject:
			group.requestGroup.subject?.display ||
			group.requestGroup.subject?.reference,
		workflow,
		isSendingCanceled,
		canCancelSending: canCancelResponseSending({ isSendingCanceled, workflow }),
	};
}

function responseView(
	response: QuestionnaireResponse,
	group: ResponseGroup | undefined,
	context: ResponsesTableContext,
): RowView {
	const reference = normalizeCanonicalReference(response.questionnaire);
	const questionnaire = reference
		? context.questionnaireCatalog[reference]
		: undefined;
	const actionId = response.id
		? group?.actionIdsByResponseId[response.id]
		: undefined;
	const actionTitle = actionId
		? group?.requestGroup.action
				?.find((action) => action.id === actionId)
				?.title?.trim()
		: undefined;
	const workflow = response.id
		? context.workflowsByResponseId[response.id]
		: undefined;
	const isSendingCanceled = response.id
		? context.canceledIds.has(response.id)
		: false;
	return {
		label:
			actionTitle ||
			questionnaire?.title ||
			questionnaire?.name ||
			reference ||
			response.id ||
			"Questionnaire response",
		version:
			questionnaire?.version ??
			getCanonicalReferenceVersion(response.questionnaire) ??
			"",
		// A response of a package opens in the package, at its own form.
		rendererUrl: group?.requestGroup.id
			? getRequestGroupRendererUrl(group.requestGroup.id, actionId)
			: response.id
				? getResponseRendererUrl(response.id)
				: undefined,
		deliveryStatus: isSendingCanceled
			? "canceled"
			: getDeliveryStatus(workflow),
		deliveryDate: getDeliveryDate(workflow),
		completionStatus: response.status,
		completedAt: getQuestionnaireResponseCompletionDate(response),
		subject: getQuestionnaireResponseSubjectLabel(response),
		workflow,
		isSendingCanceled,
		canCancelSending: Boolean(
			response.id && canCancelResponseSending({ isSendingCanceled, workflow }),
		),
	};
}

export function rowView(
	row: ResponsesGridRow,
	context: ResponsesTableContext,
): RowView | undefined {
	if (row.type === "group") return groupView(row.group, context);
	if (row.type === "response") {
		return responseView(row.response, row.group, context);
	}
	return undefined;
}

export type ResponsesSelection = {
	selected: Set<string>;
	onChange: (selected: Set<string>) => void;
};

/** What the row menus ask the page to do. */
export type ResponsesTableActions = {
	exportPdf: (responses: QuestionnaireResponse[]) => void;
	canExportPdf: (response: QuestionnaireResponse) => boolean;
	isExportingPdf: boolean;
	cancelSending: (responseIds: string[]) => void;
	cancelGroupSending: (requestGroupId: string) => void;
	delete: (responseIds: string[]) => void;
	showDeliveryDetails: (view: RowView) => void;
};

/** The ids a row's checkbox selects: the response, or a package's responses. */
function rowResponseIds(row: ResponsesGridRow): string[] {
	if (row.type === "response") return row.response.id ? [row.response.id] : [];
	if (row.type === "group") return groupResponseIds(row.group);
	return [];
}

function checkedState(ids: string[], selected: Set<string>) {
	const count = ids.filter((id) => selected.has(id)).length;
	if (ids.length > 0 && count === ids.length) return true;
	return count > 0 ? "indeterminate" : false;
}

function toggleIds(selected: Set<string>, ids: string[], checked: boolean) {
	const next = new Set(selected);
	for (const id of ids) {
		if (checked) next.add(id);
		else next.delete(id);
	}
	return next;
}

function SelectAllCheckbox({
	ids,
	selection,
}: {
	ids: string[];
	selection: ResponsesSelection;
}) {
	const state = checkedState(ids, selection.selected);
	return (
		<HSComp.Checkbox
			size="small"
			className="border-border-primary"
			aria-label="Select all responses on page"
			data-test-id="responses-table__select-all-checkbox"
			disabled={ids.length === 0}
			checked={state}
			onCheckedChange={() =>
				selection.onChange(toggleIds(selection.selected, ids, state !== true))
			}
		/>
	);
}

function SelectCell({
	row,
	label,
	selection,
}: {
	row: ResponsesGridRow;
	label: string;
	selection: ResponsesSelection;
}) {
	if (row.type === "empty") return null;
	const ids = rowResponseIds(row);
	return (
		<HSComp.Checkbox
			size="small"
			className="border-border-primary"
			aria-label={
				row.type === "group"
					? `Select responses in ${label}`
					: `Select ${label}`
			}
			data-test-id="responses-table__select-checkbox"
			disabled={ids.length === 0}
			checked={checkedState(ids, selection.selected)}
			onCheckedChange={(checked) =>
				selection.onChange(toggleIds(selection.selected, ids, checked === true))
			}
		/>
	);
}

function NameCell({ row, view }: { row: ResponsesGridRow; view: RowView }) {
	const nested = row.type === "response" && row.group;
	return (
		<div className={HSComp.cn("min-w-0", nested && "pl-4")}>
			{view.rendererUrl ? (
				<a
					href={view.rendererUrl}
					title={view.label}
					data-test-id="responses-table__form-link"
					className="block truncate text-text-link hover:underline"
				>
					{view.label}
				</a>
			) : (
				<span
					className="block truncate"
					title={view.label}
					data-test-id="responses-table__form-text"
				>
					{view.label}
				</span>
			)}
		</div>
	);
}

function ActionsCell({
	row,
	view,
	actions,
}: {
	row: ResponsesGridRow;
	view: RowView;
	actions: ResponsesTableActions;
}) {
	const response = row.type === "response" ? row.response : undefined;
	const responseId = response?.id;
	const jsonUrl = responseId
		? getQuestionnaireResponseJsonUrl(responseId)
		: undefined;
	const canExportPdf = response ? actions.canExportPdf(response) : false;
	return (
		<HSComp.DropdownMenu>
			<HSComp.DropdownMenuTrigger asChild>
				<HSComp.IconButton
					variant="ghost"
					aria-label={`Open actions for ${view.label}`}
					data-test-id="responses-table__row-menu-button"
					icon={<Ellipsis className="size-4" />}
				/>
			</HSComp.DropdownMenuTrigger>
			{/* The menu is portalled, but React still bubbles its clicks to
				    the row, which would open the response. */}
			<HSComp.DropdownMenuContent
				align="end"
				data-test-id="responses-table__row-menu"
				onClick={(event) => event.stopPropagation()}
			>
				{response ? (
					<>
						<HSComp.DropdownMenuItem
							className="justify-start text-text-secondary"
							data-test-id="responses-table__row-menu-json-button"
							disabled={!jsonUrl}
							onClick={() =>
								jsonUrl
									? window.open(jsonUrl, "_blank", "noopener,noreferrer")
									: undefined
							}
						>
							<Braces className="size-4" />
							JSON
						</HSComp.DropdownMenuItem>
						<HSComp.DropdownMenuItem
							className="justify-start text-text-secondary"
							data-test-id="responses-table__row-menu-pdf-button"
							disabled={!canExportPdf || actions.isExportingPdf}
							onClick={() => {
								if (canExportPdf && !actions.isExportingPdf) {
									actions.exportPdf([response]);
								}
							}}
						>
							<FileText className="size-4" />
							PDF
						</HSComp.DropdownMenuItem>
					</>
				) : null}
				<HSComp.DropdownMenuItem
					className="justify-start text-text-secondary"
					data-test-id="responses-table__row-menu-delivery-details-button"
					onClick={() => actions.showDeliveryDetails(view)}
				>
					<Info className="size-4" />
					Delivery Details
				</HSComp.DropdownMenuItem>
				<HSComp.DropdownMenuItem
					className="justify-start text-text-secondary"
					data-test-id="responses-table__row-menu-cancel-sending-button"
					disabled={!view.canCancelSending}
					onClick={() => {
						if (!view.canCancelSending) return;
						if (row.type === "group" && row.group.requestGroup.id) {
							actions.cancelGroupSending(row.group.requestGroup.id);
						} else if (responseId) {
							actions.cancelSending([responseId]);
						}
					}}
				>
					<CircleStop className="size-4" />
					Cancel Sending
				</HSComp.DropdownMenuItem>
				{response ? (
					<HSComp.DropdownMenuItem
						variant="destructive"
						className="justify-start"
						data-test-id="responses-table__row-menu-delete-button"
						disabled={!responseId}
						onClick={() => {
							if (responseId) actions.delete([responseId]);
						}}
					>
						<Trash2 className="size-4" />
						Delete
					</HSComp.DropdownMenuItem>
				) : null}
			</HSComp.DropdownMenuContent>
		</HSComp.DropdownMenu>
	);
}

function responsesColumns({
	rows,
	context,
	expanded,
	selection,
	actions,
	onToggle,
}: {
	rows: ResponsesGridRow[];
	context: ResponsesTableContext;
	expanded: Set<string>;
	selection: ResponsesSelection;
	actions: ResponsesTableActions;
	onToggle: (requestGroupId: string) => void;
}): ColumnDef<ResponsesGridRow>[] {
	// Every row is drawn once per column; work its view out once.
	const views = new Map<ResponsesGridRow, RowView | undefined>();
	const view = (row: ResponsesGridRow) => {
		if (!views.has(row)) views.set(row, rowView(row, context));
		return views.get(row);
	};
	const pageIds = [...new Set(rows.flatMap(rowResponseIds))];
	const text = (value: string | undefined, title = value) => (
		<span className="block truncate" title={title}>
			{value}
		</span>
	);
	return [
		{
			id: "select",
			header: <SelectAllCheckbox ids={pageIds} selection={selection} />,
			fixedSize: 40,
			headerClassName: "px-2",
			className: "px-2",
			cell: (row) => (
				<SelectCell
					row={row}
					label={view(row)?.label ?? ""}
					selection={selection}
				/>
			),
		},
		{
			id: "expand",
			header: <span className="sr-only">Expand</span>,
			fixedSize: 32,
			headerClassName: "px-0",
			className: "px-0",
			cell: (row) => {
				if (row.type !== "group" || !row.group.requestGroup.id) return null;
				const id = row.group.requestGroup.id;
				const isExpanded = expanded.has(id);
				return (
					<HSComp.IconButton
						aria-expanded={isExpanded}
						aria-label={`${isExpanded ? "Collapse" : "Expand"} ${view(row)?.label}`}
						data-test-id="responses-table__request-group-expand-button"
						onClick={() => onToggle(id)}
						icon={
							isExpanded ? (
								<ChevronDown className="size-4" />
							) : (
								<ChevronRight className="size-4" />
							)
						}
					/>
				);
			},
		},
		{
			id: "form",
			header: "Form",
			grow: true,
			minSize: 160,
			cell: (row) => {
				const rowViewValue = view(row);
				return rowViewValue ? <NameCell row={row} view={rowViewValue} /> : null;
			},
		},
		{
			id: "version",
			header: "Version",
			minSize: 64,
			headerClassName: "text-center",
			className: "text-center",
			cell: (row) => text(view(row)?.version),
		},
		{
			id: "delivery-status",
			header: "Delivery",
			minSize: 64,
			cell: (row) => {
				const rowViewValue = view(row);
				return rowViewValue ? (
					<ResponseDeliveryStatusTag status={rowViewValue.deliveryStatus} />
				) : null;
			},
		},
		{
			id: "delivery-date",
			header: "Delivery Date",
			minSize: 64,
			cell: (row) => {
				const date = view(row)?.deliveryDate;
				return date ? text(formatInstant(date), date) : null;
			},
		},
		{
			id: "completion-status",
			header: "Completion Status",
			minSize: 64,
			cell: (row) => {
				const rowViewValue = view(row);
				return rowViewValue ? (
					<ResponseCompletionStatusTag status={rowViewValue.completionStatus} />
				) : null;
			},
		},
		{
			id: "completion-date",
			header: "Completion Date",
			minSize: 64,
			cell: (row) => {
				const date = view(row)?.completedAt;
				return date ? text(formatHumanizedDate(date), date) : null;
			},
		},
		{
			id: "subject",
			header: "Subject",
			minSize: 64,
			cell: (row) => text(view(row)?.subject),
		},
		{
			id: "actions",
			header: "Actions",
			fixedSize: 72,
			className: "px-2",
			cell: (row) => {
				const rowViewValue = view(row);
				return rowViewValue ? (
					<ActionsCell row={row} view={rowViewValue} actions={actions} />
				) : null;
			},
		},
	];
}

function gridRowProps(row: ResponsesGridRow): RowProps {
	switch (row.type) {
		case "response":
			return {
				"data-test-id": "responses-table__row",
				"data-response-id": row.response.id,
			};
		case "group":
			return {
				"data-test-id": "responses-table__request-group-row",
				"data-request-group-id": row.group.requestGroup.id,
			};
		case "empty":
			return {
				className: "bg-bg-secondary",
				"data-test-id": "responses-table__request-group-empty-row",
			};
	}
}

function gridFullWidthRow(row: ResponsesGridRow): React.ReactNode {
	if (row.type !== "empty") return undefined;
	// Lines up with the nested responses' names: past the select and expand
	// columns, plus their indent.
	return (
		<div
			className="py-2.5 pl-[88px] text-text-secondary"
			data-test-id="responses-table__request-group-empty-text"
		>
			No responses yet.
		</div>
	);
}

/** Rows drawn as selected: picked responses, and packages with all of theirs. */
function selectedRowKeys(rows: ResponsesGridRow[], selected: Set<string>) {
	const keys = new Set<string>();
	rows.forEach((row, index) => {
		const ids = rowResponseIds(row);
		if (ids.length > 0 && ids.every((id) => selected.has(id))) {
			keys.add(gridRowKey(row, index));
		}
	});
	return keys;
}

export function ResponsesTable({
	rows,
	context,
	expanded,
	selection,
	actions,
	onToggle,
}: {
	rows: ResponsesGridRow[];
	context: ResponsesTableContext;
	expanded: Set<string>;
	selection: ResponsesSelection;
	actions: ResponsesTableActions;
	onToggle: (requestGroupId: string) => void;
}) {
	return (
		<DataTable<ResponsesGridRow>
			data={rows}
			columns={responsesColumns({
				rows,
				context,
				expanded,
				selection,
				actions,
				onToggle,
			})}
			rowKey={gridRowKey}
			selectedIds={selectedRowKeys(rows, selection.selected)}
			resizable
			tableId="responses-table"
			rowProps={gridRowProps}
			fullWidthRow={gridFullWidthRow}
			onRowClick={(row) => {
				// A package unfolds, as on the Forms tab; a response opens in the
				// renderer.
				if (row.type === "group") {
					if (row.group.requestGroup.id) onToggle(row.group.requestGroup.id);
					return;
				}
				if (row.type !== "response") return;
				const url = rowView(row, context)?.rendererUrl;
				if (url) window.location.assign(url);
			}}
		/>
	);
}
