import { createRootRoute, Outlet } from "@tanstack/react-router";
import * as React from "react";
import { useUserInfo } from "../api/auth";
import { Layout } from "../components/layout.tsx";

export const Route = createRootRoute({
	staticData: {
		title: "Home",
	},
	component: RootComponent,
});

function RootComponent() {
	const userInfo = useUserInfo();

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
