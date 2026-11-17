import { DatePickerInput } from "@health-samurai/react-components";
import type { ResponseFilterOption } from "../api/forms";
import {
	FilterField,
	FilterSelect,
	type OptionalFilter,
	OptionalFilters,
	SearchInput,
} from "../grid-filters";

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
			className: "w-auto",
			isSet: Boolean(values.completedFrom || values.completedTo),
			reset: () =>
				onChange({ completedFrom: undefined, completedTo: undefined }),
			control: (
				<div
					className="flex items-center"
					data-test-id="responses-filters__completion-date"
				>
					<DatePickerInput
						value={values.completedFrom ?? ""}
						onChange={(value) =>
							onChange({ completedFrom: value || undefined })
						}
						className="w-36"
					/>
					<span className="px-1 text-text-secondary text-xs">—</span>
					<DatePickerInput
						value={values.completedTo ?? ""}
						onChange={(value) => onChange({ completedTo: value || undefined })}
						className="w-36"
					/>
				</div>
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
