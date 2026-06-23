import * as HSComp from "@health-samurai/react-components";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	Eye,
	Loader2,
	Plus,
	Save,
	TextInitial,
	Trash2,
	User,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAidboxClient } from "../AidboxClient";
import {
	type Cell,
	CellView,
	RestCellView,
	SqlCellView,
	SqlQueryCellView,
	ViewDefinitionCellView,
} from "../routes/notebooks.$id";
import { ConfirmDialog } from "./confirm-dialog";

export type CellType =
	| "rest"
	| "sql"
	| "markdown"
	| "rpc"
	| "view-definition"
	| "sql-query"
	| "sql-view";

export type EditableCell = {
	id: string;
	type: CellType;
	value: string;
	result?: unknown;
};

export type EditableNotebook = {
	id?: string;
	name?: string;
	description?: string;
	cells: EditableCell[];
	"publication-id"?: string;
	"edit-secret"?: string;
	origin?: string;
};

const CELL_TYPES: { value: CellType; label: string }[] = [
	{ value: "rest", label: "REST" },
	{ value: "sql", label: "SQL" },
	{ value: "markdown", label: "Markdown" },
	{ value: "view-definition", label: "ViewDefinition" },
	{ value: "sql-query", label: "SQLQuery" },
	{ value: "sql-view", label: "SQLView" },
];

const DEFAULT_CELL_VALUE: Record<CellType, string> = {
	rest: "GET /fhir/Patient\nContent-Type: application/json\nAccept: application/json",
	rpc: "POST /rpc\ncontent-type: application/json\n\n{}",
	sql: "SELECT 1;",
	markdown: "",
	"view-definition": "",
	"sql-query": "",
	"sql-view": "",
};

function genCellId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto)
		return crypto.randomUUID();
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function emptyNotebook(): EditableNotebook {
	return {
		name: "",
		description: "Description",
		cells: [],
	};
}

function AddCellDivider({ onAdd }: { onAdd: (t: CellType) => void }) {
	return (
		<div className="relative h-10 -mx-3 my-1 flex items-center justify-center">
			<div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-border-default" />
			<HSComp.DropdownMenu>
				<HSComp.DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-label="Insert cell"
						className="relative z-10 inline-flex items-center justify-center size-8 rounded-full border border-border-default bg-bg-primary text-text-tertiary hover:text-text-info-primary hover:border-border-info-primary cursor-pointer before:absolute before:-inset-2 before:content-['']"
					>
						<Plus className="size-5" />
					</button>
				</HSComp.DropdownMenuTrigger>
				<HSComp.DropdownMenuContent align="center">
					{CELL_TYPES.map((t) => (
						<HSComp.DropdownMenuItem
							key={t.value}
							onClick={() => onAdd(t.value)}
						>
							{t.label}
						</HSComp.DropdownMenuItem>
					))}
				</HSComp.DropdownMenuContent>
			</HSComp.DropdownMenu>
		</div>
	);
}

function MarkdownEditCell({
	cell,
	onChange,
}: {
	cell: EditableCell;
	onChange: (value: string) => void;
}) {
	const [value, setValue] = useState(cell.value);
	const update = (v: string) => {
		setValue(v);
		onChange(v);
	};
	return (
		<div className="group/cell -mx-3 mt-4 mb-4 rounded-lg border border-border-default bg-bg-primary overflow-hidden">
			<div className="flex items-center justify-between bg-bg-secondary pl-3 pr-4 border-b border-border-default h-10">
				<span className="text-sm font-medium text-text-secondary w-[110px] shrink-0 flex items-center gap-1.5">
					<TextInitial className="size-4 shrink-0" />
					Markdown
				</span>
			</div>
			<textarea
				value={value}
				onChange={(e) => update(e.target.value)}
				placeholder="# Markdown…"
				className="w-full min-h-[150px] max-h-[400px] px-3 py-2 typo-code outline-none resize-y bg-bg-primary text-text-primary"
			/>
		</div>
	);
}

function CellWrapper({
	cell,
	onValueChange,
	onResultChange,
	onDelete,
}: {
	cell: EditableCell;
	onValueChange: (id: string, value: string) => void;
	onResultChange: (id: string, result: unknown) => void;
	onDelete: (id: string) => void;
}) {
	const cellLike: Cell = {
		id: cell.id,
		type: cell.type,
		value: cell.value,
		result: cell.result,
	};
	const handleValue = (v: string) => onValueChange(cell.id, v);
	const handleResult = (r: unknown) => onResultChange(cell.id, r);
	const inner =
		cell.type === "sql" ? (
			<SqlCellView
				cell={cellLike}
				onValueChange={handleValue}
				onResultChange={handleResult}
			/>
		) : cell.type === "view-definition" ? (
			<ViewDefinitionCellView
				cell={cellLike}
				onValueChange={handleValue}
				onResultChange={handleResult}
			/>
		) : cell.type === "sql-query" ? (
			<SqlQueryCellView
				cell={cellLike}
				onValueChange={handleValue}
				onResultChange={handleResult}
			/>
		) : cell.type === "sql-view" ? (
			<SqlQueryCellView
				cell={cellLike}
				kind="sql-view"
				onValueChange={handleValue}
				onResultChange={handleResult}
			/>
		) : cell.type === "markdown" ? (
			<MarkdownEditCell cell={cell} onChange={handleValue} />
		) : (
			<RestCellView
				cell={cellLike}
				onValueChange={handleValue}
				onResultChange={handleResult}
			/>
		);
	return (
		<div className="group/cellwrap relative">
			{inner}
			<button
				type="button"
				onClick={() => onDelete(cell.id)}
				aria-label="Delete cell"
				className="absolute top-0 -right-14 inline-flex items-center justify-center size-10 rounded text-text-disabled hover:text-text-primary opacity-0 group-hover/cellwrap:opacity-100 transition-opacity cursor-pointer after:absolute after:top-0 after:bottom-0 after:right-full after:w-4 after:content-['']"
			>
				<Trash2 className="size-6" />
			</button>
		</div>
	);
}

