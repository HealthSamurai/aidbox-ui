import { createFileRoute } from "@tanstack/react-router";

const TITLE = "DB Console";

export const Route = createFileRoute("/db-console")({
	component: DbConsolePage,
	staticData: { title: TITLE },
	loader: () => ({ breadCrumb: TITLE }),
});

function DbConsolePage() {
	return <div className="p-6" />;
}
