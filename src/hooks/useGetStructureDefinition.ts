import type { GetStructureDefinitions } from "@health-samurai/react-components";
import { useCallback, useRef } from "react";
import { type AidboxClientR5, useAidboxClient } from "../AidboxClient";

interface Bundle {
	entry?: {
		resource: {
			type: string;
			name?: string;
			baseDefinition?: string;
			differential?: { element: unknown[] };
		};
	}[];
}

export function useGetStructureDefinitions(): GetStructureDefinitions {
	const client = useAidboxClient();
	const clientRef = useRef<AidboxClientR5>(client);
	clientRef.current = client;

	return useCallback(async (params) => {
		try {
			const entries = Object.entries(params).filter(
				(e): e is [string, string] => e[1] !== undefined,
			);
			const result = await clientRef.current.request<Bundle>({
				method: "GET",
				url: "/fhir/StructureDefinition",
				params: entries,
			});
			if (result.isErr()) return [];
			return (result.value.resource.entry?.map((e) => e.resource) ??
				[]) as Awaited<ReturnType<GetStructureDefinitions>>;
		} catch {
			return [];
		}
	}, []);
}
