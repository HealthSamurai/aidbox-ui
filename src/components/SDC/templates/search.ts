import { DEFAULT_PAGE_SIZE } from "../forms/search";

export { DEFAULT_PAGE_SIZE };

/** The Templates grid's state in the URL, as in Formbox; defaults are left out. */
export type TemplatesSearch = {
	page?: number;
	pageSize?: number;
	q?: string;
};

export function validateTemplatesSearch(
	search: Record<string, unknown>,
): TemplatesSearch {
	const next: TemplatesSearch = {};
	if (typeof search.q === "string" && search.q.length > 0) next.q = search.q;
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
