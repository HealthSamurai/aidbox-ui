import * as HSComp from "@health-samurai/react-components";
import React from "react";
import { useLocalStorage } from "../../hooks";
import { CodeTabContent } from "./code-tab-content";
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
		<HSComp.Tabs defaultValue={selectedTab} onValueChange={handleOnTabSelect}>
			<EditorHeaderMenu />
			<HSComp.TabsContent value="form">Form</HSComp.TabsContent>
			<HSComp.TabsContent value="code">
				<CodeTabContent />
			</HSComp.TabsContent>
			<HSComp.TabsContent value="sql">SQL</HSComp.TabsContent>
		</HSComp.Tabs>
	);
};
