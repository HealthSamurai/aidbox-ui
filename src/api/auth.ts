import type { Bundle } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type AidboxClientR5, useAidboxClient } from "../AidboxClient";

export function useUserInfo() {
	const client = useAidboxClient();

	return useQuery({
		queryKey: ["userInfo"],
		queryFn: client.userinfo,
		refetchOnWindowFocus: false,
	});
}

export function useLogout() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			const baseUrl = client.getBaseUrl();
			await fetch(`${baseUrl}/auth/logout`, {
				method: "POST",
				credentials: "include",
				redirect: "manual",
			});
		},
		onSettled: () => {
			queryClient.removeQueries({ queryKey: ["userInfo"] });
			const encodedLocation = encodeURIComponent(btoa(window.location.href));
			window.location.href = `${client.getBaseUrl()}/auth/login?redirect_to=${encodedLocation}`;
		},
	});
}

const INSTANCE_NAME_KEY = "aidbox-instance-name";

export function useInstanceName() {
	const client = useAidboxClient();

	return useQuery({
		queryKey: ["instanceName"],
		queryFn: async () => {
			const result = await client.request<{ value?: string }>({
				method: "GET",
				url: "/api/v1/settings/introspect/instance-name",
			});
			if (result.isOk()) {
				const name = result.value.resource.value ?? null;
				if (name) {
					localStorage.setItem(INSTANCE_NAME_KEY, name);
				} else {
					localStorage.removeItem(INSTANCE_NAME_KEY);
				}
				return name;
			}
			return null;
		},
		placeholderData: () => localStorage.getItem(INSTANCE_NAME_KEY),
		refetchOnWindowFocus: false,
		staleTime: Number.POSITIVE_INFINITY,
	});
}

export async function fetchUIHistory(client: AidboxClientR5) {
	const result = await client.request<Bundle>({
		method: "GET",
		url: "/fhir/ui_history",
		params: [
			[".type", "http"],
			["_sort", "-_lastUpdated"],
			["_count", "100"],
		],
	});

	if (result.isOk()) {
		return result.value.resource;
	}
	throw new Error("error fetching history", { cause: result.value.resource });
}

export function useUIHistory() {
	const client = useAidboxClient();

	return useQuery({
		queryKey: ["uiHistory"],
		queryFn: () => fetchUIHistory(client),
		refetchOnWindowFocus: false,
		staleTime: 30000, // 30 seconds
	});
}
