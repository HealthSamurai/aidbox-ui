import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAidboxClient } from "../../AidboxClient";
import type { BoxInfo, DeprecatedCapabilities, Setting } from "./types";

const SETTINGS_QUERY_KEY = ["settingsIntrospect"];

export function useSettingsIntrospect() {
	const client = useAidboxClient();

	return useQuery({
		queryKey: SETTINGS_QUERY_KEY,
		queryFn: async () => {
			const result = await client.request<Setting[]>({
				method: "GET",
				url: "/api/v1/settings/introspect",
			});
			if (result.isOk()) {
				return result.value.resource;
			}
			throw new Error("Failed to fetch settings");
		},
		refetchOnWindowFocus: false,
	});
}

export function useBoxInfo() {
	const client = useAidboxClient();

	return useQuery({
		queryKey: ["boxInfo"],
		queryFn: async () => {
			const result = await client.request<BoxInfo>({
				method: "GET",
				url: "/$config",
			});
			if (result.isOk()) {
				return result.value.resource;
			}
			throw new Error("Failed to fetch box info");
		},
		refetchOnWindowFocus: false,
		staleTime: Number.POSITIVE_INFINITY,
	});
}

export function useDeprecatedCapabilities() {
	const client = useAidboxClient();

	return useQuery({
		queryKey: ["deprecatedCapabilities"],
		queryFn: async () => {
			const result = await client.request<DeprecatedCapabilities>({
				method: "GET",
				url: "/deprecated/capabilities",
			});
			if (result.isOk()) {
				return result.value.resource;
			}
			throw new Error("Failed to fetch deprecated capabilities");
		},
		refetchOnWindowFocus: false,
		staleTime: Number.POSITIVE_INFINITY,
	});
}

export function useUpdateSetting() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ name, value }: { name: string; value: unknown }) => {
			const result = await client.request<{
				settings?: Setting[];
			}>({
				method: "POST",
				url: "/api/v1/settings",
				body: { [name]: value === "" ? null : value },
			});
			if (result.isOk()) {
				return result.value.resource;
			}
			throw result.value;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
		},
	});
}

export function useResetSetting() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ name }: { name: string }) => {
			const result = await client.request<Setting>({
				method: "DELETE",
				url: `/api/v1/settings/${name}`,
			});
			if (result.isOk()) {
				return result.value.resource;
			}
			throw result.value;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
		},
	});
}
