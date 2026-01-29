import { closeCompletion, completionKeymap } from "@codemirror/autocomplete";
import { type Extension, Prec } from "@codemirror/state";
import {
	placeholder as cmPlaceholder,
	EditorView,
	keymap,
	tooltips,
} from "@codemirror/view";
import { EditorInput } from "@health-samurai/react-components";
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useDebounce } from "../../hooks";
import { useFhirPathLsp } from "./fhirpath-lsp-context";
import { ViewDefinitionResourceTypeContext } from "./page";

const tooltipConfig = tooltips({
	parent: document.body,
	position: "fixed",
});

const completionKeymapHighPrecedence = Prec.highest(
	keymap.of(
		completionKeymap.map((binding) => ({
			...binding,
			stopPropagation: true,
		})),
	),
);

const closeOnBlurExtension = EditorView.domEventHandlers({
	blur: (_event, view) => {
		closeCompletion(view);
		return false;
	},
});

// Handle Enter key - blur the editor instead of inserting a newline (single-line input)
const singleLineKeymap = keymap.of([
	{
		key: "Enter",
		run: (view) => {
			view.contentDOM.blur();
			return true;
		},
	},
]);

const stopArrowKeyPropagation = EditorView.domEventHandlers({
	keydown: (event) => {
		if (
			event.key === "ArrowLeft" ||
			event.key === "ArrowRight" ||
			event.key === "ArrowUp" ||
			event.key === "ArrowDown"
		) {
			event.stopPropagation();
		}
		return false;
	},
});

const fhirPathInputTheme = EditorView.theme({
	"&.cm-editor": {
		fontSize: "14px",
		color: "var(--color-text-primary)",
		height: "28px !important",
		maxHeight: "28px !important",
		paddingTop: "0 !important",
		paddingBottom: "0 !important",
		backgroundColor: "transparent !important",
	},
	"&.cm-editor .cm-scroller": {
		overflow: "hidden !important",
		fontFamily: "var(--font-family-sans)",
		lineHeight: "20px",
	},
	"&.cm-editor .cm-content": {
		backgroundColor: "var(--color-bg-primary)",
		border: "none !important",
		borderRadius: "var(--radius-md)",
		fontFamily: "var(--font-family-sans)",
		fontWeight: "var(--font-weight-normal)",
		height: "28px !important",
		minHeight: "28px !important",
		maxHeight: "28px !important",
		padding: "4px 8px !important",
		fontSize: "14px",
		lineHeight: "20px",
		boxSizing: "border-box",
		transition: "background-color 150ms",
	},
	".group\\/tree-item-label:hover &:not(.cm-focused) .cm-content": {
		backgroundColor: "var(--color-bg-tertiary)",
	},
	"&.cm-editor:hover:not(.cm-focused) .cm-content": {
		backgroundColor: "var(--color-bg-quaternary) !important",
	},
	"&.cm-editor.cm-focused": {
		outline: "none",
	},
	"&.cm-editor.cm-focused .cm-content": {
		backgroundColor: "var(--color-bg-primary)",
		border: "none !important",
		boxShadow: "inset 0 0 0 1px var(--color-border-link)",
		borderRadius: "var(--radius-md)",
		height: "28px !important",
		minHeight: "28px !important",
		maxHeight: "28px !important",
		padding: "4px 8px !important",
	},
	"&.cm-editor.cm-focused:hover .cm-content": {
		backgroundColor: "var(--color-bg-primary)",
	},
	"&.cm-editor .cm-line": {
		padding: "0",
		lineHeight: "20px",
	},
	"&.cm-editor .cm-placeholder": {
		color: "var(--color-text-tertiary)",
		lineHeight: "20px",
	},
	"&.cm-editor .cm-cursorLayer": {
		height: "20px",
	},
	".cm-tooltip": {
		zIndex: "9999 !important",
	},
	".cm-tooltip-autocomplete": {
		zIndex: "9999 !important",
	},
});

type FhirPathInputProps = {
	id: string;
	className?: string;
	value?: string;
	placeholder?: string;
	onChange?: (value: string) => void;
	/** The FHIRPath context for this input (e.g., "Patient.name") */
	contextPath: string;
};

