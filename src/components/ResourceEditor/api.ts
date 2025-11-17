import { parseOperationOutcome } from "@aidbox-ui/api/utils";
import type { Bundle, Resource, OperationOutcome } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { isOperationOutcome } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { AidboxClient, AidboxResponse } from "@health-samurai/aidbox-client";

export const fetchResource = async (
	client: AidboxClient,
	resourceType: string,
	id: string,
) => {
	const raw = (
		await client.aidboxRequest<Resource>({
			method: "GET",
			url: `/fhir/${resourceType}/${id}`,
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
		})
	).response.body;
	return raw;
};

export type HistoryEntryResource = {
	meta: {
		versionId: string;
		lastUpdated: string;
	};
	resourceType: string;
	id: string;
};

export interface HistoryEntry {
	resource: HistoryEntryResource;
	response: { status: string };
}

export const fetchResourceHistory = async (
	client: AidboxClient,
	resourceType: string,
	id: string,
): Promise<Bundle> => {
	const res: AidboxResponse<Bundle> = await client.aidboxRequest<Bundle>({
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
	const response = res.response;

	const body = response.body;

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
	client: AidboxClient,
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
	client: AidboxClient,
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
	client: AidboxClient,
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
