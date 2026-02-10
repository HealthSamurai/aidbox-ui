import type { ViewDefinition } from "@aidbox-ui/fhir-types/org-sql-on-fhir-ig";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import * as HSComp from "@health-samurai/react-components";
import type { CodeEditorView } from "@health-samurai/react-components";
import * as yaml from "js-yaml";
import React from "react";
import { findJsonPathOffset } from "../../utils/json-path-offset";
import { useDebounce, useLocalStorage } from "../../hooks";
import { CodeEditorMenubar } from "./code-editor-menubar";
import {
	ViewDefinitionContext,
	ViewDefinitionResourceTypeContext,
} from "./page";
import type { ViewDefinitionEditorMode } from "./types";

export const ViewDefinitionCodeEditor = ({
	codeMode,
	editorValue,
	setEditorValue,
	viewCallback,
}: {
	codeMode: ViewDefinitionEditorMode;
	editorValue: string;
	setEditorValue: (value: string) => void;
	viewCallback?: (view: CodeEditorView) => void;
}) => {
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);
	const viewDefinitionResourceTypeContext = React.useContext(
		ViewDefinitionResourceTypeContext,
	);

	const debouncedSetViewDefinitionResourceType = useDebounce(
		(resourceType: string) => {
			if (
				resourceType !==
				viewDefinitionResourceTypeContext.viewDefinitionResourceType
			) {
				viewDefinitionResourceTypeContext.setViewDefinitionResourceType(
					resourceType,
				);
			}
		},
		500,
	);

	const debouncedSetViewDefinition = useDebounce(
		(viewDefinition: ViewDefinition) => {
			if (
				JSON.stringify(viewDefinition) !==
				JSON.stringify(viewDefinitionContext.viewDefinition)
			) {
				viewDefinitionContext.setViewDefinition(viewDefinition);
				viewDefinitionContext.setIsDirty(true);
			}
		},
		500,
	);

	const handleEditorValueChange = (value: string) => {
		setEditorValue(value);
		try {
			const parsedValue =
				codeMode === "json" ? JSON.parse(value) : yaml.load(value);
			debouncedSetViewDefinitionResourceType(parsedValue.resource);
			debouncedSetViewDefinition(parsedValue);
		} catch (_error) {}
	};

	return (
		<HSComp.CodeEditor
			currentValue={editorValue}
			mode={codeMode}
			onChange={handleEditorValueChange}
			viewCallback={viewCallback}
		/>
	);
};

