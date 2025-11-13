import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAidboxClient } from "../AidboxClient";

export interface UserInfo {
	id: string;
	email?: string;
}

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
