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
	console.log(raw);
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
