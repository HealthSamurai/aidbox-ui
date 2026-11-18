import {
	ResourceRequestError,
	readResourceError,
} from "@aidbox-ui/components/Forms/api/resource-error";
import type { OperationOutcome } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import type { OperationOutcome as BoxOutcome } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { getAidboxBaseURL } from "@aidbox-ui/utils";
import {
	ErrorResponse,
	type ResourceResponse,
	type Result,
} from "@health-samurai/aidbox-client";

/** An Aidbox URL for an absolute path, kept under the base URL's path prefix. */
export function getAidboxURL(path: string): URL {
	return new URL(`${getAidboxBaseURL()}${path}`);
}

/**
 * Turns a rejected `AidboxClient` request into a `ResourceRequestError` that
 * carries the server's OperationOutcome:
 * `client.rawRequest(params).catch(rejectWith("Failed to ..."))`.
 *
 * Callers still take an `AbortSignal` where React Query or an editor hands
 * them one, but `AidboxClient` has no way to pass it on to `fetch` yet, so a
 * cancelled request runs to completion. Forward the signal once the client's
 * `RequestParams` grows a `signal` option.
 */
export function rejectWith(failureMessage: string) {
	return async (error: unknown): Promise<never> => {
		if (error instanceof ErrorResponse)
			throw await readResourceError(
				error.responseWithMeta.response,
				failureMessage,
			);
		throw error;
	};
}

/**
 * The resource of a `client.request`. An OperationOutcome, or any other failed
 * answer, rejects with a `ResourceRequestError`.
 */
export async function resourceOf<T>(
	request: Promise<Result<ResourceResponse<T>, ResourceResponse<BoxOutcome>>>,
	failureMessage: string,
): Promise<T> {
	const result = await request.catch(rejectWith(failureMessage));
	if (result.isErr())
		throw new ResourceRequestError(
			// The box answers in R5; the issues read here are the same in R4.
			result.value.resource as OperationOutcome,
			result.value.response.status,
		);
	return result.value.resource;
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
