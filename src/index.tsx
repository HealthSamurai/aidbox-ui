import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { routeTree } from "./routeTree.gen";
import "./index.css";
import { AidboxClientProvider } from "./AidboxClient";
import { UI_BASE_PATH } from "./shared/const";
import { getAidboxBaseURL } from "./utils";

const router = createRouter({ basepath: UI_BASE_PATH, routeTree });

const queryClient = new QueryClient();

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}

	interface StaticDataRouteOption {
		title?: string;
	}
}

const baseurl = getAidboxBaseURL();
const root = document.getElementById("root");
if (root) {
	createRoot(root).render(
		<StrictMode>
			<QueryClientProvider client={queryClient}>
				<AidboxClientProvider baseurl={baseurl}>
					<RouterProvider router={router} />
				</AidboxClientProvider>
			</QueryClientProvider>
		</StrictMode>,
	);
}
