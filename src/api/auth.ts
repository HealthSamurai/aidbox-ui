import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Cookies from "js-cookie";
import type { UIHistoryResponse } from "../shared/types";
import { getAidboxBaseURL } from "../utils";

export interface UserInfo {
	id: string;
	email?: string;
}

export interface AidboxCallParams {
	method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
	url: string;
	headers?: Record<string, string>;
	params?: Record<string, string>;
	body?: string | object;
}

export async function AidboxCall<T = unknown>({
	method,
	url,
	headers = {},
	params = {},
	body,
}: AidboxCallParams): Promise<T> {
	const baseURL = getAidboxBaseURL();

	const urlObj = new URL(url.startsWith("/") ? url.slice(1) : url, baseURL);
	Object.entries(params).forEach(([key, value]) => {
		urlObj.searchParams.append(key, value);
	});

	const defaultHeaders = {
		"Content-Type": "application/json",
		Accept: "application/json",
	};

	const requestHeaders = { ...defaultHeaders, ...headers };

	let requestBody: string | null = null;
	if (body) {
		if (typeof body === "string") {
			requestBody = body;
		} else {
			requestBody = JSON.stringify(body);
		}
	}

	const response = await fetch(urlObj.toString(), {
		method,
		headers: requestHeaders,
		body: requestBody,
		credentials: "include",
	});

	if (!response.ok) {
		if (response.status === 401 || response.status === 403) {
			const encodedLocation = btoa(window.location.href);
			window.location.href = `${baseURL}/auth/login?redirect_to=${encodedLocation}`;
			throw new Error("Authentication required");
		}
		throw Error(`HTTP ${response.status}: ${response.statusText}`, {
			cause: await response.json(),
		});
	}

	const contentType = response.headers.get("content-type");
	if (!contentType || !contentType.includes("application/json")) {
		return null as T;
	}

	return response.json() as T;
}

export async function AidboxCallWithMeta({
	method,
	url,
	headers = {},
	params = {},
	body,
}: AidboxCallParams): Promise<{
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body: string;
	duration: number;
}> {
	const startTime = Date.now();
	const baseURL = getAidboxBaseURL();

	const urlObj = new URL(url.startsWith("/") ? url.slice(1) : url, baseURL);
	Object.entries(params).forEach(([key, value]) => {
		urlObj.searchParams.append(key, value);
	});

	const defaultHeaders = {
		"Content-Type": "application/json",
		Accept: "application/json",
	};

	const requestHeaders = { ...defaultHeaders, ...headers };

	let requestBody: string | null = null;
	if (body) {
		if (typeof body === "string") {
			requestBody = body;
		} else {
			requestBody = JSON.stringify(body);
		}
	}

	const response = await fetch(urlObj.toString(), {
		method,
		headers: requestHeaders,
		body: requestBody,
		credentials: "include",
	});

	const duration = Date.now() - startTime;

	const responseHeaders: Record<string, string> = {};
	response.headers.forEach((value, key) => {
		responseHeaders[key] = value;
	});

	const bodyText = await response.text();

	if (!response.ok) {
		if (response.status === 401 || response.status === 403) {
			const encodedLocation = btoa(window.location.href);
			window.location.href = `${baseURL}/auth/login?redirect_to=${encodedLocation}`;
		}
	}

	return {
		status: response.status,
		statusText: response.statusText,
		headers: responseHeaders,
		body: bodyText,
		duration,
	};
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

// UI History API
async function fetchUIHistory(): Promise<UIHistoryResponse> {
	const response = await AidboxCall<UIHistoryResponse>({
		method: "GET",
		url: "/ui_history",
		params: {
			".type": "http",
			_sort: "-_lastUpdated",
			_count: "100",
		},
	});

	return response;
}

export function useUIHistory() {
	return useQuery({
		queryKey: ["uiHistory"],
		queryFn: fetchUIHistory,
		refetchOnWindowFocus: false,
		staleTime: 30000, // 30 seconds
	});
}
