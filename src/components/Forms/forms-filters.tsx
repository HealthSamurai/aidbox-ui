import type * as React from "react";
import {
	FORM_KIND_OPTIONS,
	FORM_STATUS_OPTIONS,
	type FormKind,
	isFormKind,
} from "./api/forms-list";
import { FilterSelect, SearchInput } from "./grid-filters";

export type FormsFilterValues = {
	q?: string;
	status?: string;
	kind?: FormKind;
};

export function FormsFilters({
	values,
	onChange,
	actions,
}: {
	values: FormsFilterValues;
	onChange: (next: Partial<FormsFilterValues>) => void;
	/** Controls at the right end of the bar. */
	actions?: React.ReactNode;
}) {
	return (
		<div
			className="flex flex-wrap items-center gap-3 border-b border-border-secondary bg-bg-primary px-4 py-3"
			data-test-id="forms-filters"
		>
			<div
				className="w-full sm:w-auto sm:min-w-64 sm:flex-1"
				data-test-id="forms-filters__search-field"
			>
				<SearchInput
					placeholder="Form name or URL"
					testId="forms-filters__search-input"
					value={values.q ?? ""}
					onChange={(q) => onChange({ q: q || undefined })}
				/>
			</div>
			<FilterSelect
				label="Status"
				className="w-36"
				value={values.status}
				options={FORM_STATUS_OPTIONS}
				onChange={(status) => onChange({ status })}
				testId="forms-filters__status-dropdown"
			/>
			<FilterSelect
				label="Type"
				className="w-36"
				value={values.kind}
				options={FORM_KIND_OPTIONS}
				onChange={(kind) =>
					onChange({ kind: kind && isFormKind(kind) ? kind : undefined })
				}
				testId="forms-filters__kind-dropdown"
			/>
			{actions ? <div className="ml-auto shrink-0">{actions}</div> : null}
		</div>
	);
}