export function FhirPathInput({
	id,
	className,
	value,
	placeholder,
	onChange,
	contextPath,
}: FhirPathInputProps) {
	const { createPlugin, setContextType } = useFhirPathLsp();
	const [localValue, setLocalValue] = useState(value || "");
	const wrapperRef = useRef<HTMLDivElement>(null);

	// Cache the LSP extension in a ref to prevent recreation on every render
	// Only create a new plugin if createPlugin becomes available
	const lspExtensionRef = useRef<Extension | null>(null);
	const lspExtension = useMemo(() => {
		const newExtension = createPlugin(`file:///${id}.fhirpath`);
		if (Array.isArray(newExtension) && newExtension.length === 0) {
			return lspExtensionRef.current ?? [];
		}
		lspExtensionRef.current = newExtension;
		return newExtension;
	}, [createPlugin, id]);

	useEffect(() => {
		setLocalValue(value || "");
	}, [value]);

	const debouncedOnChange = useDebounce((newValue: string) => {
		if (onChange && newValue !== value) {
			onChange(newValue);
		}
	}, 500);

	const handleChange = useCallback(
		(newValue: string) => {
			setLocalValue(newValue);
			debouncedOnChange(newValue);
		},
		[debouncedOnChange],
	);

	const handleFocus = useCallback(() => {
		setContextType(contextPath);
	}, [contextPath, setContextType]);

	const handleBlur = useCallback(() => {}, []);

	const additionalExtensionsRef = useRef<Extension[]>([]);
	const additionalExtensions = useMemo(() => {
		const newExtensions = [
			lspExtension,
			completionKeymapHighPrecedence,
			fhirPathInputTheme,
			tooltipConfig,
			closeOnBlurExtension,
			stopArrowKeyPropagation,
			singleLineKeymap,
			...(placeholder ? [cmPlaceholder(placeholder)] : []),
		];
		additionalExtensionsRef.current = newExtensions;
		return newExtensions;
	}, [lspExtension, placeholder]);

	useEffect(() => {
		const wrapper = wrapperRef.current;
		if (!wrapper) return;

		const onFocusIn = () => handleFocus();
		const onFocusOut = (e: FocusEvent) => {
			if (!wrapper.contains(e.relatedTarget as Node)) {
				handleBlur();
			}
		};

		wrapper.addEventListener("focusin", onFocusIn);
		wrapper.addEventListener("focusout", onFocusOut);

		return () => {
			wrapper.removeEventListener("focusin", onFocusIn);
			wrapper.removeEventListener("focusout", onFocusOut);
		};
	}, [handleFocus, handleBlur]);

	const wrapperClassName = `h-7 min-w-0 w-full overflow-hidden ${className || ""}`;

	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
			e.stopPropagation();
		}
	}, []);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: wrapper captures keyboard events to prevent TreeView navigation
		<div
			ref={wrapperRef}
			className={wrapperClassName}
			onKeyDown={handleKeyDown}
			onKeyDownCapture={handleKeyDown}
		>
			<EditorInput
				id={id}
				defaultValue={localValue}
				currentValue={localValue}
				onChange={handleChange}
				additionalExtensions={additionalExtensions}
			/>
		</div>
	);
}

type SelectItemForContext = {
	nodeId: string;
	type: "column" | "forEach" | "forEachOrNull" | "unionAll";
	expression?: string;
	children?: SelectItemForContext[];
};

/**
 * Computes the FHIRPath context for a given node in the select tree.
 *
 * The context is built by walking up the tree and collecting forEach/forEachOrNull
 * expressions along the path.
 *
 * @param resourceType - The base resource type (e.g., "Patient")
 * @param selectItems - The full select items tree
 * @param targetNodeId - The nodeId of the target field
 * @param includeTargetExpression - If true, includes the target node's expression
 *        (used for children of forEach nodes, not for the forEach expression itself)
 * @returns The computed context path (e.g., "Patient.name.given")
 */
export function computeFhirPathContext(
	resourceType: string | undefined,
	selectItems: SelectItemForContext[],
	targetNodeId: string,
	includeTargetExpression = false,
): string {
	if (!resourceType) return "";

	const pathToTarget = findPathToNode(selectItems, targetNodeId);
	if (!pathToTarget) return resourceType;

	const contextParts: string[] = [resourceType];

	for (const nodeId of pathToTarget) {
		const node = findNodeById(selectItems, nodeId);
		if (node && (node.type === "forEach" || node.type === "forEachOrNull")) {
			if (node.expression) {
				contextParts.push(node.expression);
			}
		}
	}

	if (includeTargetExpression) {
		const targetNode = findNodeById(selectItems, targetNodeId);
		if (
			targetNode &&
			(targetNode.type === "forEach" || targetNode.type === "forEachOrNull") &&
			targetNode.expression
		) {
			contextParts.push(targetNode.expression);
		}
	}

	return contextParts.join(".");
}

function findPathToNode(
	items: SelectItemForContext[],
	targetId: string,
	currentPath: string[] = [],
): string[] | null {
	for (const item of items) {
		if (item.nodeId === targetId) {
			return currentPath;
		}
		if (item.children) {
			const result = findPathToNode(item.children, targetId, [
				...currentPath,
				item.nodeId,
			]);
			if (result) return result;
		}
	}
	return null;
}

function findNodeById(
	items: SelectItemForContext[],
	targetId: string,
): SelectItemForContext | null {
	for (const item of items) {
		if (item.nodeId === targetId) {
			return item;
		}
		if (item.children) {
			const result = findNodeById(item.children, targetId);
			if (result) return result;
		}
	}
	return null;
}

export function useFhirPathContextForNode(
	selectItems: SelectItemForContext[],
	targetNodeId: string,
	includeTargetExpression = false,
): string {
	const { viewDefinitionResourceType } = React.useContext(
		ViewDefinitionResourceTypeContext,
	);

	return useMemo(
		() =>
			computeFhirPathContext(
				viewDefinitionResourceType,
				selectItems,
				targetNodeId,
				includeTargetExpression,
			),
		[
			viewDefinitionResourceType,
			selectItems,
			targetNodeId,
			includeTargetExpression,
		],
	);
}
