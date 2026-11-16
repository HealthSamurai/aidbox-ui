import type { OperationOutcomeIssue } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import { useExpandValueSet } from "@aidbox-ui/hooks/useExpandValueSet";
import { useGetStructureDefinitions } from "@aidbox-ui/hooks/useGetStructureDefinition";
import type { CodeEditorView } from "@health-samurai/react-components";
import {
	type ComponentProps,
	type ReactNode,
	useEffect,
	useState,
} from "react";
import { EditorTab } from "../../../ResourceEditor/editor-tab";
import { CodeEditorCopyButton } from "../../../ViewDefinition/code-editor-menubar";
import {
	findIssueTextRange,
	getIssueExpression,
} from "../pages/questionnaires/issue-location";
import { SDC_VALUE_SET_EXPAND } from "./const";
import type { ResourceFormat } from "./resource-format";

export function ResourceEditorContent({
	mode,
	children,
	...props
}: ComponentProps<typeof ResourceCodeEditor> & {
	mode: string;
	children: ReactNode;
}) {
	return mode === "code" ? <ResourceCodeEditor {...props} /> : children;
}

/** Aidbox's resource editor pane, which also puts the caret on a clicked issue. */
export function ResourceCodeEditor({
	resourceType,
	value,
	onChange,
	onFormat,
	language,
	onLanguageChange,
	focusIssue,
}: {
	resourceType: string;
	value: string;
	onChange: (text: string) => void;
	onFormat: () => void;
	language: ResourceFormat;
	onLanguageChange: (format: ResourceFormat) => void;
	focusIssue?: OperationOutcomeIssue | null;
}) {
	const getStructureDefinitions = useGetStructureDefinitions();
	const expandValueSet = useExpandValueSet(SDC_VALUE_SET_EXPAND);
	const [view, setView] = useState<CodeEditorView | null>(null);
	useEffect(() => {
		if (!view || !focusIssue) return;
		const expression = getIssueExpression(focusIssue);
		// Wait until CodeMirror has finished installing its extensions and syncing
		// the document; selection changes cannot be dispatched during that update.
		const frame = requestAnimationFrame(() => {
			if (!view.dom.isConnected) return;
			const range = findIssueTextRange(
				view.state.doc.toString(),
				expression,
				language,
			);
			if (range)
				view.dispatch({
					selection: { anchor: range.start, head: range.end },
					scrollIntoView: true,
				});
			view.focus();
		});
		return () => cancelAnimationFrame(frame);
	}, [focusIssue, view, language]);
	return (
		<div
			className="min-h-0 flex-1 overflow-hidden"
			data-test-id="resource-code-editor"
		>
			<EditorTab
				mode={language}
				setMode={onLanguageChange}
				triggerFormat={onFormat}
				defaultResourceText={value}
				resourceText={value}
				setResourceText={onChange}
				viewCallback={setView}
				actions={
					<span className="typo-label-xs text-text-secondary">
						{resourceType}
					</span>
				}
				trailingActions={<CodeEditorCopyButton textToCopy={value} />}
				getStructureDefinitions={getStructureDefinitions}
				expandValueSet={expandValueSet}
				resourceTypeHint={resourceType}
			/>
		</div>
	);
}
