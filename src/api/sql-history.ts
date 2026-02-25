import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { type AidboxClientR5, useAidboxClient } from "../AidboxClient";

async function sha1(text: string): Promise<string> {
	const data = new TextEncoder().encode(text);
	const hash = await crypto.subtle.digest("SHA-1", data);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export function useSqlHistory() {
	const client = useAidboxClient();

	return useQuery({
		queryKey: ["sqlHistory"],
		queryFn: async () => {
			const result = await client.request<Bundle>({
				method: "GET",
				url: "/fhir/ui_history",
				params: [
					[".type", "sql"],
					["_sort", "-_lastUpdated"],
					["_count", "200"],
				],
			});

			if (result.isOk()) {
				const { resource: history } = result.value;
				return history;
			}
			const { resource: oo } = result.value;
			throw new Error("error fetching sql history", { cause: oo });
		},
		refetchOnWindowFocus: false,
		staleTime: 30000,
	});
}

export async function saveSqlHistory(
	query: string,
	queryClient: QueryClient,
	aidboxClient: AidboxClientR5,
): Promise<void> {
	try {
		const trimmed = query.trim();
		if (!trimmed) return;

		const id = await sha1(trimmed);

		await aidboxClient.rawRequest({
			method: "PUT",
			url: `/ui_history/${id}`,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ type: "sql", command: trimmed }),
		});

		queryClient.invalidateQueries({ queryKey: ["sqlHistory"] });
	} catch (error) {
		console.warn("Failed to save SQL history:", error);
	}
}
