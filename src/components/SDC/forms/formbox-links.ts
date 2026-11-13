import { getAidboxBaseURL } from "../../../utils";

/**
 * Pages of the Formbox app (`/u/sdc`) that are not in Aidbox UI yet: the
 * form library. They open there until they move over.
 */
function formboxUrl(path: string, search?: Record<string, unknown>) {
	const url = new URL(`u/sdc${path}`, `${getAidboxBaseURL()}/`);
	// Formbox's router reads search params as JSON, as TanStack Router does.
	for (const [key, value] of Object.entries(search ?? {})) {
		url.searchParams.set(key, JSON.stringify(value));
	}
	return url.toString();
}

export function formLibraryUrl() {
	return formboxUrl("/library");
}
