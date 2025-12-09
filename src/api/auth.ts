import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { useAidboxClient } from "../AidboxClient";

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
		mutationFn: client.logout,
		onSuccess: () => {
			queryClient.removeQueries({ queryKey: ["userInfo"] });
			const encodedLocation = btoa(window.location.href);
			const redirectTo = `${client.getBaseUrl()}/auth/login?redirect_to=${encodedLocation}`;
			window.location.href = redirectTo;
			// FIXME: doesn't work without window.location.href
			throw redirect({ href: redirectTo });
		},
	});
}

export function useUIHistory() {
	const client = useAidboxClient();

	return useQuery({
		queryKey: ["uiHistory"],
		queryFn: async () => {
			const result = await client.searchType({
				type: "ui_history",
				query: [
					[".type", "http"],
					["_sort", "-_lastUpdated"],
					["_count", "100"],
				],
			});

			if (result.isOk()) {
				const { resource: history } = result.value;
				return history;
			} else {
				const { resource: oo } = result.value;
				throw new Error("error fetching history", { cause: oo });
			}
		},
		refetchOnWindowFocus: false,
		staleTime: 30000, // 30 seconds
	});
}
