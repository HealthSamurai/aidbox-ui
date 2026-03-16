import { useCallback } from "react";
import { type AidboxClientR5, useAidboxClient } from "../AidboxClient";

interface StructureDefinition {
	type: string;
	name?: string;
	baseDefinition?: string;
	differential?: { element: unknown[] };
}

interface Bundle {
	entry?: { resource: StructureDefinition }[];
}

const SD_ELEMENTS = "differential,type,name,baseDefinition";

async function fetchSD(
	client: AidboxClientR5,
	params: [string, string][],
): Promise<StructureDefinition | null> {
	const result = await client.request<Bundle>({
		method: "GET",
		url: "/fhir/StructureDefinition",
		params: [...params, ["_elements", SD_ELEMENTS], ["_count", "1"]],
	});
	if (result.isErr()) return null;
	return result.value.resource.entry?.[0]?.resource ?? null;
}

export function useGetStructureDefinition() {
	const client = useAidboxClient();

	return useCallback(
		async (type: string): Promise<StructureDefinition | null> => {
			try {
				// If type is a URL (baseDefinition), search by url
				if (type.includes("/")) {
					return await fetchSD(client, [["url", type]]);
				}

				// Try specialization first
				const sd = await fetchSD(client, [
					["type", type],
					["derivation", "specialization"],
				]);
				if (sd) return sd;

				// Base types (Resource, Element, etc.) have no derivation
				return await fetchSD(client, [
					["type", type],
					["derivation:missing", "true"],
				]);
			} catch {
				return null;
			}
		},
		[client],
	);
}
