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
import { AidboxCallWithMeta } from "../../api/auth";
import * as utils from "../../api/utils";

import { CodeTabContent } from "./editor-code-tab-content";
import { FormTabContent } from "./editor-form-tab-content";
import { ViewDefinitionContext } from "./page";
import { ResourceTypeSelect } from "./resource-type-select";
import { SQLTab } from "./sql-tab-content";
import type * as Types from "./types";

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

export const EditorPanelActions = () => {
	const navigate = useNavigate({ from: "/resource/$resourceType/create" });
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);
	const viewDefinitionResource = viewDefinitionContext.viewDefinition;

	const viewDefinitionMutation = useMutation({
		mutationFn: (viewDefinition: Types.ViewDefinition) => {
			return AidboxCallWithMeta({
				method: "PUT",
				url: `/fhir/ViewDefinition/${viewDefinitionContext.originalId}`,
				body: JSON.stringify(viewDefinition),
			});
		},
		onSuccess: () => {
			HSComp.toast.success("ViewDefinition saved successfully", {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
		},
		onError: utils.onError(),
	});

	const viewDefinitionCreateMutation = useMutation({
		mutationFn: (viewDefinition: Types.ViewDefinition) => {
			return AidboxCallWithMeta({
				method: "POST",
				url: `/fhir/ViewDefinition/`,
				body: JSON.stringify(viewDefinition),
			});
		},
		onSuccess: (resp) => {
			const id = JSON.parse(resp.body).id;
			navigate({
				to: "/resource/$resourceType/edit/$id",
				params: { resourceType: "ViewDefinition", id: id },
				search: { tab: "code", mode: "json" },
			});
		},
		onError: utils.onError(),
	});

	const viewDefinitionRunMutation = useMutation({
		mutationFn: (viewDefinition: Types.ViewDefinition) => {
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
			return AidboxCallWithMeta({
				method: "POST",
				url: "/fhir/ViewDefinition/$run",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/fhir+json",
				},
				body: JSON.stringify(parametersPayload),
			});
		},
		onSuccess: (data) => {
			const decodedData = atob(JSON.parse(data.body).data);
			viewDefinitionContext.setRunResult(decodedData);
			HSComp.toast.success("ViewDefinition run successfully", {
				position: "bottom-right",
				style: { margin: "1rem" },
			});
		},
		onError: utils.onError(),
	});

	const viewDefinitionMaterializeMutation = useMutation({
		mutationFn: ({
			viewDefinition,
			materializeType,
		}: {
			viewDefinition: Types.ViewDefinition;
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
			return AidboxCallWithMeta({
				method: "POST",
				url: "/fhir/ViewDefinition/$materialize",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/fhir+json",
				},
				body: JSON.stringify(parametersPayload),
			});
		},
		onSuccess: (data) => {
			const response = JSON.parse(data.body);
			const viewName =
				response.parameter?.find(
					(p: { name: string }) => p.name === "viewName",
				)?.valueString || "unknown";
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
		onError: utils.onError(),
	});

	const handleSave = () => {
		if (viewDefinitionResource) {
			viewDefinitionMutation.mutate(viewDefinitionResource);
		}
	};

	const handleRun = () => {
		if (viewDefinitionResource) {
			viewDefinitionRunMutation.mutate(viewDefinitionResource);
		}
	};

	const handleCreate = () => {
		if (viewDefinitionResource) {
			viewDefinitionCreateMutation.mutate(viewDefinitionResource);
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

	return (
		<div className="flex items-center justify-end gap-2 py-3 px-6 border-t">
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
		</div>
	);
};

export const EditorPanelContent = () => {
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
			<EditorPanelActions />
		</HSComp.Tabs>
	);
};
