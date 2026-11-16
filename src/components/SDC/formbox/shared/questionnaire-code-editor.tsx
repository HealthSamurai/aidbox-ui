import type { OperationOutcomeIssue } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import { useExpandValueSet } from "@aidbox-ui/hooks/useExpandValueSet";
import { useGetStructureDefinitions } from "@aidbox-ui/hooks/useGetStructureDefinition";
import { useVimMode } from "@aidbox-ui/shared/vim-mode";
import {
	CodeEditor,
	type CodeEditorView,
	OperationOutcomeView,
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	toast,
} from "@health-samurai/react-components";
import { type ComponentProps, useRef } from "react";
import {
	CodeEditorCopyButton,
	CodeEditorFormatButton,
	CodeEditorFormatSelect,
} from "../../../ViewDefinition/code-editor-menubar";
import { SDC_VALUE_SET_EXPAND } from "./const";
import { editorShortcutHandler } from "./editor-shortcuts";
import {
	parseResourceText,
	type ResourceFormat,
	serializeResource,
} from "./resource-format";

/** Aidbox's editor toolbar and split diagnostics, adapted to Questionnaire imports and R4. */
export function QuestionnaireCodeEditor({
	value,
	onChange,
	language,
	onLanguageChange,
	diagnostics,
	onIssueClick,
	...editorProps
}: Pick<
	ComponentProps<typeof CodeEditor>,
	"additionalExtensions" | "readOnly" | "viewCallback"
> & {
	value: string;
	onChange: (value: string) => void;
	language: ResourceFormat;
	onLanguageChange: (format: ResourceFormat) => void;
	diagnostics: OperationOutcomeIssue[];
	onIssueClick: (issue: OperationOutcomeIssue) => void;
}) {
	const getStructureDefinitions = useGetStructureDefinitions();
	const expandValueSet = useExpandValueSet(SDC_VALUE_SET_EXPAND);
	const vimMode = useVimMode();
	const view = useRef<CodeEditorView | null>(null);
	const formatLabel = language.toUpperCase();
	const replaceValue = (text: string) => {
		if (editorProps.readOnly)
			throw new Error("The editor is currently read-only");
		if (view.current) {
			view.current.dispatch({
				changes: { from: 0, to: view.current.state.doc.length, insert: text },
			});
		} else {
			onChange(text);
		}
	};
	const format = () => {
		try {
			replaceValue(
				serializeResource(parseResourceText(value, language), language),
			);
		} catch {
			toast.error(`Fix invalid ${formatLabel} before formatting`);
		}
	};
	return (
		<fieldset
			className="min-w-0"
			aria-label="Questionnaire code editor"
			onKeyDownCapture={editorShortcutHandler({
				format,
				disabled: editorProps.readOnly,
			})}
		>
			<ResizablePanelGroup
				direction="vertical"
				autoSaveId="formbox-import-json-layout"
				className="min-w-0 rounded-md border border-border-primary"
				style={{
					height: `clamp(14rem, calc(100dvh - 21rem), ${diagnostics.length ? "28rem" : "20rem"})`,
				}}
			>
				<ResizablePanel id="json" minSize={30} defaultSize={70}>
					<div className="flex h-full min-h-0 flex-col">
						<div className="flex h-10 shrink-0 items-center justify-between border-b bg-bg-secondary px-4">
							<span className="typo-label-xs text-text-secondary">
								Questionnaire
							</span>
							<div className="flex items-center gap-2">
								<CodeEditorFormatSelect
									mode={language}
									onModeChange={onLanguageChange}
								/>
								<CodeEditorFormatButton onFormat={format} />
								<CodeEditorCopyButton textToCopy={value} />
							</div>
						</div>
						<div
							className="min-h-0 flex-1 overflow-hidden bg-bg-primary"
							data-test-id="import-form-dialog__questionnaire-editor"
						>
							<CodeEditor
								{...editorProps}
								getStructureDefinitions={getStructureDefinitions}
								expandValueSet={expandValueSet}
								resourceTypeHint="Questionnaire"
								currentValue={value}
								mode={language}
								foldGutter={false}
								vimMode={vimMode}
								onChange={onChange}
								viewCallback={(editorView) => {
									view.current = editorView;
									editorProps.viewCallback?.(editorView);
								}}
							/>
						</div>
					</div>
				</ResizablePanel>
				{diagnostics.length > 0 && (
					<>
						<ResizableHandle aria-label="Resize validation details" />
						<ResizablePanel id="diagnostics" minSize={15} defaultSize={30}>
							<OperationOutcomeView
								resource={{
									resourceType: "OperationOutcome",
									issue: diagnostics,
								}}
								onIssueClick={(issue) =>
									onIssueClick(issue as OperationOutcomeIssue)
								}
								className="h-full overflow-auto"
								data-test-id="import-form-dialog__diagnostics"
							/>
						</ResizablePanel>
					</>
				)}
			</ResizablePanelGroup>
		</fieldset>
	);
}
