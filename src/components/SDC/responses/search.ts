import { DEFAULT_PAGE_SIZE } from "../forms/search";

export { DEFAULT_PAGE_SIZE };

/**
 * The Responses grid's state in the URL, as in Formbox; defaults are left out.
 * `completionDate` is a preset (`today`, `last7`, …) or a `from..to` range.
 */
export type ResponsesSearch = {
	completionDate?: string;
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
	if (nonEmptyString(search.completionDate)) {
		next.completionDate = search.completionDate;
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
