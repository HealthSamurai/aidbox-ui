import { Tabs, TabsList, TabsTrigger } from "@health-samurai/react-components";
import React from "react";
import { useLocalStorage } from "../../hooks";
import { ResourceTypeSelect } from "./resource-type-select";
import type * as Types from "./types";

export const ViewDefinitionEditorContext =
	React.createContext<Types.ViewDefinitionEditorContextProps>({
		selectedTab: "form",
		setSelectedTab: () => {},
	});

export const EditorTabs = () => {
	const viewDefinitionEditorContext = React.useContext(
		ViewDefinitionEditorContext,
	);

	const handleOnTabSelect = (value: string) => {
		viewDefinitionEditorContext.setSelectedTab(
			value as Types.ViewDefinitionEditorTab,
		);
	};

	return (
		<Tabs
			defaultValue={viewDefinitionEditorContext.selectedTab}
			onValueChange={handleOnTabSelect}
		>
			<TabsList>
				<TabsTrigger value="form">Form</TabsTrigger>
				<TabsTrigger value="code">Code</TabsTrigger>
				<TabsTrigger value="sql">SQL</TabsTrigger>
			</TabsList>
		</Tabs>
	);
};

export const EditorHeaderMenu = () => {
	return (
		<div className="flex items-center justify-between gap-4 bg-bg-secondary px-6 border-b h-10">
			<div className="flex items-center gap-3">
				<span className="typo-label text-text-secondary text-nowrap">
					View Definition:
				</span>
				<EditorTabs />
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

	return (
		<ViewDefinitionEditorContext.Provider
			value={{ selectedTab, setSelectedTab }}
		>
			<EditorHeaderMenu />
		</ViewDefinitionEditorContext.Provider>
	);
};
