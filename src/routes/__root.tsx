import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";

export const Route = createRootRoute({
	component: RootComponent,
});

function RootComponent() {
	return (
		<React.Fragment>
			<div>Hello "__root"!</div>
			<Outlet />
			<TanStackRouterDevtools />
			<ReactQueryDevtools />
		</React.Fragment>
	);
}
