import type { OperationOutcomeIssue } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import { useExpandValueSet } from "@aidbox-ui/hooks/useExpandValueSet";
import { useGetStructureDefinitions } from "@aidbox-ui/hooks/useGetStructureDefinition";
import { useVimMode } from "@aidbox-ui/shared/vim-mode";
import {
	CodeEditor,
	type CodeEditorView,
	IconButton,
	OperationOutcomeView,
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	toast,
} from "@health-samurai/react-components";
import { Check, Copy, TextQuote } from "lucide-react";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { NO_ARGUMENTS, useWebMCPTools } from "../webmcp/use-webmcp-tools";
import { SDC_VALUE_SET_EXPAND } from "./const";
import { editorShortcutHandler } from "./editor-shortcuts";
import {
	convertResourceText,
	parseResourceText,
	type ResourceFormat,
	serializeResource,
} from "./resource-format";
import { ResourceFormatSelect } from "./resource-format-select";

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
	const [copied, setCopied] = useState(false);
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
	useWebMCPTools([
		{
			name: "formbox_questionnaire_get_json",
			description: "Read the Questionnaire JSON currently being imported.",
			inputSchema: NO_ARGUMENTS,
			annotations: { readOnlyHint: true },
			execute: () => ({
				value:
					language === "json"
						? value
						: convertResourceText(value, language, "json"),
				readOnly: Boolean(editorProps.readOnly),
			}),
		},
		{
			name: "formbox_questionnaire_get_validation",
			description:
				"Read the latest validation issues displayed by the import dialog.",
			inputSchema: NO_ARGUMENTS,
			annotations: { readOnlyHint: true },
			execute: () => diagnostics,
		},
		...(!editorProps.readOnly
			? [
					{
						name: "formbox_questionnaire_set_json",
						description:
							"Edit the import JSON. This triggers the ordinary validation flow and does not import or save a resource.",
						inputSchema: {
							type: "object" as const,
							properties: { value: { type: "string" as const } },
							required: ["value"],
							additionalProperties: false,
						},
						annotations: { destructiveHint: false },
						execute: ({ value: next }: Record<string, unknown>) => {
							if (typeof next !== "string")
								throw new Error("JSON content must be a string");
							replaceValue(
								language === "json"
									? next
									: convertResourceText(next, "json", language),
							);
							return { status: "updated" };
						},
					},
					{
						name: "formbox_questionnaire_format_json",
						description:
							"Format the import resource using the selected JSON or YAML format.",
						inputSchema: NO_ARGUMENTS,
						annotations: { destructiveHint: false },
						execute: () => {
							replaceValue(
								serializeResource(parseResourceText(value, language), language),
							);
							return { status: "formatted" };
						},
					},
				]
			: []),
	]);
	useEffect(() => {
		if (!copied) return;
		const timeout = setTimeout(() => setCopied(false), 2000);
		return () => clearTimeout(timeout);
	}, [copied]);
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
								<ResourceFormatSelect
									value={language}
									onChange={onLanguageChange}
									disabled={editorProps.readOnly}
								/>
								<IconButton
									icon={<TextQuote />}
									aria-label={`Format ${formatLabel}`}
									title={`Format ${formatLabel} (⌘/Ctrl+Shift+F)`}
									aria-keyshortcuts="Meta+Shift+F Control+Shift+F"
									disabled={editorProps.readOnly || !value.trim()}
									onClick={format}
								/>
								<IconButton
									icon={copied ? <Check /> : <Copy />}
									aria-label={
										copied ? `${formatLabel} copied` : `Copy ${formatLabel}`
									}
									title={
										copied ? `${formatLabel} copied` : `Copy ${formatLabel}`
									}
									disabled={!value.trim()}
									onClick={async () => {
										try {
											await navigator.clipboard.writeText(value);
											setCopied(true);
										} catch {
											toast.error(`Could not copy ${formatLabel}`);
										}
									}}
								/>
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
