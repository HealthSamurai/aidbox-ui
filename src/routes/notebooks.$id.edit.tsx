import { createFileRoute } from "@tanstack/react-router";

function NotebookEditPage() {
	return <div className="h-full" />;
}

export const Route = createFileRoute("/notebooks/$id/edit")({
	staticData: { title: "Edit notebook" },
	loader: ({ params }) => ({ breadCrumb: params.id }),
	component: NotebookEditPage,
});
