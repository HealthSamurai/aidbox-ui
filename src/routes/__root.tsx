import { createRootRoute, Outlet } from "@tanstack/react-router";
import * as React from "react";
import { Layout } from "../layout/layout.tsx";

export const Route = createRootRoute({
	staticData: {
		title: "Home",
	},
	component: RootComponent,
});

function RootComponent() {
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
