import { useNavigate, useSearch } from "@tanstack/react-router";
import * as React from "react";
import { DataTableFooter } from "../../data-table";
import { EmptyState } from "../../empty-state";
import {
	type Form,
	type FormFilters,
	getFormKey,
	getFormKind,
	getFormPinId,
	useFormFilterOptions,
	useForms,
	usePinnedFormIds,
	usePinnedForms,
	useQuestionnaireCatalog,
} from "./api";
import { useFormActions } from "./form-actions";
import { FormsFilters, type FormsFilterValues } from "./forms-filters";
import { buildFormsGridRows, FormsTable, formBuilderHref } from "./forms-table";
import { FormsToolbar } from "./forms-toolbar";
import { DEFAULT_PAGE_SIZE, type FormsSearch } from "./search";

function useFormsSearch() {
	const search = useSearch({ from: "/forms/" });
	const navigate = useNavigate({ from: "/forms/" });
	const update = (next: Partial<FormsSearch>) =>
		navigate({
			search: (previous) => ({ ...previous, ...next }),
			replace: true,
		});
	return { search, update };
}

/** Packages unfolded in the grid, by key. */
function useExpandedPackages() {
	const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
	const toggle = (form: Form) =>
		setExpanded((previous) => {
			const next = new Set(previous);
			const key = getFormKey(form);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	return { expanded, toggle };
}

function GridMessage({ title, description }: FormsMessage) {
	return <EmptyState grayscale title={title} description={description} />;
}

type FormsMessage = { title: string; description?: string };

export function FormsPage() {
	const { search, update } = useFormsSearch();
	const page = search.page ?? 1;
	const pageSize = search.pageSize ?? DEFAULT_PAGE_SIZE;
	const updatedSort = search.updatedSort ?? "desc";
	const filters: FormFilters = {
		author: search.author,
		kind: search.kind,
		q: search.q,
		status: search.status,
		updatedSort,
	};

	const { pinnedIds, togglePin, removePin } = usePinnedFormIds();
	// Selected forms by key, kept across pages: they make a new package.
	const [selected, setSelected] = React.useState<Map<string, Form>>(
		() => new Map(),
	);
	const { actions, dialogs } = useFormActions({
		onDeleted: ({ pinId, key }) => {
			removePin(pinId);
			setSelected((previous) => {
				if (!previous.has(key)) return previous;
				const next = new Map(previous);
				next.delete(key);
				return next;
			});
		},
	});
	const pinned = usePinnedForms(pinnedIds);
	const forms = useForms(filters, page, pageSize, pinnedIds);
	const filterOptions = useFormFilterOptions();
	const { expanded, toggle } = useExpandedPackages();
	const catalog = useQuestionnaireCatalog(expanded.size > 0);

	// Pinned forms stay above the page whatever is searched, as in Formbox; only
	// the type filter, which says what kind of thing is listed, applies to them.
	const pinnedForms = (pinnedIds.length > 0 ? (pinned.data ?? []) : []).filter(
		(form) => !search.kind || getFormKind(form) === search.kind,
	);
	const pageForms = forms.data?.forms ?? [];
	const total = forms.data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	// A page past the end (deleted forms, a narrower filter in an old link)
	// moves to the last one there is.
	const pastEnd = total > 0 && page > totalPages;
	React.useEffect(() => {
		if (pastEnd) update({ page: totalPages > 1 ? totalPages : undefined });
	});

	const rows = buildFormsGridRows({
		pinnedForms,
		forms: pageForms,
		expanded,
		packageForms: catalog.isError
			? { status: "error", retry: () => void catalog.refetch() }
			: catalog.data
				? { status: "ready", questionnaires: catalog.data }
				: { status: "loading" },
	});

	const setFilters = (next: Partial<FormsFilterValues>) =>
		update({ ...next, page: undefined });
	const hasFilters = Boolean(
		search.q || search.status || search.author || search.kind,
	);
	let message: FormsMessage | undefined;
	if (forms.isError) {
		message = {
			title: "Forms could not be loaded",
			description:
				"The box did not return Questionnaire or PlanDefinition resources.",
		};
	} else if (!forms.isLoading && rows.length === 0) {
		message = hasFilters
			? {
					title: "No forms matched",
					description: "Try a broader search or clear one of the filters.",
				}
			: { title: "No forms yet" };
	}

	const open = (form: Form) => {
		if (form.resourceType === "PlanDefinition") {
			toggle(form);
			return;
		}
		const href = formBuilderHref(form);
		if (href) window.location.assign(href);
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			{dialogs}
			<FormsFilters
				values={{
					q: search.q,
					status: search.status,
					author: search.author,
					kind: search.kind,
				}}
				statusOptions={filterOptions.statusOptions}
				authorOptions={filterOptions.authorOptions}
				onChange={setFilters}
				actions={
					<FormsToolbar
						selectedForms={[...selected.values()]}
						onClearSelection={() => setSelected(new Map())}
						onImport={actions.importForm}
					/>
				}
			/>
			<div className="min-h-0 flex-1 overflow-auto">
				{forms.isLoading ? (
					<div className="flex h-full items-center justify-center text-text-secondary">
						Loading…
					</div>
				) : message ? (
					<GridMessage {...message} />
				) : (
					<FormsTable
						rows={rows}
						expanded={expanded}
						selection={{ selected, onChange: setSelected }}
						actions={actions}
						updatedSort={updatedSort}
						onToggle={toggle}
						onTogglePin={(form) => togglePin(getFormPinId(form))}
						onToggleUpdatedSort={() =>
							update({
								updatedSort: updatedSort === "asc" ? undefined : "asc",
								page: undefined,
							})
						}
						onOpen={open}
					/>
				)}
			</div>
			{total > 0 ? (
				<DataTableFooter
					total={total}
					currentPage={page}
					pageSize={pageSize}
					selectedCount={selected.size}
					summary={
						selected.size > 0
							? `${selected.size} selected`
							: `${total} ${total === 1 ? "form" : "forms"}`
					}
					onPageChange={(next) => update({ page: next > 1 ? next : undefined })}
					onPageSizeChange={(size) =>
						update({
							pageSize: size === DEFAULT_PAGE_SIZE ? undefined : size,
							page: undefined,
						})
					}
				/>
			) : null}
		</div>
	);
}
