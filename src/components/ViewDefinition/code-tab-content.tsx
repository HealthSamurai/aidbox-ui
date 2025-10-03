import * as HSComp from "@health-samurai/react-components";
import * as yaml from "js-yaml";
import React from "react";
import { useDebounce } from "../../hooks";
import { CodeEditorMenubar } from "./code-editor-menubar";
import {
	ViewDefinitionContext,
	ViewDefinitionResourceTypeContext,
} from "./page";
import type { ViewDefinition, ViewDefinitionEditorMode } from "./types";

export const ViewDefinitionCodeEditor = ({
	codeMode,
}: {
	codeMode: ViewDefinitionEditorMode;
}) => {
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
		if (codeMode === "yaml") {
			setEditorValue(
				yaml.dump(viewDefinitionContext.viewDefinition, { indent: 2 }),
			);
		} else {
			setEditorValue(
				JSON.stringify(viewDefinitionContext.viewDefinition, null, 2),
			);
		}
	}, [codeMode]);

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
			mode={codeMode}
			onChange={handleEditorValueChange}
		/>
	);
};

export const CodeTabContent = () => {
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);
	const [codeMode, setCodeMode] =
		React.useState<ViewDefinitionEditorMode>("json");

	const stringifyViewDefinition = React.useCallback(
		(viewDefinition: ViewDefinition) => {
			if (codeMode === "yaml") {
				return yaml.dump(viewDefinition, { indent: 2 });
			}
			return JSON.stringify(viewDefinition, null, 2);
		},
		[codeMode],
	);

	const textToCopy = React.useMemo(() => {
		if (viewDefinitionContext.viewDefinition) {
			return stringifyViewDefinition(viewDefinitionContext.viewDefinition);
		} else {
			return "";
		}
	}, [viewDefinitionContext.viewDefinition, stringifyViewDefinition]);

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
					mode={codeMode}
					onModeChange={(newMode) => {
						setCodeMode(newMode);
					}}
					textToCopy={textToCopy}
					onFormat={() => {}}
				/>
			</div>
			<ViewDefinitionCodeEditor codeMode={codeMode} />
		</div>
	);
};
