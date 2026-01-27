import { closeCompletion, completionKeymap } from "@codemirror/autocomplete";
import { type Extension, Prec } from "@codemirror/state";
import { EditorView, keymap, tooltips } from "@codemirror/view";
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

const fhirPathInputTheme = EditorView.theme({
	"&": {
		fontSize: "14px",
		height: "28px !important",
		maxHeight: "28px !important",
		paddingTop: "0 !important",
		paddingBottom: "0 !important",
		backgroundColor: "transparent !important",
	},
	"&.cm-editor": {
		fontSize: "14px",
		color: "var(--color-text-primary)",
		height: "28px !important",
		maxHeight: "28px !important",
		paddingTop: "0 !important",
		paddingBottom: "0 !important",
	},
	".cm-scroller": {
		overflow: "hidden !important",
		fontFamily: "var(--font-family-sans)",
		lineHeight: "20px",
	},
	".cm-content": {
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
	".cm-line": {
		padding: "0",
		lineHeight: "20px",
	},
	".cm-placeholder": {
		color: "var(--color-text-tertiary)",
		lineHeight: "20px",
	},
	".cm-cursorLayer": {
		height: "20px",
	},
	// Ensure autocomplete tooltip appears above other UI elements (tree-view uses z-100)
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
	onChange?: (value: string) => void;
	/** The FHIRPath context for this input (e.g., "Patient.name") */
	contextPath: string;
};

export function FhirPathInput({
	id,
	className,
	value,
	onChange,
	contextPath,
}: FhirPathInputProps) {
	const { createPlugin, setContextType } = useFhirPathLsp();
	const [localValue, setLocalValue] = useState(value || "");
	const wrapperRef = useRef<HTMLDivElement>(null);

	// Cache the LSP extension in a ref to prevent recreation on every render
	// Only create a new plugin if createPlugin becomes available (non-empty result)
	const lspExtensionRef = useRef<Extension | null>(null);
	const lspExtension = useMemo(() => {
		const newExtension = createPlugin(`file:///${id}.fhirpath`);
		// Only update if we get a valid extension (non-empty array means LSP is ready)
		if (Array.isArray(newExtension) && newExtension.length === 0) {
			// LSP not ready yet, return cached or empty
			return lspExtensionRef.current ?? [];
		}
		// LSP is ready, cache and return
		lspExtensionRef.current = newExtension;
		return newExtension;
	}, [createPlugin, id]);

	// Sync local value with prop
	useEffect(() => {
		setLocalValue(value || "");
	}, [value]);

	// Debounced onChange callback
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

	// Update LSP context when this input is focused
	const handleFocus = useCallback(() => {
		setContextType(contextPath);
	}, [contextPath, setContextType]);

	const handleBlur = useCallback(() => {
		// No-op for now, but keeping for potential future use
	}, []);

	// Combine extensions: LSP + custom theme + tooltip config + autocompletion override
	// Note: We use a ref to keep a stable array reference and only update when lspExtension changes
	const additionalExtensionsRef = useRef<Extension[]>([]);
	const additionalExtensions = useMemo(() => {
		// Only recreate the array if lspExtension actually changed
		const newExtensions = [
			lspExtension,
			completionKeymapHighPrecedence,
			fhirPathInputTheme,
			tooltipConfig,
			closeOnBlurExtension,
		];
		additionalExtensionsRef.current = newExtensions;
		return newExtensions;
	}, [lspExtension]);

	// Handle focus/blur via wrapper div events
	useEffect(() => {
		const wrapper = wrapperRef.current;
		if (!wrapper) return;

		const onFocusIn = () => handleFocus();
		const onFocusOut = (e: FocusEvent) => {
			// Only blur if focus is leaving the wrapper entirely
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

	// min-w-0 allows flex item to shrink below content size
	// w-full makes it take available width
	// overflow-hidden ensures content is clipped to wrapper height
	const wrapperClassName = `h-7 min-w-0 w-full overflow-hidden ${className || ""}`;

	return (
		<div ref={wrapperRef} className={wrapperClassName}>
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

// Helper type for building context paths
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

	// Find the path of nodeIds from root to target
	const pathToTarget = findPathToNode(selectItems, targetNodeId);
	if (!pathToTarget) return resourceType;

	// Build context by collecting forEach/forEachOrNull expressions along the path
	const contextParts: string[] = [resourceType];

	for (const nodeId of pathToTarget) {
		const node = findNodeById(selectItems, nodeId);
		if (node && (node.type === "forEach" || node.type === "forEachOrNull")) {
			if (node.expression) {
				contextParts.push(node.expression);
			}
		}
	}

	// If we should include the target's own expression (for column paths inside forEach)
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

/**
 * Finds the path of nodeIds from root to a target node (excluding the target itself)
 */
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

/**
 * Finds a node by its ID in the tree
 */
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

/**
 * Hook to compute FHIRPath context for a node
 */
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
