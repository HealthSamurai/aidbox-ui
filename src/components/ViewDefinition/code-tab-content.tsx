import * as HSComp from "@health-samurai/react-components";
import React from "react";
import { useDebounce } from "../../hooks";
import { CodeEditorMenubar } from "./code-editor-menubar";
import {
	ViewDefinitionContext,
	ViewDefinitionResourceTypeContext,
} from "./page";
import type { ViewDefinition } from "./types";

export const ViewDefinitionCodeEditor = () => {
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);
	const viewDefinitionResourceTypeContext = React.useContext(
		ViewDefinitionResourceTypeContext,
	);

	const resourceType =
		viewDefinitionResourceTypeContext.viewDefinitionResourceType;

	const [editorValue, setEditorValue] = React.useState<string>("");
	const EditorValueInitialized = React.useRef(false);

	React.useEffect(() => {
		if (
			viewDefinitionContext.viewDefinition &&
			!EditorValueInitialized.current
		) {
			setEditorValue(
				JSON.stringify(viewDefinitionContext.viewDefinition, null, 2),
			);
			EditorValueInitialized.current = true;
		}
	}, [viewDefinitionContext.viewDefinition]);

	React.useEffect(() => {
		if (resourceType && editorValue) {
			setEditorValue(
				JSON.stringify(
					{
						...JSON.parse(editorValue),
						resource: resourceType,
					},
					null,
					2,
				),
			);
		}
	}, [resourceType]);

	const debouncedSetViewDefinitionResourceType = useDebounce(
		(resourceType: string) => {
			viewDefinitionResourceTypeContext.setViewDefinitionResourceType(
				resourceType,
			);
		},
		500,
	);

	const debouncedSetViewDefinition = useDebounce(
		(viewDefinition: ViewDefinition) => {
			viewDefinitionContext.setViewDefinition(viewDefinition);
		},
		500,
	);

	const handleEditorValueChange = (value: string) => {
		setEditorValue(value);

		try {
			const parsedValue = JSON.parse(value);
			debouncedSetViewDefinitionResourceType(parsedValue.resource);
			if (
				JSON.stringify(parsedValue) !==
				JSON.stringify(viewDefinitionContext.viewDefinition)
			) {
				debouncedSetViewDefinition(parsedValue);
			}
		} catch (_error) {}
	};

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
		<div className="relative">
			<div className="sticky min-h-0 h-0 flex justify-end pt-2 pr-3 top-0 right-0 z-10">
				<CodeEditorMenubar
					mode="json"
					onModeChange={(_newMode) => {
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
