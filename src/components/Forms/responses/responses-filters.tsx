import { DatePickerInput } from "@health-samurai/react-components";
import { FilterSelect, SearchInput } from "../grid-filters";
import type { ResponseFilterOption } from "./api";

/*
 * No Delivery Date filter, as in Formbox: the delivery date comes from the
 * sending workflow, and `GET /sdc/$workflow` has no date criteria to search
 * by. Filtering in the browser would only narrow the page on screen and leave
 * the total and the pagination wrong.
 */

export type ResponsesFilterValues = {
	q?: string;
	planDefinition?: string;
	status?: string;
	completedFrom?: string;
	completedTo?: string;
	subject?: string;
};

export function ResponsesFilters({
	values,
	planDefinitionOptions,
	statusOptions,
	subjectOptions,
	onChange,
}: {
	values: ResponsesFilterValues;
	planDefinitionOptions: ResponseFilterOption[];
	statusOptions: string[];
	subjectOptions: ResponseFilterOption[];
	onChange: (next: Partial<ResponsesFilterValues>) => void;
}) {
	return (
		<div
			className="flex flex-wrap items-center gap-3 border-b border-border-secondary bg-bg-primary px-4 py-3"
			data-test-id="responses-filters"
		>
			<div
				className="w-full sm:w-auto sm:min-w-64 sm:flex-1"
				data-test-id="responses-filters__search-field"
			>
				<SearchInput
					placeholder="Response ID, Subject or Form"
					testId="responses-filters__search-input"
					value={values.q ?? ""}
					onChange={(q) => onChange({ q: q || undefined })}
				/>
			</div>
			<FilterSelect
				label="Package"
				className="w-44"
				value={values.planDefinition}
				options={planDefinitionOptions}
				onChange={(planDefinition) => onChange({ planDefinition })}
				testId="responses-filters__plan-definition-dropdown"
			/>
			<FilterSelect
				label="Status"
				className="w-36"
				value={values.status}
				options={statusOptions.map((status) => ({
					value: status,
					label: status,
				}))}
				onChange={(status) => onChange({ status })}
				testId="responses-filters__status-dropdown"
			/>
			<FilterSelect
				label="Subject"
				className="w-44"
				value={values.subject}
				options={subjectOptions}
				onChange={(subject) => onChange({ subject })}
				testId="responses-filters__subject-dropdown"
			/>
			<div
				className="flex items-center"
				data-test-id="responses-filters__completion-date"
			>
				<DatePickerInput
					placeholder="Completed from"
					value={values.completedFrom ?? ""}
					onChange={(value) => onChange({ completedFrom: value || undefined })}
					className="w-44"
				/>
				<span className="px-1 text-text-secondary text-xs">—</span>
				<DatePickerInput
					placeholder="To"
					value={values.completedTo ?? ""}
					onChange={(value) => onChange({ completedTo: value || undefined })}
					className="w-44"
				/>
			</div>
		</div>
	);
}
