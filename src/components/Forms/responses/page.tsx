import { ConfirmDialog } from "@aidbox-ui/components/confirm-dialog";
import {
	type BulkAction,
	DataTableFooter,
} from "@aidbox-ui/components/data-table/index";
import { EmptyState } from "@aidbox-ui/components/empty-state";
import type { QuestionnaireResponse } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import * as HSComp from "@health-samurai/react-components";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Braces, CircleStop, FileText, Trash2 } from "lucide-react";
import * as React from "react";
import { getFormLabel } from "../api/forms-list";
import { usePlanDefinitions } from "../api/plan-definitions";
import { notifyResponseActionUnavailable } from "./actions";
import {
	type QuestionnaireResponseFilters,
	useCancelResponseSending,
	useDeleteQuestionnaireResponses,
	useGroupedResponses,
	useQuestionnaireResponseFilterOptions,
	useQuestionnairesByReference,
	useResponseWorkflows,
} from "./api";
import { canCancelResponseSending } from "./delivery";
import { pageAfterDeleting } from "./pagination";
import { ResponseDeliveryDetailsDialog } from "./response-delivery-details-dialog";
import { getResponsePdfTarget, getResponsePdfTargets } from "./response-labels";
import {
	ResponsesFilters,
	type ResponsesFilterValues,
} from "./responses-filters";
import {
	buildResponsesGridRows,
	ResponsesTable,
	type ResponsesTableActions,
	type RowView,
} from "./responses-table";
import {
	DEFAULT_PAGE_SIZE,
	type ResponsesSearch,
	resolveCompletionRange,
} from "./search";
import { useResponsePdfExport } from "./use-response-pdf-export";

function useResponsesSearch() {
	const search = useSearch({ from: "/forms/responses" });
	const navigate = useNavigate({ from: "/forms/responses" });
	const update = (next: Partial<ResponsesSearch>) =>
		navigate({
			search: (previous) => ({ ...previous, ...next }),
			replace: true,
		});
	return { search, update };
}

/**
 * State that belongs to the rows on screen: it is dropped when the filters or
 * the page change, as Formbox does, so it never outlives the rows it is about.
 */
function useScopedState<T>(scope: string, initial: () => T) {
	const [state, setState] = React.useState(initial);
	const [stateScope, setStateScope] = React.useState(scope);
	if (stateScope !== scope) {
		setStateScope(scope);
		setState(initial());
	}
	return [state, setState] as const;
}

