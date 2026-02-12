import type { AidboxClientR5 } from "../AidboxClient";
import type { Snapshot } from "../components/ViewDefinition/types";

export type FhirSchema = {
	elements: Record<string, unknown>;
	url: string;
	name: string;
	version: string;
};

export interface Schema {
	differential: Array<Snapshot>;
	snapshot: Array<Snapshot>;
	entity: FhirSchema;
	"default?": boolean;
}

export interface SchemaData {
	result: Record<string, Schema>;
}

export const fetchSchemas = async (
	client: AidboxClientR5,
	resourceType: string,
): Promise<Record<string, Schema> | undefined> => {
	const response = await client.rawRequest({
		method: "POST",
		url: "/rpc?_m=aidbox.introspector/get-schemas-by-resource-type",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			method: "aidbox.introspector/get-schemas-by-resource-type",
			params: { "resource-type": resourceType },
		}),
	});

	const data: SchemaData = await response.response.json();

	if (!data?.result) return undefined;

	return data.result;
};
