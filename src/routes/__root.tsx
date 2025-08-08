import { useQuery } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";
import { Layout } from "../components/layout.tsx";

export const Route = createRootRoute({
	component: RootComponent,
});

async function checkUserAuth() {
	const baseUrl = import.meta.env.VITE_AIDBOX_BASE_URL;
	if (!baseUrl) {
		throw new Error("AIDBOX_BASE_URL environment variable is not configured");
	}

	const response = await fetch(`${baseUrl}/auth/userinfo`, {
		credentials: "include",
	});

	if (!response.ok) {
		throw new Error(`Authentication failed: ${response.status}`);
	}

	return response.json();
}

function useAuthCheck() {
	const { error, isLoading } = useQuery({
		queryKey: ["auth", "userinfo"],
		queryFn: checkUserAuth,
		retry: false,
		refetchOnWindowFocus: false,
	});

	React.useEffect(() => {
		if (error && !isLoading) {
			const baseUrl = import.meta.env.VITE_AIDBOX_BASE_URL;
			if (!baseUrl) {
				console.error("AIDBOX_BASE_URL environment variable is not configured");
				return;
			}

			// Get current location and encode it in base64
			const currentLocation = window.location.href;
			const encodedLocation = btoa(currentLocation);

			// Redirect to Aidbox login page with redirect_to parameter
			const loginUrl = `${baseUrl}/auth/login?redirect_to=${encodedLocation}`;
			// window.location.href = loginUrl;
		}
	}, [error, isLoading]);

	return { isLoading };
}

function RootComponent() {
	const { isLoading } = useAuthCheck();

	if (isLoading) {
		return (
			<div className="h-screen flex items-center justify-center">
				<div className="text-center">
					<h1 className="text-2xl font-bold mb-4">
						Checking authentication...
					</h1>
					<p>Please wait...</p>
				</div>
			</div>
		);
	}

	return (
		<React.Fragment>
			<Layout>
				<Outlet />
			</Layout>
			{/* <TanStackRouterDevtools /> */}
			{/* <ReactQueryDevtools /> */}
		</React.Fragment>
	);
}
