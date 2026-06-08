import { useQuery } from "@tanstack/react-query";
import { useAidboxClient } from "../../AidboxClient";

export function useFhirServerVersion(): string | undefined {
	const client = useAidboxClient();
	const { data } = useQuery({
		queryKey: ["fhir-metadata-version"],
		queryFn: async () => {
			const res = await client.request<{ fhirVersion?: string }>({
				method: "GET",
				url: "/fhir/metadata?_elements=fhirVersion",
			});
			if (res.isErr()) return undefined;
			return res.value.resource.fhirVersion;
		},
		staleTime: Number.POSITIVE_INFINITY,
	});
	return data;
}

// "4.0.x" / "4.3.x" → R4-style. "5.x" / "6.x" → R5-style.
export const isR4Like = (fhirVersion?: string): boolean =>
	!!fhirVersion &&
	(fhirVersion.startsWith("4.0") || fhirVersion.startsWith("4.3"));
