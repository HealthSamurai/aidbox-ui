import type { ResponseFilterOption } from "../formbox/api/forms";
import { FILTER_ALL } from "../formbox/pages/responses/constants";
import { DateRangeFilter } from "../formbox/pages/responses/date-range-filter";
import {
	FilterField,
	FilterSelect,
	type OptionalFilter,
	OptionalFilters,
	SearchInput,
} from "../shared/grid-filters";

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
	completionDate?: string;
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
	const filters: OptionalFilter[] = [
		{
			key: "plan-definition",
			label: "Package",
			isSet: Boolean(values.planDefinition),
			reset: () => onChange({ planDefinition: undefined }),
			control: (
				<FilterSelect
					label="Package"
					value={values.planDefinition}
					options={planDefinitionOptions}
					onChange={(planDefinition) => onChange({ planDefinition })}
					testId="responses-filters__plan-definition-dropdown"
				/>
			),
		},
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
					testId="responses-filters__status-dropdown"
				/>
			),
		},
		{
			key: "completion-date",
			label: "Completion Date",
			// A custom range spells out both ends, so the field grows to fit it.
			className: "w-auto min-w-[12rem]",
			isSet: Boolean(values.completionDate),
			reset: () => onChange({ completionDate: undefined }),
			control: (
				<DateRangeFilter
					label="Completion Date"
					testId="responses-filters__completion-date"
					value={values.completionDate ?? FILTER_ALL}
					onChange={(completionDate) =>
						onChange({
							completionDate:
								completionDate === FILTER_ALL ? undefined : completionDate,
						})
					}
				/>
			),
		},
		{
			key: "subject",
			label: "Subject",
			isSet: Boolean(values.subject),
			reset: () => onChange({ subject: undefined }),
			control: (
				<FilterSelect
					label="Subject"
					value={values.subject}
					options={subjectOptions}
					onChange={(subject) => onChange({ subject })}
					testId="responses-filters__subject-dropdown"
				/>
			),
		},
	];
	return (
		<div
			className="flex flex-wrap items-end gap-3 border-b border-border-secondary bg-bg-primary px-4 py-4"
			data-test-id="responses-filters"
		>
			<FilterField
				label="Search"
				className="w-full sm:w-auto sm:min-w-64 sm:flex-1"
				testId="responses-filters__search-field"
			>
				<SearchInput
					placeholder="Response ID, Subject or Form"
					testId="responses-filters__search-input"
					value={values.q ?? ""}
					onChange={(q) => onChange({ q: q || undefined })}
				/>
			</FilterField>
			<OptionalFilters filters={filters} testIdPrefix="responses-filters" />
		</div>
	);
}
