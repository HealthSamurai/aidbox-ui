import { AidboxCall } from "@aidbox-ui/api/auth";

export type Resource = {
	resourceType: string;
	id: string;
	[key: string]: unknown;
};

export const fetchResource = async (resourceType: string, id: string) => {
	const raw = await AidboxCall<Resource>({
		method: "GET",
		url: `/fhir/${resourceType}/${id}`,
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
	});
	return raw;
};

export interface HistoryBundle {
	resourceType: "Bundle";
	type: "history";
	total: number;
	entry: HistoryEntry[];
}

interface HistoryEntry {
	resource: {
		meta: {
			versionId: string;
			lastUpdated: string;
		};
		resourceType: string;
		id: string;
	};
	response: { status: string };
}

export const fetchResourceHistory = async (
	resourceType: string,
	id: string,
) => {
	const raw = await AidboxCall<HistoryBundle>({
		method: "GET",
		url: `/fhir/${resourceType}/${id}/_history`,
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		params: { _page: "1", _count: "100" },
	});
	return raw as HistoryBundle;
};

export const createResource = async (
	resourceType: string,
	resourceText: string,
) => {
	const res = await AidboxCall<Resource>({
		method: "POST",
		url: `/fhir/${resourceType}`,
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: resourceText,
	});
	return res;
};

export const updateResource = async (
	resourceType: string,
	id: string,
	resourceText: string,
) => {
	const res = await AidboxCall<Resource>({
		method: "PUT",
		url: `/fhir/${resourceType}/${id}`,
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: resourceText,
	});
	return res;
};

export const deleteResource = async (resourceType: string, id: string) => {
	const res = await AidboxCall<Resource>({
		method: "DELETE",
		url: `/fhir/${resourceType}/${id}`,
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
	});
	return res;
};
