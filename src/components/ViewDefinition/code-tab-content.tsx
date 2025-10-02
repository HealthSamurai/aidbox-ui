import * as HSComp from "@health-samurai/react-components";
import React from "react";
import { CodeEditorMenubar } from "./code-editor-menubar";
import {
	ViewDefinitionContext,
	ViewDefinitionResourceTypeContext,
} from "./page";

export const ViewDefinitionCodeEditor = () => {
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);
	const viewDefinitionResourceTypeContext = React.useContext(
		ViewDefinitionResourceTypeContext,
	);

	const [editorValue, setEditorValue] = React.useState<string>("");

	const handleEditorValueChange = (value: string) => {
		setEditorValue(value);

		const debounceTimeoutRef = (ViewDefinitionCodeEditor as any)
			.debounceTimeoutRef || { current: null };
		(ViewDefinitionCodeEditor as any).debounceTimeoutRef = debounceTimeoutRef;

		if (debounceTimeoutRef.current) {
			clearTimeout(debounceTimeoutRef.current);
		}
		debounceTimeoutRef.current = setTimeout(() => {
			viewDefinitionResourceTypeContext.setViewDefinitionResourceType(
				JSON.parse(value).resource,
			);
		}, 300);
	};

	React.useEffect(() => {
		if (viewDefinitionContext.viewDefinition) {
			setEditorValue(
				JSON.stringify(viewDefinitionContext.viewDefinition, null, 2),
			);
		}
	}, [viewDefinitionContext.viewDefinition]);

	return (
		<HSComp.CodeEditor
			currentValue={editorValue}
			mode="json"
			onChange={handleEditorValueChange}
			//mode={codeMode === "yaml" ? "yaml" : "json"}
		/>
	);
};

export const CodeTabContent = () => {
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);

	if (viewDefinitionContext.isLoadingViewDef) {
		return (
			<div className="flex items-center justify-center h-full text-text-secondary">
				<div className="text-center">
					<div className="text-lg mb-2">Loading ViewDefinition...</div>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full overflow-hidden relative">
			<div className="absolute top-2 right-3 z-10">
				<CodeEditorMenubar
					mode="json"
					onModeChange={(newMode) => {
						// Handle mode change
					}}
					textToCopy={
						viewDefinitionContext.viewDefinition
							? JSON.stringify(viewDefinitionContext.viewDefinition, null, 2)
							: ""
					}
					onFormat={() => {
						// Handle format
					}}
				/>
			</div>
			<ViewDefinitionCodeEditor />
		</div>
	);
};
