import { createFileRoute } from "@tanstack/react-router";

function NotebookCreatePage() {
	return <div className="h-full" />;
}

export const Route = createFileRoute("/notebooks/new")({
	staticData: { title: "New notebook" },
	loader: () => ({ breadCrumb: "New notebook" }),
	component: NotebookCreatePage,
});