export const CodeTabContent = () => {
	const viewDefinitionContext = React.useContext(ViewDefinitionContext);
	const viewDefinitionResourceTypeContext = React.useContext(
		ViewDefinitionResourceTypeContext,
	);

	const editorViewRef = React.useRef<CodeEditorView | null>(null);
	const handleViewCallback = React.useCallback(
		(view: CodeEditorView) => {
			editorViewRef.current = view;
		},
		[],
	);

	const [codeMode, setCodeMode] = useLocalStorage<ViewDefinitionEditorMode>({
		key: "viewDefinition.codeMode",
		getInitialValueInEffect: false,
		defaultValue: "json",
	});

	const stringifyViewDefinition = React.useCallback(
		(viewDefinition: ViewDefinition) => {
			if (codeMode === "yaml") {
				return yaml.dump(viewDefinition, { indent: 2 });
			}
			return JSON.stringify(viewDefinition, null, 2);
		},
		[codeMode],
	);

	const [editorValue, setEditorValue] = React.useState<string>(() => {
		if (
			viewDefinitionContext.viewDefinition &&
			viewDefinitionResourceTypeContext.viewDefinitionResourceType
		) {
			return stringifyViewDefinition({
				...viewDefinitionContext.viewDefinition,
				resource: viewDefinitionResourceTypeContext.viewDefinitionResourceType,
			});
		}
		return "";
	});

	const [isInitialized, setIsInitialized] = React.useState(false);

	// necessary due to the async data fetching
	React.useEffect(() => {
		if (
			!isInitialized &&
			viewDefinitionContext.viewDefinition &&
			viewDefinitionResourceTypeContext.viewDefinitionResourceType
		) {
			setEditorValue(
				stringifyViewDefinition({
					...viewDefinitionContext.viewDefinition,
					resource:
						viewDefinitionResourceTypeContext.viewDefinitionResourceType,
				}),
			);
			setIsInitialized(true);
		}
	}, [
		isInitialized,
		viewDefinitionContext.viewDefinition,
		viewDefinitionResourceTypeContext.viewDefinitionResourceType,
		stringifyViewDefinition,
	]);

	// Track resource type changes from the dropdown after initialization
	const prevResourceTypeRef = React.useRef<string | undefined>(
		viewDefinitionResourceTypeContext.viewDefinitionResourceType,
	);

	React.useEffect(() => {
		const newResourceType =
			viewDefinitionResourceTypeContext.viewDefinitionResourceType;
		if (
			isInitialized &&
			newResourceType &&
			prevResourceTypeRef.current !== newResourceType
		) {
			prevResourceTypeRef.current = newResourceType;
			try {
				const parsed =
					codeMode === "json"
						? JSON.parse(editorValue)
						: (yaml.load(editorValue) as ViewDefinition);
				if (parsed.resource !== newResourceType) {
					parsed.resource = newResourceType;
					setEditorValue(stringifyViewDefinition(parsed));
				}
			} catch {
				// If parsing fails, we can't update
			}
		}
	}, [
		isInitialized,
		viewDefinitionResourceTypeContext.viewDefinitionResourceType,
		codeMode,
		editorValue,
		stringifyViewDefinition,
	]);

	const textToCopy = React.useMemo(() => {
		if (viewDefinitionContext.viewDefinition) {
			return stringifyViewDefinition(viewDefinitionContext.viewDefinition);
		} else {
			return "";
		}
	}, [viewDefinitionContext.viewDefinition, stringifyViewDefinition]);

	const formatCode = (
		editorValue: string,
		codeMode: ViewDefinitionEditorMode,
	) => {
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

	const handleModeChange = (newMode: ViewDefinitionEditorMode) => {
		try {
			const parsed =
				codeMode === "json" ? JSON.parse(editorValue) : yaml.load(editorValue);
			const newValue =
				newMode === "yaml"
					? yaml.dump(parsed, { indent: 2 })
					: JSON.stringify(parsed, null, 2);
			setEditorValue(newValue);
		} catch {
			// If parsing fails, we keep the current value
		}
		setCodeMode(newMode);
	};

	viewDefinitionContext.issueClickRef.current = (issue) => {
		const view = editorViewRef.current;
		if (!view || codeMode !== "json" || !issue.expression?.length) return;
		const offset = findJsonPathOffset(
			view.state.doc.toString(),
			issue.expression[0],
		);
		if (offset == null) return;
		view.dispatch({
			selection: EditorSelection.cursor(offset),
			effects: EditorView.scrollIntoView(offset, { y: "center" }),
		});
		view.focus();
	};

	if (
		viewDefinitionContext.isLoadingViewDef ||
		!viewDefinitionContext.viewDefinition ||
		!viewDefinitionResourceTypeContext.viewDefinitionResourceType
	) {
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
			<div className="sticky min-h-0 h-0 flex justify-end pr-3 top-0 right-0 z-10">
				<CodeEditorMenubar
					mode={codeMode}
					onModeChange={handleModeChange}
					textToCopy={textToCopy}
					onFormat={() => {
						setEditorValue(formatCode(editorValue, codeMode));
					}}
				/>
			</div>
			<ViewDefinitionCodeEditor
				codeMode={codeMode}
				editorValue={editorValue}
				setEditorValue={setEditorValue}
				viewCallback={handleViewCallback}
			/>
		</div>
	);
};
