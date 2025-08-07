import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { getAidboxBaseURL } from "../utils";

export interface UserInfo {
	id: string;
	email?: string;
}

async function fetchUserInfo(): Promise<UserInfo> {
	const response = await fetch(`${getAidboxBaseURL()}/auth/userinfo`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		credentials: "include",
	});

	if (!response.ok) {
		const encodedLocation = btoa(window.location.href);
		window.location.href = `${getAidboxBaseURL()}/auth/login?redirect_to=${encodedLocation}`;
	}

	return response.json();
}

export function useUserInfo() {
	return useQuery({
		queryKey: ["userInfo"],
		queryFn: fetchUserInfo,
	});
}

async function performLogout() {
	const response = await fetch(`${getAidboxBaseURL()}/auth/logout`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		credentials: "include",
	});

	Cookies.remove("asid", { path: "/" });

	const encodedLocation = btoa(window.location.href);
	window.location.href = `${getAidboxBaseURL()}/auth/login?redirect_to=${encodedLocation}`;

	return response;
}

export function useLogout() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: performLogout,
		onSuccess: () => {
			queryClient.removeQueries({ queryKey: ["userInfo"] });
		},
	});
}
