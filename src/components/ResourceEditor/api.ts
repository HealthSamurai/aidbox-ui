import type { AidboxClient } from "@health-samurai/aidbox-client";

export type Resource = {
	resourceType: string;
	id?: string;
	[key: string]: unknown;
};

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

export interface HistoryBundle {
	resourceType: "Bundle";
	type: "history";
	total: number;
	entry: HistoryEntry[];
}

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
) => {
	const raw = (
		await client.aidboxRequest<HistoryBundle>({
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
		})
	).response.body;
	return raw as HistoryBundle;
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
