import type { AidboxClientR5 } from "@aidbox-ui/AidboxClient";
import {
	ResourceRequestError,
	readResourceError,
} from "@aidbox-ui/components/Forms/api/resource-error";
import { getAidboxBaseURL } from "@aidbox-ui/utils";
import {
	ErrorResponse,
	type RequestParams,
} from "@health-samurai/aidbox-client";

/** An Aidbox URL for an absolute path, kept under the base URL's path prefix. */
export function getAidboxURL(path: string): URL {
	return new URL(`${getAidboxBaseURL()}${path}`);
}

/**
 * A request to the box through `AidboxClient` (the browser session, and a
 * login on 401), for the SDC endpoints that answer outside plain FHIR. Resolves
 * to the successful response; any other answer becomes a `ResourceRequestError`
 * carrying the server's OperationOutcome.
 *
 * Callers still take an `AbortSignal` where React Query or an editor hands
 * them one, but `AidboxClient` has no way to pass it on to `fetch` yet, so a
 * cancelled request runs to completion. Forward the signal here once the
 * client's `RequestParams` grows a `signal` option.
 */
export async function boxRequest(
	client: AidboxClientR5,
	params: RequestParams,
	failureMessage: string,
): Promise<Response> {
	try {
		return (await client.rawRequest(params)).response;
	} catch (error) {
		if (error instanceof ErrorResponse)
			throw await readResourceError(
				error.responseWithMeta.response,
				failureMessage,
			);
		throw error;
	}
}

/** `boxRequest` for an endpoint that answers with JSON. */
export async function boxJson<T>(
	client: AidboxClientR5,
	params: RequestParams,
	failureMessage: string,
): Promise<T> {
	const response = await boxRequest(client, params, failureMessage);
	return (await response.json()) as T;
}

/**
 * The result of a request the screen can do without, or `fallback` when the
 * box refuses it. A failure to reach the box at all still rejects.
 */
export async function withFallback<T>(
	request: Promise<T>,
	fallback: T,
): Promise<T> {
	try {
		return await request;
	} catch (error) {
		if (error instanceof ResourceRequestError) return fallback;
		throw error;
	}
}

/** The ResourceEditor page of a resource, as an absolute URL. */
export function getResourceEditorUrl(
	resourceType: string,
	resourceId: string,
	search?: string,
): string {
	return new URL(
		`u/resource/${encodeURIComponent(resourceType)}/edit/${encodeURIComponent(resourceId)}${search ?? ""}`,
		`${getAidboxBaseURL()}/`,
	).toString();
}
