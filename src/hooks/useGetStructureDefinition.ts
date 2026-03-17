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

export function useGetStructureDefinitions() {
	const client = useAidboxClient();

	return useCallback(
		async (params: Record<string, string>): Promise<StructureDefinition[]> => {
			try {
				const result = await client.request<Bundle>({
					method: "GET",
					url: "/fhir/StructureDefinition",
					params: Object.entries(params),
				});
				if (result.isErr()) return [];
				return result.value.resource.entry?.map((e) => e.resource) ?? [];
			} catch {
				return [];
			}
		},
		[client],
	);
}
