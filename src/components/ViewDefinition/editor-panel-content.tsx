import * as HSComp from "@health-samurai/react-components";
import { useMutation } from "@tanstack/react-query";
import * as Lucide from "lucide-react";
import React from "react";
import { AidboxCallWithMeta } from "../../api/auth";
import { useLocalStorage } from "../../hooks";
import { CodeTabContent } from "./editor-code-tab-content";
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
			HSComp.toast.success("ViewDefinition saved successfully");
		},
		onError: () => {
			HSComp.toast.error("Failed to save ViewDefinition");
		},
	});

	const viewDefinitionRunMutation = useMutation({
		mutationFn: (viewDefinition: Types.ViewDefinition) => {
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
		onSuccess: () => {
			HSComp.toast.success("ViewDefinition run successfully");
		},
		onError: () => {
			HSComp.toast.error("Failed to run ViewDefinition");
		},
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

	return (
		<div className="flex items-center justify-end gap-2 py-3 px-6 border-t">
			<HSComp.Button variant="secondary" onClick={handleSave}>
				<Lucide.SaveIcon className="w-4 h-4" />
				Save
			</HSComp.Button>
			<HSComp.Button onClick={handleRun}>
				<Lucide.PlayIcon />
				Run
			</HSComp.Button>
		</div>
	);
};

export const EditorPanelContent = () => {
	const [selectedTab, setSelectedTab] =
		useLocalStorage<Types.ViewDefinitionEditorTab>({
			key: "view-definition-editor-tab-selected",
			getInitialValueInEffect: false,
			defaultValue: "form",
		});

	const handleOnTabSelect = (value: string) => {
		setSelectedTab(value as Types.ViewDefinitionEditorTab);
	};

	return (
		<HSComp.Tabs
			defaultValue={selectedTab}
			onValueChange={handleOnTabSelect}
			className="grow min-h-0"
		>
			<EditorHeaderMenu />
			<HSComp.TabsContent value="form">Form</HSComp.TabsContent>
			<HSComp.TabsContent value="code">
				<CodeTabContent />
			</HSComp.TabsContent>
			<SQLTab />
			<EditorPanelActions />
		</HSComp.Tabs>
	);
};
