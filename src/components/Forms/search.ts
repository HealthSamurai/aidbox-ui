import { type FormKind, isFormKind } from "./api/forms-list";

export const DEFAULT_PAGE_SIZE = 30;

/** The Forms grid's state in the URL; defaults are left out of it. */
export type FormsSearch = {
	kind?: FormKind;
	page?: number;
	pageSize?: number;
	q?: string;
	status?: string;
	updatedSort?: "asc";
};

const nonEmptyString = (value: unknown): value is string =>
	typeof value === "string" && value.length > 0;

export function validateFormsSearch(
	search: Record<string, unknown>,
): FormsSearch {
	const next: FormsSearch = {};
	if (nonEmptyString(search.kind) && isFormKind(search.kind)) {
		next.kind = search.kind;
	}
	if (nonEmptyString(search.q)) next.q = search.q;
	if (nonEmptyString(search.status)) next.status = search.status;
	if (search.updatedSort === "asc") next.updatedSort = "asc";
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
