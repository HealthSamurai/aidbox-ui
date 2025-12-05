import { parseOperationOutcome } from "@aidbox-ui/api/utils";
import type { Bundle, Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { AidboxClientR5 } from "../../AidboxClient";

export const fetchResource = async (
	client: AidboxClientR5,
	resourceType: string,
	id: string,
): Promise<Resource> => {
	const result = await client.request<Resource>({
		method: "GET",
		url: `/fhir/${resourceType}/${id}`,
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
	});

	if (result.isErr())
		throw new Error(
			parseOperationOutcome(result.value.resource)
				.map(({ expression, diagnostics }) => `${expression}: ${diagnostics}`)
				.join("; "),
			{ cause: result.value.resource },
		);

	return result.value.resource;
};

export const fetchResourceHistory = async (
	client: AidboxClientR5,
	resourceType: string,
	id: string,
): Promise<Bundle> => {
	const result = await client.request<Bundle>({
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

	if (result.isErr())
		throw new Error(
			parseOperationOutcome(result.value.resource)
				.map(({ expression, diagnostics }) => `${expression}: ${diagnostics}`)
				.join("; "),
			{ cause: result.value.resource },
		);

	return result.value.resource;
};

export const createResource = async (
	client: AidboxClientR5,
	resourceType: string,
	resource: Resource,
) => {
	const result = await client.request<Resource>({
		method: "POST",
		url: `/fhir/${resourceType}`,
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify(resource),
	});

	if (result.isErr())
		throw new Error(
			parseOperationOutcome(result.value.resource)
				.map(({ expression, diagnostics }) => `${expression}: ${diagnostics}`)
				.join("; "),
			{ cause: result.value.resource },
		);

	return result.value.resource;
};

export const updateResource = async (
	client: AidboxClientR5,
	resourceType: string,
	id: string,
	resource: Resource,
) => {
	const result = await client.request<Resource>({
		method: "PUT",
		url: `/fhir/${resourceType}/${id}`,
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify(resource),
	});

	if (result.isErr())
		throw new Error(
			parseOperationOutcome(result.value.resource)
				.map(({ expression, diagnostics }) => `${expression}: ${diagnostics}`)
				.join("; "),
			{ cause: result.value },
		);

	return result.value.resource;
};

export const deleteResource = async (
	client: AidboxClientR5,
	resourceType: string,
	id: string,
) => {
	const result = await client.request<Resource>({
		method: "DELETE",
		url: `/fhir/${resourceType}/${id}`,
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
	});

	if (result.isErr())
		throw new Error(
			parseOperationOutcome(result.value.resource)
				.map(({ expression, diagnostics }) => `${expression}: ${diagnostics}`)
				.join("; "),
			{ cause: result.value.resource },
		);

	return result.value.resource;
};
