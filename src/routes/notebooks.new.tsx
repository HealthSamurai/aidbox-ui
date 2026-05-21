import { createFileRoute } from "@tanstack/react-router";
import { emptyNotebook, NotebookEditor } from "../components/notebook-editor";

function NotebookCreatePage() {
	return <NotebookEditor initial={emptyNotebook()} isNew />;
}

export const Route = createFileRoute("/notebooks/new")({
	staticData: { title: "New notebook" },
	loader: () => ({ breadCrumb: "New notebook" }),
	component: NotebookCreatePage,
});
