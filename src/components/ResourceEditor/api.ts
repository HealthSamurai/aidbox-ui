import { parseOperationOutcome } from "@aidbox-ui/api/utils";
import type { Bundle, Resource } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { isOperationOutcome } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { AidboxClientR5 } from "../../AidboxClient";

export const fetchResource = async (
	client: AidboxClientR5,
	resourceType: string,
	id: string,
): Promise<Resource> => {
	const {
		response: { body },
	} = await client.aidboxRequest<Resource>({
		method: "GET",
		url: `/fhir/${resourceType}/${id}`,
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
	});

	if (isOperationOutcome(body))
		throw new Error(
			parseOperationOutcome(body)
				.map(({ expression, diagnostics }) => `${expression}: ${diagnostics}`)
				.join("; "),
			{ cause: body },
		);
	else return body;
};

export const fetchResourceHistory = async (
	client: AidboxClientR5,
	resourceType: string,
	id: string,
): Promise<Bundle> => {
	const {
		response: { body },
	} = await client.aidboxRequest<Bundle>({
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

	if (isOperationOutcome(body))
		throw new Error(
			parseOperationOutcome(body)
				.map(({ expression, diagnostics }) => `${expression}: ${diagnostics}`)
				.join("; "),
			{ cause: body },
		);

	return body;
};

export const createResource = async (
	client: AidboxClientR5,
	resourceType: string,
	resource: Resource,
) => {
	const res = (
		await client.aidboxRequest<Resource>({
			method: "POST",
			url: `/fhir/${resourceType}`,
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify(resource),
		})
	).response.body;
	return res;
};

export const updateResource = async (
	client: AidboxClientR5,
	resourceType: string,
	id: string,
	resource: Resource,
) => {
	const res = (
		await client.aidboxRequest<Resource>({
			method: "PUT",
			url: `/fhir/${resourceType}/${id}`,
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify(resource),
		})
	).response.body;
	return res;
};

export const deleteResource = async (
	client: AidboxClientR5,
	resourceType: string,
	id: string,
) => {
	const res = (
		await client.aidboxRequest<Resource>({
			method: "DELETE",
			url: `/fhir/${resourceType}/${id}`,
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
		})
	).response.body;
	return res;
};
