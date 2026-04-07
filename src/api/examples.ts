import type { AidboxClientR5 } from "../AidboxClient";

export interface ExampleEntry {
	id: string;
	"resource-id"?: string;
	name?: string;
	package?: string;
	"package-version"?: string;
}

export async function fetchExamples(
	client: AidboxClientR5,
	resourceType: string,
): Promise<ExampleEntry[]> {
	const response = await client.rawRequest({
		method: "POST",
		url: "/rpc?_m=aidbox.introspector/list-examples",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			method: "aidbox.introspector/list-examples",
			params: { rt: resourceType },
		}),
	});
	const json = await response.response.json();
	return json.result ?? [];
}

export async function fetchExample(
	client: AidboxClientR5,
	resourceType: string,
	id: string,
): Promise<Record<string, unknown> | null> {
	const response = await client.rawRequest({
		method: "POST",
		url: "/rpc?_m=aidbox.introspector/get-example",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			method: "aidbox.introspector/get-example",
			params: { rt: resourceType, id },
		}),
	});
	const json = await response.response.json();
	return json.result?.resource ?? null;
}
