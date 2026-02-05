import { createRootRoute, Outlet } from "@tanstack/react-router";
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
		</Layout>
	);
}
