import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { useAidboxClient } from "../AidboxClient";

export function useUserInfo() {
	const client = useAidboxClient();

	return useQuery({
		queryKey: ["userInfo"],
		queryFn: client.fetchUserInfo,
		refetchOnWindowFocus: false,
	});
}

export function useLogout() {
	const client = useAidboxClient();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: client.performLogout,
		onSuccess: () => {
			queryClient.removeQueries({ queryKey: ["userInfo"] });
			const encodedLocation = btoa(window.location.href);
			const redirectTo = `${client.getBaseURL()}/auth/login?redirect_to=${encodedLocation}`;
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
		queryFn: client.fetchUIHistory,
		refetchOnWindowFocus: false,
		staleTime: 30000, // 30 seconds
	});
}
