import * as HSComp from "@health-samurai/react-components";
import * as Lucide from "lucide-react";
import React from "react";
import { useLocalStorage } from "../../hooks";
import { CodeTabContent } from "./code-tab-content";
import { ViewDefinitionContext } from "./page";
import { ResourceTypeSelect } from "./resource-type-select";
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

	const handleSave = () => {
		console.log(viewDefinitionResource);
	};

	const handleRun = () => {
		console.log("run");
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
			<HSComp.TabsContent value="sql">SQL</HSComp.TabsContent>
			<EditorPanelActions />
		</HSComp.Tabs>
	);
};
