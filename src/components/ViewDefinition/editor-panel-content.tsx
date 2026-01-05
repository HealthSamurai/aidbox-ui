import type { ViewDefinition } from "@aidbox-ui/fhir-types/org-sql-on-fhir-ig";
import * as HSComp from "@health-samurai/react-components";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@health-samurai/react-components";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import * as Lucide from "lucide-react";
import React from "react";
import { type AidboxClientR5, useAidboxClient } from "../../AidboxClient";
import * as Utils from "../../api/utils";
import { CodeTabContent } from "./editor-code-tab-content";
import { FormTabContent } from "./editor-form-tab-content";
import { ViewDefinitionContext } from "./page";
import { ResourceTypeSelect } from "./resource-type-select";
import { SQLTab } from "./sql-tab-content";
import type * as Types from "./types";

const cleanEmptyValues = <T,>(obj: T): T => {
	if (Array.isArray(obj)) {
		const cleanedArray = obj
			.map((item) => cleanEmptyValues(item))
			.filter((item) => {
				if (item === null || item === undefined) return false;
				if (typeof item === "string" && item === "") return false;
				if (Array.isArray(item) && item.length === 0) return false;
				if (
					typeof item === "object" &&
					!Array.isArray(item) &&
					Object.keys(item).length === 0
				)
					return false;
				return true;
			});
		return cleanedArray as T;
	}

	if (obj !== null && typeof obj === "object") {
		const cleanedObj: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			const cleanedValue = cleanEmptyValues(value);
			if (cleanedValue === null || cleanedValue === undefined) continue;
			if (typeof cleanedValue === "string" && cleanedValue === "") continue;
			if (Array.isArray(cleanedValue) && cleanedValue.length === 0) continue;
			if (
				typeof cleanedValue === "object" &&
				!Array.isArray(cleanedValue) &&
				Object.keys(cleanedValue).length === 0
			)
				continue;
			cleanedObj[key] = cleanedValue;
		}
		return cleanedObj as T;
	}

	return obj;
};

export const EditorHeaderMenu = () => {
	return (
		<div className="flex items-center justify-between gap-4 bg-bg-secondary px-6 border-b h-10 flex-none">
			<div className="flex items-center gap-3">
				<span className="typo-label text-text-secondary text-nowrap">
					View Definition:
				</span>
				<HSComp.TabsList>
					<HSComp.TabsTrigger value="form">Form</HSComp.TabsTrigger>
					<HSComp.TabsTrigger value="code">Code</HSComp.TabsTrigger>
					<HSComp.TabsTrigger value="sql">SQL</HSComp.TabsTrigger>
				</HSComp.TabsList>
			</div>
			<div className="flex items-center gap-2">
				<span className="typo-label text-text-secondary text-nowrap">
					Resource type:
				</span>
				<ResourceTypeSelect />
			</div>
		</div>
	);
};

type RunResult = {
	contentType: string;
	data: string;
};

