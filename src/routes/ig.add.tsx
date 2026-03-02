import { createFileRoute } from "@tanstack/react-router";
import { ImportPackage } from "../components/IGBrowser/import-package";

export const Route = createFileRoute("/ig/add")({
	component: RouteComponent,
	loader: () => ({ breadCrumb: "Import Package" }),
});

function RouteComponent() {
	return <ImportPackage />;
}