type SavedNotebook = EditableNotebook & { id: string };

export function NotebookEditor({
	initial,
	isNew,
}: {
	initial: EditableNotebook;
	isNew: boolean;
}) {
	const client = useAidboxClient();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [notebook, setNotebook] = useState<EditableNotebook>(initial);
	const [dirty, setDirty] = useState(isNew);
	const [previewMode, setPreviewMode] = useState(false);

	useEffect(() => {
		if (!dirty) return;
		const handler = (e: BeforeUnloadEvent) => {
			e.preventDefault();
			e.returnValue = "";
		};
		window.addEventListener("beforeunload", handler);
		return () => window.removeEventListener("beforeunload", handler);
	}, [dirty]);

	const saveMut = useMutation<
		SavedNotebook,
		Error,
		EditableNotebook | undefined
	>({
		mutationFn: async (override) => {
			const target = override ?? notebook;
			const saveResp = await client.rawRequest({
				method: "POST",
				url: "/rpc?_m=aidbox.notebooks/save-notebook",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					method: "aidbox.notebooks/save-notebook",
					params: { notebook: target },
				}),
			});
			const saveJson = (await saveResp.response.json()) as {
				result?: { notebook?: SavedNotebook };
				error?: { message?: string };
			};
			const saved = saveJson.result?.notebook;
			if (!saved?.id) throw new Error(saveJson.error?.message ?? "save failed");
			if (saved["publication-id"] && saved["edit-secret"]) {
				try {
					await client.rawRequest({
						method: "POST",
						url: "/rpc?_m=aidbox.notebooks/update-published-notebook",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							method: "aidbox.notebooks/update-published-notebook",
							params: { notebook: saved },
						}),
					});
				} catch {
					// Update of published copy is best-effort — local save already succeeded.
				}
			}
			return saved;
		},
		onSuccess: (saved, override) => {
			setNotebook((prev) => ({ ...prev, id: saved.id }));
			setDirty(false);
			void queryClient.invalidateQueries({
				queryKey: ["notebook", saved.id],
			});
			if (override === undefined) {
				void navigate({
					to: "/notebooks/$id",
					params: { id: saved.id },
				});
			}
		},
	});

	const deleteMut = useMutation<void, Error>({
		mutationFn: async () => {
			if (!notebook.id) return;
			if (notebook["publication-id"]) {
				try {
					await client.rawRequest({
						method: "POST",
						url: "/rpc?_m=aidbox.notebooks/delete-published-notebook",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							method: "aidbox.notebooks/delete-published-notebook",
							params: { notebook },
						}),
					});
				} catch {
					// best-effort: continue with local delete even if unpublish failed
				}
			}
			const resp = await fetch(
				`${client.getBaseUrl()}/Notebook/${notebook.id}`,
				{
					method: "DELETE",
					credentials: "include",
				},
			);
			if (!resp.ok && resp.status !== 404)
				throw new Error(`Delete failed: ${resp.status}`);
		},
		onSuccess: () => {
			setDirty(false);
			void navigate({ to: "/notebooks" });
		},
	});

	const [deleteOpen, setDeleteOpen] = useState(false);

	const updateField = <K extends keyof EditableNotebook>(
		key: K,
		value: EditableNotebook[K],
	) => {
		setNotebook((prev) => ({ ...prev, [key]: value }));
		setDirty(true);
	};

	const updateCellValue = (id: string, value: string) => {
		setNotebook((prev) => ({
			...prev,
			cells: prev.cells.map((c) => (c.id === id ? { ...c, value } : c)),
		}));
		setDirty(true);
	};

	const updateCellResult = (id: string, result: unknown) => {
		setNotebook((prev) => {
			const next: EditableNotebook = {
				...prev,
				cells: prev.cells.map((c) => (c.id === id ? { ...c, result } : c)),
			};
			if (next.id) saveMut.mutate(next);
			return next;
		});
	};

	const deleteCell = (id: string) => {
		setNotebook((prev) => ({
			...prev,
			cells: prev.cells.filter((c) => c.id !== id),
		}));
		setDirty(true);
	};

	const addCellAt = (idx: number, type: CellType) => {
		const newCell: EditableCell = {
			id: genCellId(),
			type,
			value: DEFAULT_CELL_VALUE[type],
		};
		setNotebook((prev) => {
			const cells = [...prev.cells];
			cells.splice(idx, 0, newCell);
			return { ...prev, cells };
		});
		setDirty(true);
	};

	const saveDisabled = !notebook.name?.trim() || saveMut.isPending;

	const editorBody = (
		<div className="flex flex-col h-full">
			<div className="flex items-center bg-bg-secondary flex-none h-10 border-b border-border-default">
				<div className="mx-auto max-w-[990px] w-full flex items-center gap-4 px-8">
					<HSComp.Button
						variant="ghost"
						size="small"
						className="px-0! text-text-link"
						disabled={saveDisabled}
						onClick={() => saveMut.mutate(undefined)}
					>
						<Save className="size-4" />
						Save
					</HSComp.Button>
					{!isNew && notebook.id && (
						<HSComp.Button
							variant="ghost"
							size="small"
							className="px-0!"
							disabled={deleteMut.isPending}
							onClick={() => setDeleteOpen(true)}
						>
							{deleteMut.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Trash2 className="size-4" />
							)}
							Delete
						</HSComp.Button>
					)}
					{!previewMode && (
						<HSComp.Toggle
							variant="outline"
							className="ml-auto"
							pressed={previewMode}
							onPressedChange={setPreviewMode}
						>
							<Eye className="size-4" />
							Preview
						</HSComp.Toggle>
					)}
				</div>
			</div>
			<div className="flex-1 overflow-y-auto pb-[400px]">
				<div className="mx-auto max-w-[990px] px-8 py-8">
					<div className="flex flex-col">
						<div className="flex flex-col gap-1">
							<div className="flex items-center gap-1.5 typo-label-tiny uppercase tracking-wide text-text-warning-primary">
								<User className="size-3.5" />
								<span>Personal</span>
							</div>
							<input
								value={notebook.name ?? ""}
								onChange={(e) => updateField("name", e.target.value)}
								placeholder="Untitled notebook"
								// biome-ignore lint/a11y/noAutofocus: focus the title input only on the New notebook page
								autoFocus={isNew}
								className="typo-page-header text-text-primary bg-transparent outline-none w-full"
							/>
							<input
								value={notebook.description ?? ""}
								onChange={(e) => updateField("description", e.target.value)}
								placeholder="Description"
								className="typo-body text-text-secondary bg-transparent outline-none"
							/>
							{saveMut.isError && (
								<p className="typo-body-xs text-critical-default">
									{saveMut.error.message}
								</p>
							)}
							{deleteMut.isError && (
								<p className="typo-body-xs text-critical-default">
									{deleteMut.error.message}
								</p>
							)}
						</div>
						<div className="flex flex-col mt-7">
							<AddCellDivider onAdd={(t) => addCellAt(0, t)} />
							{notebook.cells.map((cell, idx) => (
								<div key={cell.id}>
									<CellWrapper
										cell={cell}
										onValueChange={updateCellValue}
										onResultChange={updateCellResult}
										onDelete={deleteCell}
									/>
									<AddCellDivider onAdd={(t) => addCellAt(idx + 1, t)} />
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);

	const previewBody = (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between bg-bg-secondary px-4 border-b h-10! min-h-10 shrink-0">
				<span className="typo-label text-text-secondary">Preview</span>
				<HSComp.IconButton
					variant="ghost"
					aria-label="Close preview"
					icon={<X className="w-4 h-4" />}
					onClick={() => setPreviewMode(false)}
				/>
			</div>
			<div className="flex-1 overflow-y-auto pb-[400px]">
				<div className="mx-auto max-w-[990px] px-8 py-8">
					{notebook.name && (
						<h1 className="typo-page-header text-text-primary">
							{notebook.name}
						</h1>
					)}
					{notebook.description && (
						<p className="typo-body text-text-secondary mt-2">
							{notebook.description}
						</p>
					)}
					<div className="flex flex-col mt-7">
						{notebook.cells.map((cell) => (
							<CellView
								key={cell.id}
								cell={{
									id: cell.id,
									type: cell.type,
									value: cell.value,
									result: cell.result,
								}}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);

	return (
		<>
			<div className="h-full">
				{previewMode ? (
					<HSComp.ResizablePanelGroup
						direction="horizontal"
						autoSaveId="notebook-edit-preview"
					>
						<HSComp.ResizablePanel minSize={20}>
							{editorBody}
						</HSComp.ResizablePanel>
						<HSComp.ResizableHandle />
						<HSComp.ResizablePanel minSize={20}>
							{previewBody}
						</HSComp.ResizablePanel>
					</HSComp.ResizablePanelGroup>
				) : (
					editorBody
				)}
			</div>
			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				title="Delete notebook"
				description="This will permanently remove the notebook. This cannot be undone."
				confirmLabel="Delete"
				danger
				onConfirm={() => deleteMut.mutate()}
			/>
		</>
	);
}
