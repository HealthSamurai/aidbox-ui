import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useAidboxClient } from "../AidboxClient";
import {
	type EditableCell,
	type EditableNotebook,
	NotebookEditor,
} from "../components/notebook-editor";

type LoadedNotebook = {
	id: string;
	name?: string;
	description?: string;
	cells?: EditableCell[];
	"publication-id"?: string;
	"edit-secret"?: string;
	origin?: string;
};

function useNotebookForEdit(id: string) {
	const client = useAidboxClient();
	return useQuery<EditableNotebook | null>({
		queryKey: ["notebook-edit", id],
		queryFn: async () => {
			const body = {
				method: "aidbox.notebooks/get-notebook-by-id",
				params: { notebook: { id } },
			};
			const resp = await client.rawRequest({
				method: "POST",
				url: `/rpc?_m=${body.method}`,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const json = (await resp.response.json()) as {
				result?: { notebook?: LoadedNotebook };
			};
			const nb = json.result?.notebook;
			if (!nb) return null;
			return {
				id: nb.id,
				name: nb.name,
				description: nb.description,
				cells: (nb.cells ?? []).map((c) => ({
					id: c.id,
					type: c.type,
					value: c.value,
				})),
				"publication-id": nb["publication-id"],
				"edit-secret": nb["edit-secret"],
				origin: nb.origin,
			};
		},
	});
}

function NotebookEditPage() {
	const { id } = Route.useParams();
	const { data: notebook, isLoading } = useNotebookForEdit(id);

	if (isLoading) return <div className="h-full" />;
	if (!notebook)
		return (
			<div className="h-full mx-auto max-w-[990px] px-8 py-8 typo-body text-text-tertiary italic">
				Notebook not found.
			</div>
		);

	return <NotebookEditor initial={notebook} isNew={false} />;
}

export const Route = createFileRoute("/notebooks/$id_/edit")({
	staticData: { title: "Edit notebook" },
	loader: () => ({ breadCrumb: "Edit" }),
	component: NotebookEditPage,
});
