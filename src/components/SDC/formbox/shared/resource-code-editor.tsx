import type { OperationOutcomeIssue } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import { useExpandValueSet } from "@aidbox-ui/hooks/useExpandValueSet";
import { useGetStructureDefinitions } from "@aidbox-ui/hooks/useGetStructureDefinition";
import { useVimMode } from "@aidbox-ui/shared/vim-mode";
import { EditorView } from "@codemirror/view";
import {
	CodeEditor,
	type CodeEditorView,
	IconButton,
	toast,
} from "@health-samurai/react-components";
import { Copy, TextQuote } from "lucide-react";
import {
	type ComponentProps,
	type ReactNode,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	findIssueTextRange,
	getIssueExpression,
} from "../pages/questionnaires/issue-location";
import { SDC_VALUE_SET_EXPAND } from "./const";
import type { ResourceFormat } from "./resource-format";
import { ResourceFormatSelect } from "./resource-format-select";

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

export function ResourceCodeEditor({
	resourceType,
	value,
	onChange,
	onFormat,
	language,
	onLanguageChange,
	readOnly,
	focusIssue,
}: {
	resourceType: string;
	value: string;
	onChange: (text: string) => void;
	onFormat: () => void;
	language: ResourceFormat;
	onLanguageChange: (format: ResourceFormat) => void;
	readOnly?: boolean;
	focusIssue?: OperationOutcomeIssue | null;
}) {
	const getStructureDefinitions = useGetStructureDefinitions();
	const expandValueSet = useExpandValueSet(SDC_VALUE_SET_EXPAND);
	const vimMode = useVimMode();
	const [view, setView] = useState<CodeEditorView | null>(null);
	const formatLabel = language.toUpperCase();
	const extensions = useMemo(
		() => [
			EditorView.contentAttributes.of({
				"aria-label": `${resourceType} ${formatLabel}`,
			}),
		],
		[resourceType, formatLabel],
	);
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
			className="flex min-h-0 flex-1 flex-col overflow-hidden"
			data-test-id="resource-code-editor"
		>
			<div className="flex h-10 shrink-0 items-center justify-between border-b bg-bg-secondary px-4">
				<span className="typo-label-xs text-text-secondary">
					{resourceType}
				</span>
				<div className="flex items-center gap-2">
					<ResourceFormatSelect
						value={language}
						onChange={onLanguageChange}
						disabled={readOnly}
					/>
					<IconButton
						icon={<TextQuote />}
						aria-label={`Format ${formatLabel}`}
						title={`Format ${formatLabel} (⌘/Ctrl+Shift+F)`}
						aria-keyshortcuts="Meta+Shift+F Control+Shift+F"
						disabled={readOnly || !value.trim()}
						onClick={onFormat}
					/>
					<IconButton
						icon={<Copy />}
						aria-label={`Copy ${formatLabel}`}
						title={`Copy ${formatLabel}`}
						onClick={async () => {
							try {
								await navigator.clipboard.writeText(value);
								toast.success(`${formatLabel} copied`);
							} catch {
								toast.error(`Could not copy ${formatLabel}`);
							}
						}}
					/>
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-hidden">
				<CodeEditor
					getStructureDefinitions={getStructureDefinitions}
					expandValueSet={expandValueSet}
					resourceTypeHint={resourceType}
					currentValue={value}
					onChange={onChange}
					mode={language}
					readOnly={readOnly}
					vimMode={vimMode}
					additionalExtensions={extensions}
					viewCallback={setView}
				/>
			</div>
		</div>
	);
}