export const EditorPanelActions = ({ client }: { client: AidboxClientR5 }) => {
	const navigate = useNavigate({ from: "/resource/$resourceType/create" });
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);
	const viewDefinitionResource = viewDefinitionContext.viewDefinition;
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

	const viewDefinitionMutation = useMutation({
		mutationFn: (viewDefinition: ViewDefinition) => {
			if (viewDefinitionContext.originalId)
				return client.update({
					type: "ViewDefinition",
					id: viewDefinitionContext.originalId,
					resource: viewDefinition,
				});
			throw Error("missing originalId in the ViewDefinitionContext");
		},
		onSuccess: (result) => {
			if (result.isErr())
				return Utils.toastOperationOutcome(result.value.resource);

			viewDefinitionContext.setIsDirty(false);
			HSComp.toast.success("ViewDefinition saved successfully", {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
		},
		onError: Utils.onMutationError,
	});

	const viewDefinitionCreateMutation = useMutation({
		mutationFn: (viewDefinition: ViewDefinition) => {
			return client.create<ViewDefinition>({
				type: "ViewDefinition",
				resource: viewDefinition,
			});
		},
		onSuccess: (result) => {
			if (result.isErr())
				return Utils.toastOperationOutcome(result.value.resource);

			viewDefinitionContext.setIsDirty(false);
			const id = result.value.resource.id;
			if (!id)
				return Utils.toastError(
					"Error saving ViewDefinition",
					"Missing an ID field in response",
				);

			navigate({
				to: "/resource/$resourceType/edit/$id",
				params: { resourceType: "ViewDefinition", id: id },
				search: { tab: "code", mode: "json" },
			});
		},
		onError: Utils.onMutationError,
	});

	const viewDefinitionRunMutation = useMutation({
		mutationFn: (viewDefinition: ViewDefinition) => {
			viewDefinitionContext.setRunResultPage(1);
			viewDefinitionContext.setRunViewDefinition(viewDefinition);

			const parametersPayload = {
				resourceType: "Parameters",
				parameter: [
					{
						name: "viewResource",
						resource: viewDefinition,
					},
					{
						name: "_format",
						valueCode: "json",
					},
					{
						name: "_limit",
						valueInteger: viewDefinitionContext.runResultPageSize,
					},
					{
						name: "_page",
						valueInteger: 1,
					},
				],
			};
			return client.request<RunResult>({
				method: "POST",
				url: "/fhir/ViewDefinition/$run",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/fhir+json",
				},
				body: JSON.stringify(parametersPayload),
			});
		},
		onSuccess: async (result) => {
			if (result.isErr()) {
				Utils.toastOperationOutcome(result.value.resource);
			} else {
				const { data } = result.value.resource;
				const decodedData = atob(data);
				viewDefinitionContext.setRunResult(decodedData);
				HSComp.toast.success("ViewDefinition run successfully", {
					position: "bottom-right",
					style: { margin: "1rem" },
				});
			}
		},
		onError: Utils.onMutationError,
	});

	const viewDefinitionMaterializeMutation = useMutation({
		mutationFn: ({
			viewDefinition,
			materializeType,
		}: {
			viewDefinition: ViewDefinition;
			materializeType: "view" | "materialized-view" | "table";
		}) => {
			const parametersPayload = {
				resourceType: "Parameters",
				parameter: [
					{
						name: "type",
						valueCode: materializeType,
					},
					{
						name: "viewResource",
						resource: viewDefinition,
					},
				],
			};
			return client.rawRequest({
				method: "POST",
				url: "/fhir/ViewDefinition/$materialize",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/fhir+json",
				},
				body: JSON.stringify(parametersPayload),
			});
		},
		onSuccess: async (data) => {
			const response = await data.response.json();
			const viewName =
				response.parameter?.find((p: { name: string }) => p.name === "viewName")
					?.valueString || "unknown";
			HSComp.toast.success(
				<div className="flex items-center gap-2">
					<span>Materialized: {viewName}</span>
					<button
						type="button"
						className="p-1 hover:bg-white/20 rounded"
						onClick={() => {
							navigator.clipboard.writeText(viewName);
							HSComp.toast.success("Copied to clipboard", {
								position: "bottom-right",
								style: { margin: "1rem" },
							});
						}}
					>
						<Lucide.CopyIcon className="w-4 h-4" />
					</button>
				</div>,
				{
					position: "bottom-right",
					style: { margin: "1rem" },
				},
			);
		},
		onError: Utils.onError,
	});

	const viewDefinitionDeleteMutation = useMutation({
		mutationFn: () => {
			if (!viewDefinitionContext.originalId)
				throw Error("can't delete without ID");

			return client.delete({
				type: "ViewDefinition",
				id: viewDefinitionContext.originalId,
			});
		},
		onSuccess: () => {
			HSComp.toast.success("ViewDefinition deleted successfully", {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
			navigate({
				to: "/resource/$resourceType",
				params: { resourceType: "ViewDefinition" },
			});
		},
		onError: Utils.onError,
	});

	const handleSave = () => {
		if (viewDefinitionResource) {
			const cleanedViewDefinition = cleanEmptyValues(viewDefinitionResource);
			viewDefinitionMutation.mutate(cleanedViewDefinition);
		}
	};

	const handleRun = () => {
		if (viewDefinitionResource) {
			viewDefinitionRunMutation.mutate(viewDefinitionResource);
		}
	};

	const handleCreate = () => {
		if (viewDefinitionResource) {
			const cleanedViewDefinition = cleanEmptyValues(viewDefinitionResource);
			viewDefinitionCreateMutation.mutate(cleanedViewDefinition);
		}
	};

	const handleMaterialize = (
		materializeType: "view" | "materialized-view" | "table",
	) => {
		if (viewDefinitionResource) {
			viewDefinitionMaterializeMutation.mutate({
				viewDefinition: viewDefinitionResource,
				materializeType,
			});
		}
	};

	const handleDelete = () => {
		viewDefinitionDeleteMutation.mutate();
	};

	return (
		<div className="flex items-center justify-end gap-2 py-3 px-6 border-t">
			{viewDefinitionContext.originalId && (
				<HSComp.Button
					variant="ghost"
					danger
					className="mr-auto"
					onClick={() => setIsDeleteDialogOpen(true)}
				>
					<Lucide.Trash2Icon className="w-4 h-4" />
					Delete
				</HSComp.Button>
			)}
			<HSComp.Button onClick={handleRun}>
				<Lucide.PlayIcon />
				Run
			</HSComp.Button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<HSComp.Button variant="secondary">
						<Lucide.DatabaseIcon className="w-4 h-4" />
						Materialize
						<Lucide.ChevronDownIcon className="w-4 h-4" />
					</HSComp.Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onSelect={() => handleMaterialize("view")}>
						View
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() => handleMaterialize("materialized-view")}
					>
						Materialized View
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => handleMaterialize("table")}>
						Table
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			{viewDefinitionContext.originalId ? (
				<HSComp.Button variant="secondary" onClick={handleSave}>
					<Lucide.SaveIcon className="w-4 h-4" />
					Save
				</HSComp.Button>
			) : (
				<HSComp.Button variant="secondary" onClick={handleCreate}>
					<Lucide.SaveIcon className="w-4 h-4" />
					Create
				</HSComp.Button>
			)}

			<HSComp.AlertDialog
				open={isDeleteDialogOpen}
				onOpenChange={setIsDeleteDialogOpen}
			>
				<HSComp.AlertDialogContent>
					<HSComp.AlertDialogHeader>
						<HSComp.AlertDialogTitle>
							Delete ViewDefinition?
						</HSComp.AlertDialogTitle>
						<HSComp.AlertDialogDescription>
							Are you sure you want to delete this ViewDefinition? This action
							cannot be undone.
						</HSComp.AlertDialogDescription>
					</HSComp.AlertDialogHeader>
					<HSComp.AlertDialogFooter>
						<HSComp.AlertDialogCancel>Cancel</HSComp.AlertDialogCancel>
						<HSComp.AlertDialogAction
							variant="primary"
							danger
							onClick={() => {
								handleDelete();
								setIsDeleteDialogOpen(false);
							}}
						>
							<Lucide.Trash2Icon className="w-4 h-4" />
							Delete
						</HSComp.AlertDialogAction>
					</HSComp.AlertDialogFooter>
				</HSComp.AlertDialogContent>
			</HSComp.AlertDialog>
		</div>
	);
};