export function ResponsesPage() {
	const { search, update } = useResponsesSearch();
	const page = search.page ?? 1;
	const pageSize = search.pageSize ?? DEFAULT_PAGE_SIZE;

	const { data: planDefinitions = [] } = usePlanDefinitions();
	const planDefinitionOptions = [
		...new Map(
			planDefinitions.map((planDefinition) => {
				const value =
					planDefinition.url || `PlanDefinition/${planDefinition.id}`;
				return [value, { value, label: getFormLabel(planDefinition) }];
			}),
		).values(),
	];
	const { data: filterOptions } = useQuestionnaireResponseFilterOptions();
	const { data: questionnaireCatalog = {} } = useQuestionnairesByReference();

	const completionRange = resolveCompletionRange(search);
	const filters: QuestionnaireResponseFilters = {
		planDefinition: search.planDefinition,
		completedFrom: completionRange.from,
		completedTo: completionRange.to,
		q: search.q,
		status: search.status,
		subject: search.subject,
	};
	const responses = useGroupedResponses(filters, page, pageSize);
	const questionnaireResponses = responses.data?.questionnaireResponses ?? [];
	const groups = responses.data?.groups ?? [];
	const total = responses.data?.total ?? 0;
	const { data: workflowsByResponseId = {} } = useResponseWorkflows(
		questionnaireResponses.flatMap((response) =>
			response.id ? [response.id] : [],
		),
	);
	const { data: workflowsByRequestGroupId = {} } = useResponseWorkflows(
		groups.flatMap((group) =>
			group.requestGroup.id ? [group.requestGroup.id] : [],
		),
		"RequestGroup",
	);
	const cancelResponseSending = useCancelResponseSending();
	const cancelGroupSending = useCancelResponseSending("RequestGroup");
	const deleteResponses = useDeleteQuestionnaireResponses();

	const resultsScope = `${JSON.stringify(filters)}|${page}|${pageSize}`;
	// Cancelled here, shown as "canceled" until the workflow itself says so.
	const [canceledIds, setCanceledIds] = useScopedState(
		resultsScope,
		() => new Set<string>(),
	);
	const [selected, setSelected] = useScopedState(
		resultsScope,
		() => new Set<string>(),
	);
	const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
	// One dialog serves the row menu and the footer: it keeps the ids it was
	// opened with, so the selection changing behind it does not matter.
	const [idsPendingDelete, setIdsPendingDelete] = React.useState<string[]>([]);
	const [deliveryDetails, setDeliveryDetails] = React.useState<RowView>();

	const { exportResponses, isExporting } =
		useResponsePdfExport(questionnaireCatalog);
	const exportPdf = (picked: QuestionnaireResponse[]) => {
		const { targets, skippedCount } = getResponsePdfTargets(
			picked,
			questionnaireCatalog,
			groups,
			planDefinitions,
		);
		void exportResponses(targets, skippedCount);
	};

	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	// A page past the end (deleted responses, an old link) moves to the last one.
	const pastEnd = total > 0 && page > totalPages;
	React.useEffect(() => {
		if (pastEnd) update({ page: totalPages > 1 ? totalPages : undefined });
	});

	const cancelSending = async (ids: string[]) => {
		if (ids.length === 0) return;
		const { canceled, error, failed } =
			await cancelResponseSending.mutateAsync(ids);
		if (canceled.length > 0) {
			setCanceledIds((previous) => new Set([...previous, ...canceled]));
			HSComp.toast.success(
				canceled.length === 1
					? "Sending cancelled"
					: `Sending cancelled for ${canceled.length} responses`,
			);
		}
		if (failed.length > 0) {
			HSComp.toast.error(
				ids.length === 1 && error
					? error.message
					: `Failed to cancel sending for ${failed.length} of ${ids.length} responses`,
			);
		}
	};

	const cancelPackageSending = async (requestGroupId: string) => {
		const { canceled, error } = await cancelGroupSending.mutateAsync([
			requestGroupId,
		]);
		if (canceled.length > 0) {
			setCanceledIds((previous) => new Set([...previous, requestGroupId]));
			HSComp.toast.success("Sending cancelled");
		} else {
			HSComp.toast.error(error?.message ?? "Failed to cancel sending");
		}
	};

	const confirmDelete = async () => {
		const ids = idsPendingDelete;
		if (ids.length > 0) {
			try {
				await deleteResponses.mutateAsync(ids);
			} catch (error) {
				HSComp.toast.error(
					error instanceof Error ? error.message : "Failed to delete responses",
				);
				return;
			}
			HSComp.toast.success(
				ids.length === 1
					? "Response deleted"
					: `${ids.length} responses deleted`,
			);
			// Emptying the last page would show "no responses" while there are some.
			const nextPage = pageAfterDeleting({
				currentPage: page,
				deletedCount: ids.length,
				pageSize,
				total,
			});
			if (nextPage !== page) {
				update({ page: nextPage > 1 ? nextPage : undefined });
			}
		}
		setSelected((previous) => {
			const next = new Set(previous);
			for (const id of ids) next.delete(id);
			return next;
		});
		setIdsPendingDelete([]);
	};

	const isStillSending = (id: string) =>
		canCancelResponseSending({
			isSendingCanceled: canceledIds.has(id),
			workflow: workflowsByResponseId[id],
		});
	const stoppableIds = [...selected].filter(isStillSending);

	const actions: ResponsesTableActions = {
		exportPdf,
		canExportPdf: (response) =>
			Boolean(getResponsePdfTarget(response, questionnaireCatalog)),
		isExportingPdf: isExporting,
		cancelSending: (ids) => void cancelSending(ids),
		cancelGroupSending: (id) => void cancelPackageSending(id),
		delete: setIdsPendingDelete,
		showDeliveryDetails: setDeliveryDetails,
	};

	const bulkActions: BulkAction[] = [
		{
			id: "json",
			label: "JSON",
			icon: <Braces className="size-4" />,
			onClick: () => notifyResponseActionUnavailable("JSON export"),
		},
		{
			id: "pdf",
			label: "PDF",
			icon: <FileText className="size-4" />,
			disabled: isExporting,
			onClick: () =>
				exportPdf(
					questionnaireResponses.filter(
						(response) => response.id && selected.has(response.id),
					),
				),
		},
		{
			id: "stop-sending",
			// Only a delivery still in progress can be stopped.
			label:
				stoppableIds.length > 0 && stoppableIds.length !== selected.size
					? `Stop sending (${stoppableIds.length})`
					: "Stop sending",
			icon: <CircleStop className="size-4" />,
			disabled: stoppableIds.length === 0,
			onClick: () => {
				void cancelSending(stoppableIds);
				setSelected(new Set());
			},
		},
		{
			id: "delete",
			label: "Delete",
			icon: <Trash2 className="size-4" />,
			variant: "danger",
			onClick: () => setIdsPendingDelete([...selected]),
		},
	];

	const rows = buildResponsesGridRows({
		responses: questionnaireResponses,
		groups,
		expanded,
	});
	const filterValues: ResponsesFilterValues = {
		q: search.q,
		planDefinition: search.planDefinition,
		status: search.status,
		completedFrom: search.completedFrom,
		completedTo: search.completedTo,
		subject: search.subject,
	};
	const hasFilters = Object.values(filterValues).some(Boolean);

	let content: React.ReactNode;
	if (responses.isLoading) {
		content = (
			<div className="flex h-full items-center justify-center text-text-secondary">
				Loading…
			</div>
		);
	} else if (responses.isError) {
		content = (
			<EmptyState
				grayscale
				title="Responses could not be loaded"
				description="The box did not return QuestionnaireResponse resources."
			/>
		);
	} else if (rows.length === 0) {
		content = hasFilters ? (
			<EmptyState
				grayscale
				title="No responses matched"
				description="Try a broader search or clear one of the filters."
			/>
		) : (
			<EmptyState grayscale title="No responses yet" />
		);
	} else {
		content = (
			<ResponsesTable
				rows={rows}
				context={{
					planDefinitions,
					questionnaireCatalog,
					workflowsByResponseId,
					workflowsByRequestGroupId,
					canceledIds,
				}}
				expanded={expanded}
				selection={{ selected, onChange: setSelected }}
				actions={actions}
				onToggle={(id) =>
					setExpanded((previous) => {
						const next = new Set(previous);
						if (next.has(id)) next.delete(id);
						else next.add(id);
						return next;
					})
				}
			/>
		);
	}

	// Unopened packages count as results of their own, so the total says so.
	const unit = responses.data?.unopenedTotal ? "result" : "response";

	return (
		<div className="flex h-full min-h-0 flex-col">
			<ResponsesFilters
				values={filterValues}
				planDefinitionOptions={planDefinitionOptions}
				statusOptions={filterOptions?.statusOptions ?? []}
				subjectOptions={filterOptions?.subjectOptions ?? []}
				onChange={(next) => update({ ...next, page: undefined })}
			/>
			<div className="min-h-0 flex-1 overflow-auto">{content}</div>
			{total > 0 ? (
				<DataTableFooter
					total={total}
					currentPage={page}
					pageSize={pageSize}
					selectedCount={selected.size}
					bulkActions={bulkActions}
					summary={`${total} ${total === 1 ? unit : `${unit}s`}`}
					onPageChange={(next) => update({ page: next > 1 ? next : undefined })}
					onPageSizeChange={(size) =>
						update({
							pageSize: size === DEFAULT_PAGE_SIZE ? undefined : size,
							page: undefined,
						})
					}
				/>
			) : null}
			<ConfirmDialog
				open={idsPendingDelete.length > 0}
				onOpenChange={(open) => {
					if (!open) setIdsPendingDelete([]);
				}}
				title={
					idsPendingDelete.length === 1
						? "Delete Response"
						: `Delete ${idsPendingDelete.length} Responses`
				}
				description={deleteResponsesDescription(
					idsPendingDelete.length,
					idsPendingDelete.filter(isStillSending).length,
				)}
				confirmLabel="Delete"
				danger
				onConfirm={() => void confirmDelete()}
			/>
			{deliveryDetails ? (
				<ResponseDeliveryDetailsDialog
					open
					onOpenChange={(open) => {
						if (!open) setDeliveryDetails(undefined);
					}}
					formLabel={deliveryDetails.label}
					subject={deliveryDetails.subject}
					completedAt={deliveryDetails.completedAt}
					workflow={deliveryDetails.workflow}
					isSendingCanceled={deliveryDetails.isSendingCanceled}
				/>
			) : null}
		</div>
	);
}

function deleteResponsesDescription(count: number, sendingCount: number) {
	const single = count === 1;
	return (
		<span className="flex flex-col gap-4">
			<span>
				{single
					? "Are you sure you want to delete this response? The answers it holds will be lost."
					: `Are you sure you want to delete ${count} responses? The answers they hold will be lost.`}
			</span>
			{sendingCount > 0 ? (
				<span>
					{sendingCount === count && single
						? "This form is still being sent. Stop sending first, or the patient may still receive a link to a form that no longer exists."
						: `${sendingCount} of them ${sendingCount === 1 ? "is" : "are"} still being sent. Stop sending first, or the patients may still receive links to forms that no longer exist.`}
				</span>
			) : null}
		</span>
	);
}
