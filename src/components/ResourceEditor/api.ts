import { parseOperationOutcome } from "@aidbox-ui/api/utils";
import type { Bundle, Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { isOperationOutcome } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { AidboxClientR5 } from "../../AidboxClient";

export const fetchResource = async (
	client: AidboxClientR5,
	resourceType: string,
	id: string,
): Promise<Resource> => {
	const { responseBody } = await client.request<Resource>({
		method: "GET",
		url: `/fhir/${resourceType}/${id}`,
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
	});

	if (isOperationOutcome(responseBody))
		throw new Error(
			parseOperationOutcome(responseBody)
				.map(({ expression, diagnostics }) => `${expression}: ${diagnostics}`)
				.join("; "),
			{ cause: responseBody },
		);

	return responseBody;
};

export const fetchResourceHistory = async (
	client: AidboxClientR5,
	resourceType: string,
	id: string,
): Promise<Bundle> => {
	const { responseBody } = await client.request<Bundle>({
		method: "GET",
		url: `/fhir/${resourceType}/${id}/_history`,
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		params: [
			["_page", "1"],
			["_count", "100"],
		],
	});

	if (isOperationOutcome(responseBody))
		throw new Error(
			parseOperationOutcome(responseBody)
				.map(({ expression, diagnostics }) => `${expression}: ${diagnostics}`)
				.join("; "),
			{ cause: responseBody },
		);

	return responseBody;
};

export const createResource = async (
	client: AidboxClientR5,
	resourceType: string,
	resource: Resource,
) => {
	const res = (
		await client.request<Resource>({
			method: "POST",
			url: `/fhir/${resourceType}`,
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify(resource),
		})
	).responseBody;

	if (isOperationOutcome(res))
		throw new Error(
			parseOperationOutcome(res)
				.map(({ expression, diagnostics }) => `${expression}: ${diagnostics}`)
				.join("; "),
			{ cause: res },
		);

	return res;
};

export const updateResource = async (
	client: AidboxClientR5,
	resourceType: string,
	id: string,
	resource: Resource,
) => {
	const res = (
		await client.request<Resource>({
			method: "PUT",
			url: `/fhir/${resourceType}/${id}`,
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify(resource),
		})
	).responseBody;

	if (isOperationOutcome(res))
		throw new Error(
			parseOperationOutcome(res)
				.map(({ expression, diagnostics }) => `${expression}: ${diagnostics}`)
				.join("; "),
			{ cause: res },
		);

	return res;
};

export const deleteResource = async (
	client: AidboxClientR5,
	resourceType: string,
	id: string,
) => {
	const res = (
		await client.request<Resource>({
			method: "DELETE",
			url: `/fhir/${resourceType}/${id}`,
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
		})
	).responseBody;

	if (isOperationOutcome(res))
		throw new Error(
			parseOperationOutcome(res)
				.map(({ expression, diagnostics }) => `${expression}: ${diagnostics}`)
				.join("; "),
			{ cause: res },
		);

	return res;
};