export const EditorPanelContent = () => {
	const aidboxClient: AidboxClientR5 = useAidboxClient();

	const navigate = useNavigate();

	const createSearch = useSearch({
		from: "/resource/ViewDefinition/create",
		shouldThrow: false,
	});
	const editSearch = useSearch({
		from: "/resource/ViewDefinition/edit/$id",
		shouldThrow: false,
	});
	const search = createSearch || editSearch;
	if (search === undefined) {
		console.error("createSearch and editSearch are undefined");
		return <div>FAILED DUE TO UNDEFINED SEARCH</div>;
	}
	const { tab: selectedTab } = search;

	const handleOnTabSelect = (value: Types.ViewDefinitionEditorTab) => {
		navigate({
			from:
				createSearch !== undefined
					? "/resource/ViewDefinition/create"
					: "/resource/ViewDefinition/edit/$id",
			search: { tab: value },
		});
	};

	return (
		<HSComp.Tabs
			defaultValue={selectedTab}
			onValueChange={handleOnTabSelect}
			className="grow min-h-0"
		>
			<EditorHeaderMenu />
			<HSComp.TabsContent
				value={"form"}
				className="py-1 px-2.5 data-[state=inactive]:hidden"
				forceMount
			>
				<FormTabContent />
			</HSComp.TabsContent>
			<HSComp.TabsContent value={"code"}>
				<CodeTabContent />
			</HSComp.TabsContent>
			<SQLTab />
			<EditorPanelActions client={aidboxClient} />
		</HSComp.Tabs>
	);
};
