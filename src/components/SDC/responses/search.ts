import { DEFAULT_PAGE_SIZE } from "../forms/search";

export { DEFAULT_PAGE_SIZE };

/**
 * The Responses grid's state in the URL, as in Formbox; defaults are left out.
 * `completedFrom` and `completedTo` are days as the date picker writes them,
 * `dd.mm.yyyy`.
 */
export type ResponsesSearch = {
	completedFrom?: string;
	completedTo?: string;
	page?: number;
	pageSize?: number;
	planDefinition?: string;
	q?: string;
	status?: string;
	subject?: string;
};

const nonEmptyString = (value: unknown): value is string =>
	typeof value === "string" && value.length > 0;

export function validateResponsesSearch(
	search: Record<string, unknown>,
): ResponsesSearch {
	const next: ResponsesSearch = {};
	if (nonEmptyString(search.completedFrom)) {
		next.completedFrom = search.completedFrom;
	}
	if (nonEmptyString(search.completedTo)) {
		next.completedTo = search.completedTo;
	}
	if (nonEmptyString(search.planDefinition)) {
		next.planDefinition = search.planDefinition;
	}
	if (nonEmptyString(search.q)) next.q = search.q;
	if (nonEmptyString(search.status)) next.status = search.status;
	if (nonEmptyString(search.subject)) next.subject = search.subject;
	if (typeof search.page === "number" && search.page > 1) {
		next.page = Math.floor(search.page);
	}
	if (
		typeof search.pageSize === "number" &&
		search.pageSize > 0 &&
		search.pageSize !== DEFAULT_PAGE_SIZE
	) {
		next.pageSize = Math.floor(search.pageSize);
	}
	return next;
}

/** A `dd.mm.yyyy` day from the date picker, `undefined` until it is a whole valid date. */
function parsePickerDay(value?: string): Date | undefined {
	const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value ?? "");
	if (!match) return undefined;
	const [day, month, year] = [match[1], match[2], match[3]].map(Number) as [
		number,
		number,
		number,
	];
	const date = new Date(year, month - 1, day);
	return date.getMonth() === month - 1 ? date : undefined;
}

/**
 * The instants to search completion by: the start of the first day and the end
 * of the last one in the browser's timezone, as UTC. Resolved before the query
 * so its key holds the instants actually searched.
 */
export function resolveCompletionRange(search: ResponsesSearch) {
	const from = parsePickerDay(search.completedFrom);
	const to = parsePickerDay(search.completedTo);
	from?.setHours(0, 0, 0, 0);
	to?.setHours(23, 59, 59, 999);
	return { from: from?.toISOString(), to: to?.toISOString() };
}
