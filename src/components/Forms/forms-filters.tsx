import type * as React from "react";
import { FORM_KIND_OPTIONS, type FormKind, isFormKind } from "./api/forms-list";
import {
	FilterField,
	FilterSelect,
	type OptionalFilter,
	OptionalFilters,
	SearchInput,
} from "./grid-filters";

export type FormsFilterValues = {
	q?: string;
	status?: string;
	author?: string;
	kind?: FormKind;
};

export function FormsFilters({
	values,
	statusOptions,
	authorOptions,
	onChange,
	actions,
}: {
	values: FormsFilterValues;
	statusOptions: string[];
	authorOptions: string[];
	onChange: (next: Partial<FormsFilterValues>) => void;
	/** Controls at the right end of the bar. */
	actions?: React.ReactNode;
}) {
	const filters: OptionalFilter[] = [
		{
			key: "status",
			label: "Status",
			isSet: Boolean(values.status),
			reset: () => onChange({ status: undefined }),
			control: (
				<FilterSelect
					label="Status"
					value={values.status}
					options={statusOptions.map((status) => ({
						value: status,
						label: status,
					}))}
					onChange={(status) => onChange({ status })}
					testId="forms-filters__status-dropdown"
				/>
			),
		},
		{
			key: "author",
			label: "Author",
			isSet: Boolean(values.author),
			reset: () => onChange({ author: undefined }),
			control: (
				<FilterSelect
					label="Author"
					value={values.author}
					options={authorOptions.map((author) => ({
						value: author,
						label: author,
					}))}
					onChange={(author) => onChange({ author })}
					testId="forms-filters__author-dropdown"
				/>
			),
		},
		{
			key: "kind",
			label: "Type",
			isSet: Boolean(values.kind),
			reset: () => onChange({ kind: undefined }),
			control: (
				<FilterSelect
					label="Type"
					value={values.kind}
					options={FORM_KIND_OPTIONS}
					onChange={(kind) =>
						onChange({ kind: kind && isFormKind(kind) ? kind : undefined })
					}
					testId="forms-filters__kind-dropdown"
				/>
			),
		},
	];
	return (
		<div
			className="flex flex-wrap items-end gap-3 border-b border-border-secondary bg-bg-primary px-4 py-4"
			data-test-id="forms-filters"
		>
			<FilterField
				label="Search"
				className="w-full sm:w-auto sm:min-w-64 sm:flex-1"
				testId="forms-filters__search-field"
			>
				<SearchInput
					placeholder="Form name or URL"
					testId="forms-filters__search-input"
					value={values.q ?? ""}
					onChange={(q) => onChange({ q: q || undefined })}
				/>
			</FilterField>
			<OptionalFilters filters={filters} testIdPrefix="forms-filters" />
			{actions ? <div className="ml-auto shrink-0">{actions}</div> : null}
		</div>
	);
}
