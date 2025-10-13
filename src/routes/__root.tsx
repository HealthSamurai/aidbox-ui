import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Layout } from "../layout/layout.tsx";

export const Route = createRootRoute({
	staticData: {
		title: "Home",
	},
	component: RootComponent,
});

function RootComponent() {
	return (
		<Layout>
			<Outlet />
			<TanStackRouterDevtools />
		</Layout>
	);
}
