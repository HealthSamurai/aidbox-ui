import * as HSComp from "@health-samurai/react-components";
import * as yaml from "js-yaml";
import React from "react";
import { useDebounce, useLocalStorage } from "../../hooks";
import { CodeEditorMenubar } from "./code-editor-menubar";
import { ViewDefinitionContext, ViewDefinitionResourceTypeContext } from "./page";
import type { ViewDefinition, ViewDefinitionEditorMode } from "./types";

export const ViewDefinitionCodeEditor = ({
	codeMode,
	editorValue,
	setEditorValue,
}: {
	codeMode: ViewDefinitionEditorMode;
	editorValue: string;
	setEditorValue: (value: string) => void;
}) => {
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);
	const viewDefinitionResourceTypeContext = React.useContext(ViewDefinitionResourceTypeContext);

	const debouncedSetViewDefinitionResourceType = useDebounce((resourceType: string) => {
		if (resourceType !== viewDefinitionResourceTypeContext.viewDefinitionResourceType) {
			viewDefinitionResourceTypeContext.setViewDefinitionResourceType(resourceType);
		}
	}, 500);

	const debouncedSetViewDefinition = useDebounce((viewDefinition: ViewDefinition) => {
		if (JSON.stringify(viewDefinition) !== JSON.stringify(viewDefinitionContext.viewDefinition)) {
			viewDefinitionContext.setViewDefinition(viewDefinition);
		}
	}, 500);

	const handleEditorValueChange = (value: string) => {
		setEditorValue(value);
		try {
			const parsedValue = codeMode === "json" ? JSON.parse(value) : yaml.load(value);
			debouncedSetViewDefinitionResourceType(parsedValue.resource);
			debouncedSetViewDefinition(parsedValue);
		} catch (_error) {}
	};

	return <HSComp.CodeEditor currentValue={editorValue} mode={codeMode} onChange={handleEditorValueChange} />;
};

export const CodeTabContent = () => {
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);
	const viewDefinitionResourceTypeContext = React.useContext(ViewDefinitionResourceTypeContext);

	const [codeMode, setCodeMode] = useLocalStorage<ViewDefinitionEditorMode>({
		key: "viewDefinition.codeMode",
		getInitialValueInEffect: false,
		defaultValue: "json",
	});

	const [editorValue, setEditorValue] = React.useState<string>("");

	const stringifyViewDefinition = React.useCallback(
		(viewDefinition: ViewDefinition) => {
			if (codeMode === "yaml") {
				return yaml.dump(viewDefinition, { indent: 2 });
			}
			return JSON.stringify(viewDefinition, null, 2);
		},
		[codeMode],
	);

	React.useEffect(() => {
		if (viewDefinitionContext.viewDefinition && viewDefinitionResourceTypeContext.viewDefinitionResourceType) {
			setEditorValue(
				stringifyViewDefinition({
					...viewDefinitionContext.viewDefinition,
					resource: viewDefinitionResourceTypeContext.viewDefinitionResourceType,
				}),
			);
		}
	}, [
		viewDefinitionContext.viewDefinition,
		viewDefinitionResourceTypeContext.viewDefinitionResourceType,
		stringifyViewDefinition,
	]);

	const textToCopy = React.useMemo(() => {
		if (viewDefinitionContext.viewDefinition) {
			return stringifyViewDefinition(viewDefinitionContext.viewDefinition);
		} else {
			return "";
		}
	}, [viewDefinitionContext.viewDefinition, stringifyViewDefinition]);

	const formatCode = (editorValue: string, codeMode: ViewDefinitionEditorMode) => {
		const formattedValue =
			codeMode === "yaml"
				? yaml.dump(yaml.load(editorValue), { indent: 2 })
				: JSON.stringify(JSON.parse(editorValue), null, 2);
		HSComp.toast.success("Code formatted", {
			position: "bottom-right",
			style: { margin: "1rem" },
		});
		return formattedValue;
	};

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
		<div className="relative h-full">
			<div className="sticky min-h-0 h-0 flex justify-end pt-2 pr-3 top-0 right-0 z-10">
				<CodeEditorMenubar
					mode={codeMode}
					onModeChange={(newMode) => {
						setCodeMode(newMode);
					}}
					textToCopy={textToCopy}
					onFormat={() => {
						setEditorValue(formatCode(editorValue, codeMode));
					}}
				/>
			</div>
			<ViewDefinitionCodeEditor codeMode={codeMode} editorValue={editorValue} setEditorValue={setEditorValue} />
		</div>
	);
};
