import { type AidboxClientR5, useAidboxClient } from "@aidbox-ui/AidboxClient";
import type {
	OperationOutcomeIssue,
	Questionnaire,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { closeCompletion } from "@codemirror/autocomplete";
import { linter } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import {
	Button,
	type CodeEditorView,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	IconButton,
	OperationOutcomeView,
	toast,
} from "@health-samurai/react-components";
import { AlertTriangle, FileInput, Upload, X } from "lucide-react";
import {
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	buildIssueDiagnostics,
	findIssueTextRange,
	getIssueExpression,
} from "../editor/issue-location";
import { QuestionnaireCodeEditor } from "../editor/questionnaire-code-editor";
import {
	convertResourceText,
	parseResourceText,
	type ResourceFormat,
	serializeResource,
} from "../editor/resource-format";
import { getFormBuilderUrl } from "../utils";
import { generateQuestionnaireFromPdf } from "./ai-engine";
import { hasConfiguredAiProvider, subscribeToAiSettings } from "./ai-settings";
import { AiSettingsDialog } from "./ai-settings-dialog";
import {
	convertOpenEhrTemplate,
	findQuestionnaireByUrl,
	useImportQuestionnaire,
	validateQuestionnaire,
} from "./api";
import { type PdfPageImage, type PdfPreview, parsePdfToImages } from "./pdf";

const ACCEPTED_TYPES =
	"application/pdf,application/json,application/yaml,text/yaml,.json,.yaml,.yml,.opt";

type SelectedFile = {
	buffer?: ArrayBuffer;
	filename: string;
	mediaType: string;
	text: string;
};

type ImportFormDialogProps = {
	onOpenChange: (open: boolean) => void;
	open: boolean;
};

type FilePickerProps = {
	file: SelectedFile | null;
	fileError: string | null;
	fileInputRef: RefObject<HTMLInputElement | null>;
	onFileSelect: (file: File | null) => void;
};

type PdfImportStateProps = {
	aiConfigured: boolean;
	generatingPdf: boolean;
	isPdfSelected: boolean;
	parsingPdf: boolean;
	pdfFinishReason: string | null;
	pdfPreview: PdfPreview | null;
	pdfPreviewError: string | null;
};

function getFileKind(
	file: SelectedFile,
): "pdf" | "json" | "yaml" | "opt" | "other" {
	if (file.mediaType === "application/pdf") {
		return "pdf";
	}

	if (file.mediaType === "application/json") {
		return "json";
	}
	if (/\.ya?ml$/i.test(file.filename) || file.mediaType.endsWith("/yaml"))
		return "yaml";

	if (file.filename.toLowerCase().endsWith(".opt")) {
		return "opt";
	}

	return "other";
}

function tryParseQuestionnaire(
	text: string,
	format: ResourceFormat,
): Questionnaire | null {
	if (!text.trim()) {
		return null;
	}

	try {
		const value = parseResourceText(text, format);

		if (
			value &&
			typeof value === "object" &&
			"resourceType" in value &&
			(value as { resourceType?: string }).resourceType === "Bundle"
		) {
			const firstResource = (
				value as { entry?: Array<{ resource?: Questionnaire }> }
			).entry?.[0]?.resource;

			return firstResource ?? null;
		}

		if (
			value &&
			typeof value === "object" &&
			(value as { resourceType?: string }).resourceType === "Questionnaire"
		) {
			return value as Questionnaire;
		}

		return null;
	} catch {
		return null;
	}
}

function isValidationOk(issues: OperationOutcomeIssue[]) {
	return issues.every(
		(issue) => issue.severity !== "fatal" && issue.severity !== "error",
	);
}

type ValidationResult =
	| { type: "ok" }
	| { type: "duplicate" }
	| { type: "issues"; issues: OperationOutcomeIssue[] };

async function runValidation(
	client: AidboxClientR5,
	parsed: Questionnaire,
	signal: AbortSignal,
): Promise<ValidationResult> {
	const outcome = await validateQuestionnaire(client, parsed, signal);
	const issues = outcome.issue ?? [];

	if (!isValidationOk(issues)) {
		return { type: "issues", issues };
	}

	if (!parsed.url) {
		return { type: "ok" };
	}

	const existing = await findQuestionnaireByUrl(
		client,
		parsed.url,
		parsed.version,
		signal,
	);

	return existing.length > 0 ? { type: "duplicate" } : { type: "ok" };
}

function ImportFilePicker({
	file,
	fileError,
	fileInputRef,
	onFileSelect,
}: FilePickerProps) {
	return (
		<>
			<label
				className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border-primary bg-bg-primary px-4 py-3 transition-colors hover:border-border-primary_hover ${
					fileError ? "border-border-error" : ""
				}`}
			>
				{file ? (
					<>
						<div className="flex min-w-0 items-center gap-2">
							<FileInput className="size-4 shrink-0 text-text-tertiary" />
							<span
								className="truncate text-sm text-text-primary"
								data-test-id="import-form-dialog__file-name-text"
							>
								{file.filename}
							</span>
						</div>
						<IconButton
							type="button"
							variant="ghost"
							aria-label="Remove file"
							data-test-id="import-form-dialog__remove-file-button"
							onClick={(event) => {
								event.preventDefault();
								onFileSelect(null);
							}}
							icon={<X className="size-4" />}
						/>
					</>
				) : (
					<div className="flex items-center gap-2 text-sm text-text-secondary">
						<Upload className="size-4 text-text-tertiary" />
						Choose PDF, JSON, YAML, or OPT file
					</div>
				)}
				<input
					ref={fileInputRef}
					type="file"
					data-test-id="import-form-dialog__file-input"
					className="hidden"
					accept={ACCEPTED_TYPES}
					onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
				/>
			</label>

			{fileError ? (
				<p
					className="text-xs text-text-error-primary"
					data-test-id="import-form-dialog__file-error-text"
				>
					{fileError}
				</p>
			) : null}
		</>
	);
}

function PdfPagePreview({ page }: { page: PdfPageImage }) {
	return (
		<Dialog>
			<DialogTrigger
				aria-label={`Preview PDF page ${page.pageNumber}`}
				title={`Preview PDF page ${page.pageNumber}`}
				className="h-full shrink-0 snap-start cursor-zoom-in rounded hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-utility-blue"
				data-test-id="import-form-dialog__pdf-page-preview-button"
				data-page-number={page.pageNumber}
			>
				<img
					src={page.dataUrl}
					alt="PDF page preview"
					className="h-full rounded border border-border-primary bg-bg-primary object-contain"
				/>
			</DialogTrigger>
			<DialogContent
				aria-describedby={undefined}
				className="flex h-[min(90vh,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-2rem)] lg:max-w-[70rem]"
				data-test-id="import-form-dialog__pdf-page-preview-dialog"
			>
				<DialogHeader className="border-b border-border-primary bg-bg-primary px-6 py-5 pr-14">
					<DialogTitle>PDF page {page.pageNumber}</DialogTitle>
				</DialogHeader>
				<div className="min-h-0 flex-1 overflow-auto bg-bg-secondary p-4">
					<img
						src={page.dataUrl}
						alt={`PDF page ${page.pageNumber}`}
						className="mx-auto h-auto max-w-full"
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function PdfImportState({
	aiConfigured,
	generatingPdf,
	isPdfSelected,
	parsingPdf,
	pdfFinishReason,
	pdfPreview,
	pdfPreviewError,
}: PdfImportStateProps) {
	if (!isPdfSelected) {
		return null;
	}

	return (
		<>
			{!aiConfigured ? (
				<div className="flex items-start gap-3 rounded-md border border-border-warning bg-bg-warning-secondary px-4 py-3">
					<AlertTriangle className="mt-0.5 size-4 shrink-0 text-text-warning-primary" />
					<div className="text-sm text-text-warning-primary">
						Please set your AI provider in the settings to import PDF files.
					</div>
				</div>
			) : null}

			{pdfPreviewError && aiConfigured ? (
				<div className="flex items-start gap-3 rounded-md border border-border-warning bg-bg-warning-secondary px-4 py-3">
					<AlertTriangle className="mt-0.5 size-4 shrink-0 text-text-warning-primary" />
					<div className="text-sm text-text-warning-primary">
						Could not render the page preview ({pdfPreviewError}). Generation
						still works — the file itself is sent to the model.
					</div>
				</div>
			) : null}

			{pdfFinishReason === "length" ? (
				<div className="flex items-start gap-3 rounded-md border border-border-warning bg-bg-warning-secondary px-4 py-3">
					<AlertTriangle className="mt-0.5 size-4 shrink-0 text-text-warning-primary" />
					<div className="text-sm text-text-warning-primary">
						Warning: The model has reached the maximum token limit. The output
						may be incomplete.
					</div>
				</div>
			) : null}

			{pdfPreview && pdfPreview.pages.length < pdfPreview.totalPages ? (
				<p className="text-xs text-text-secondary">
					Preview shows the first {pdfPreview.pages.length} of{" "}
					{pdfPreview.totalPages} pages. The whole document is sent for
					generation.
				</p>
			) : null}

			{(parsingPdf || (pdfPreview && !generatingPdf)) && aiConfigured ? (
				<div className="flex h-40 snap-x snap-mandatory items-start gap-4 overflow-auto rounded-md border border-border-primary bg-bg-secondary p-3">
					{pdfPreview?.pages.map((page) => (
						<PdfPagePreview key={page.pageNumber} page={page} />
					))}
					{parsingPdf
						? [0, 1, 2].map((index) => (
								<div
									key={index}
									className="h-full aspect-[0.72] shrink-0 animate-pulse rounded border border-border-primary bg-bg-primary"
								/>
							))
						: null}
				</div>
			) : null}
		</>
	);
}

function shouldShowQuestionnaireEditor({
	aiConfigured,
	generatingPdf,
	isPdfSelected,
	pdfPreview,
	questionnaireText,
}: {
	aiConfigured: boolean;
	generatingPdf: boolean;
	isPdfSelected: boolean;
	pdfPreview: PdfPreview | null;
	questionnaireText: string;
}) {
	if (!isPdfSelected) {
		return true;
	}

	if (!aiConfigured && !questionnaireText) {
		return false;
	}

	return !pdfPreview || generatingPdf;
}

function StandaloneDiagnostics({
	visible,
	diagnostics,
	onIssueClick,
}: {
	visible: boolean;
	diagnostics: OperationOutcomeIssue[];
	onIssueClick: (issue: OperationOutcomeIssue) => void;
}) {
	if (!visible) return null;
	return (
		<OperationOutcomeView
			resource={{ resourceType: "OperationOutcome", issue: diagnostics }}
			onIssueClick={(issue) => onIssueClick(issue as OperationOutcomeIssue)}
			data-test-id="import-form-dialog__diagnostics"
		/>
	);
}

export function ImportFormDialog({
	onOpenChange,
	open,
}: ImportFormDialogProps) {
	const aidboxClient = useAidboxClient();
	const [file, setFile] = useState<SelectedFile | null>(null);
	const [fileError, setFileError] = useState<string | null>(null);
	const [convertingTemplate, setConvertingTemplate] = useState(false);
	const [parsingPdf, setParsingPdf] = useState(false);
	const [generatingPdf, setGeneratingPdf] = useState(false);
	const [pdfPreview, setPdfPreview] = useState<PdfPreview | null>(null);
	const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null);
	const [pdfFinishReason, setPdfFinishReason] = useState<string | null>(null);
	const [openEhrSource, setOpenEhrSource] = useState<unknown>(null);
	const [questionnaireText, setQuestionnaireText] = useState("");
	const [language, setLanguage] = useState<ResourceFormat>("json");
	const changeLanguage = (next: ResourceFormat) => {
		if (next === language) return;
		try {
			const converted = convertResourceText(questionnaireText, language, next);
			setQuestionnaireText(converted);
			setLanguage(next);
		} catch {
			toast.error(
				`Fix invalid ${language.toUpperCase()} before switching to ${next.toUpperCase()}`,
			);
		}
	};
	const [parsedQuestionnaire, setParsedQuestionnaire] =
		useState<Questionnaire | null>(null);
	const [diagnostics, setDiagnostics] = useState<OperationOutcomeIssue[]>([]);
	const [validating, setValidating] = useState(false);
	const [duplicate, setDuplicate] = useState(false);
	const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
	const [aiConfigured, setAiConfigured] = useState(false);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const editorViewRef = useRef<CodeEditorView | null>(null);
	const validateRequestId = useRef(0);
	const pdfRequestId = useRef(0);
	const generationControllerRef = useRef<AbortController | null>(null);
	const importMutation = useImportQuestionnaire();
	const editorExtensions = useMemo(
		() => [
			EditorView.contentAttributes.of({
				"aria-label": `Questionnaire ${language.toUpperCase()}`,
			}),
			linter((view) =>
				buildIssueDiagnostics(view.state.doc.toString(), diagnostics, language),
			),
		],
		[diagnostics, language],
	);

	/**
	 * Selects the element the issue complains about and scrolls the editor to
	 * it, so a click on the message lands on the offending line.
	 */
	const revealIssue = (issue: OperationOutcomeIssue) => {
		const view = editorViewRef.current;
		if (!view) {
			return;
		}

		const text = view.state.doc.toString();
		const range = findIssueTextRange(text, getIssueExpression(issue), language);
		view.focus();
		if (!range) {
			return;
		}

		view.dispatch({
			scrollIntoView: true,
			selection: {
				anchor: range.start,
				head: Math.min(range.end, text.length),
			},
		});
	};

	const resetPdfImportState = () => {
		generationControllerRef.current?.abort();
		pdfRequestId.current += 1;
		setFileError(null);
		setParsingPdf(false);
		setGeneratingPdf(false);
		setPdfPreview(null);
		setPdfPreviewError(null);
		setPdfFinishReason(null);
	};

	const parsePdfFile = async (selected: File, requestId: number) => {
		const buffer = await selected.arrayBuffer();
		setFile({
			filename: selected.name,
			mediaType: selected.type,
			text: "",
			buffer,
		});
		setOpenEhrSource(null);
		setQuestionnaireText("");
		setParsingPdf(true);

		try {
			const preview = await parsePdfToImages(buffer);

			if (requestId === pdfRequestId.current) {
				setPdfPreview(preview);
			}
		} catch (error) {
			// The preview is decorative: generation sends the raw file to the model,
			// so a missing pdf.js (blocked CDN, strict CSP) or a page that fails to
			// render must not block Generate. Hence a notice, not a file error.
			if (requestId === pdfRequestId.current) {
				setPdfPreviewError(
					error instanceof Error ? error.message : "unknown error",
				);
			}
		} finally {
			if (requestId === pdfRequestId.current) {
				setParsingPdf(false);
			}
		}
	};

	const convertOptFile = async (text: string) => {
		setOpenEhrSource(null);
		setQuestionnaireText("");
		setConvertingTemplate(true);

		try {
			const { questionnaire, source } = await convertOpenEhrTemplate(
				aidboxClient,
				text,
			);
			setOpenEhrSource(source);
			setQuestionnaireText(serializeResource(questionnaire, language));
		} catch (error) {
			setFileError(
				error instanceof Error
					? error.message
					: "Failed to convert OpenEHR template",
			);
			setOpenEhrSource(null);
		} finally {
			setConvertingTemplate(false);
		}
	};

	const resetState = useCallback(() => {
		generationControllerRef.current?.abort();
		setFile(null);
		setFileError(null);
		setConvertingTemplate(false);
		setParsingPdf(false);
		setGeneratingPdf(false);
		setPdfPreview(null);
		setPdfPreviewError(null);
		setPdfFinishReason(null);
		setOpenEhrSource(null);
		setQuestionnaireText("");
		setParsedQuestionnaire(null);
		setLanguage("json");
		setDiagnostics([]);
		setValidating(false);
		setDuplicate(false);

		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	}, []);

	useEffect(() => {
		if (!open) {
			resetState();
		} else {
			setAiConfigured(hasConfiguredAiProvider());
		}
	}, [open, resetState]);

	useEffect(() => {
		if (!open) return;
		return subscribeToAiSettings(() =>
			setAiConfigured(hasConfiguredAiProvider()),
		);
	}, [open]);

	useEffect(() => {
		const trimmed = questionnaireText.trim();

		if (!trimmed) {
			setParsedQuestionnaire(null);
			setDiagnostics([]);
			setDuplicate(false);
			setValidating(false);
			return;
		}

		const parsed = tryParseQuestionnaire(trimmed, language);

		if (!parsed) {
			setParsedQuestionnaire(null);
			setDuplicate(false);
			setValidating(false);
			setDiagnostics([
				{
					code: "invalid",
					diagnostics: `Please provide a valid Questionnaire ${language.toUpperCase()}.`,
					severity: "error",
				},
			]);
			return;
		}

		setParsedQuestionnaire(parsed);
		setDuplicate(false);

		const controller = new AbortController();
		const requestId = ++validateRequestId.current;
		setValidating(true);

		const isStale = () =>
			controller.signal.aborted || requestId !== validateRequestId.current;

		const timer = window.setTimeout(() => {
			void runValidation(aidboxClient, parsed, controller.signal)
				.then((result) => {
					if (isStale()) {
						return;
					}

					if (result.type === "issues") {
						setDiagnostics(result.issues);
					} else if (result.type === "duplicate") {
						setDuplicate(true);
						setDiagnostics([
							{
								code: "duplicate",
								diagnostics:
									"A questionnaire with the same URL and version already exists. Importing will overwrite it.",
								severity: "warning",
							},
						]);
					} else {
						setDiagnostics([]);
						setDuplicate(false);
					}
				})
				.catch((error: unknown) => {
					if (isStale()) {
						return;
					}

					setDiagnostics([
						{
							code: "exception",
							diagnostics:
								error instanceof Error
									? error.message
									: "Failed to validate questionnaire",
							severity: "error",
						},
					]);
				})
				.finally(() => {
					if (!isStale()) {
						setValidating(false);
					}
				});
		}, 400);

		return () => {
			controller.abort();
			window.clearTimeout(timer);
		};
	}, [aidboxClient, questionnaireText, language]);

	const handleFileSelect = async (selected: File | null) => {
		resetPdfImportState();
		const requestId = pdfRequestId.current;

		if (!selected) {
			setFile(null);
			setOpenEhrSource(null);
			return;
		}

		const filename = selected.name;
		const mediaType = selected.type;
		const isPdf = mediaType === "application/pdf";
		const isOpt = filename.toLowerCase().endsWith(".opt");

		if (isPdf) {
			await parsePdfFile(selected, requestId);
			return;
		}

		const text = await selected.text();
		setFile({ filename, mediaType, text });

		if (isOpt) {
			await convertOptFile(text);
			return;
		}

		setOpenEhrSource(null);
		setLanguage(
			getFileKind({ filename, mediaType, text }) === "yaml" ? "yaml" : "json",
		);
		setQuestionnaireText(text);
	};

	const handleGenerate = async () => {
		if (!file?.buffer || generatingPdf) {
			return;
		}

		generationControllerRef.current?.abort();
		const controller = new AbortController();
		generationControllerRef.current = controller;
		setFileError(null);
		setPdfPreviewError(null);
		setPdfFinishReason(null);
		setGeneratingPdf(true);
		setQuestionnaireText("");

		try {
			const { questionnaire, finishReason } =
				await generateQuestionnaireFromPdf({
					pdfBuffer: file.buffer,
					signal: controller.signal,
					onStream: (questionnaire) => {
						if (!controller.signal.aborted) {
							setQuestionnaireText(serializeResource(questionnaire, language));
						}
					},
				});

			if (!controller.signal.aborted) {
				setPdfPreview(null);
				setPdfFinishReason(finishReason ?? null);
				setQuestionnaireText(serializeResource(questionnaire, language));
			}
		} catch (error) {
			if (!controller.signal.aborted) {
				setQuestionnaireText("");
				setFileError(
					error instanceof Error
						? error.message
						: "Failed to generate questionnaire",
				);
			}
		} finally {
			if (generationControllerRef.current === controller) {
				generationControllerRef.current = null;
			}

			if (!controller.signal.aborted) {
				setGeneratingPdf(false);
			}
		}
	};

	const handleSubmit = () => {
		if (!parsedQuestionnaire) {
			return;
		}

		if (duplicate) {
			const ok = window.confirm(
				"This will overwrite the existing questionnaire. Continue?",
			);

			if (!ok) {
				return;
			}
		}

		importMutation.mutate(
			{
				openEhrSource: openEhrSource ?? undefined,
				questionnaire: parsedQuestionnaire,
			},
			{
				onSuccess: (saved) => {
					toast.success("The form is imported successfully");
					onOpenChange(false);

					if (saved.id) {
						window.location.assign(getFormBuilderUrl(saved.id));
					}
				},
				onError: (error) => {
					toast.error(
						error instanceof Error
							? error.message
							: "Failed to import questionnaire",
					);
				},
			},
		);
	};

	const fileKind = file ? getFileKind(file) : null;
	const isPdfSelected = fileKind === "pdf";
	// Deliberately not tied to `pdfPages`: the preview is rendered locally by
	// pdf.js, while generation needs nothing but the buffer.
	const canGenerate =
		isPdfSelected &&
		aiConfigured &&
		Boolean(file?.buffer) &&
		!questionnaireText &&
		!parsingPdf &&
		!generatingPdf;
	const hasErrorDiagnostics = diagnostics.some(
		(issue) => issue.severity === "fatal" || issue.severity === "error",
	);
	const canSubmit =
		!importMutation.isPending &&
		!validating &&
		!convertingTemplate &&
		!parsingPdf &&
		!generatingPdf &&
		Boolean(parsedQuestionnaire) &&
		!hasErrorDiagnostics;
	const primaryLabel = importMutation.isPending
		? "Submitting..."
		: convertingTemplate
			? "Converting template..."
			: parsingPdf
				? "Parsing PDF..."
				: generatingPdf
					? "Generating..."
					: validating
						? "Validating..."
						: canGenerate
							? "Generate"
							: "Submit";
	const primaryAction = canGenerate ? handleGenerate : handleSubmit;
	const primaryDisabled = !(canGenerate || canSubmit);
	const showQuestionnaireEditor = shouldShowQuestionnaireEditor({
		aiConfigured,
		generatingPdf,
		isPdfSelected,
		pdfPreview,
		questionnaireText,
	});

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent
					className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[48rem]"
					data-test-id="import-form-dialog"
					onEscapeKeyDown={(event) => {
						const view = editorViewRef.current;
						if (view && closeCompletion(view)) event.preventDefault();
					}}
				>
					<DialogHeader className="border-b border-border-primary bg-bg-primary px-6 py-6 pr-14">
						<DialogTitle data-test-id="import-form-dialog__title">
							Import Questionnaire
						</DialogTitle>
						<DialogDescription>
							Upload a Questionnaire JSON or YAML file or an OpenEHR .opt
							template, or paste the resource below.
						</DialogDescription>
					</DialogHeader>
					<div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
						<div className="grid gap-4">
							<ImportFilePicker
								file={file}
								fileError={fileError}
								fileInputRef={fileInputRef}
								onFileSelect={(nextFile) => {
									void handleFileSelect(nextFile);
								}}
							/>
							<PdfImportState
								aiConfigured={aiConfigured}
								generatingPdf={generatingPdf}
								isPdfSelected={isPdfSelected}
								parsingPdf={parsingPdf}
								pdfFinishReason={pdfFinishReason}
								pdfPreview={pdfPreview}
								pdfPreviewError={pdfPreviewError}
							/>

							{showQuestionnaireEditor ? (
								<div className="grid gap-1.5">
									<p
										className="text-xs text-text-secondary"
										data-test-id="import-form-dialog__questionnaire-hint-text"
									>
										{generatingPdf
											? "Generating questionnaire..."
											: `Or paste Questionnaire ${language.toUpperCase()} here`}
									</p>
									<QuestionnaireCodeEditor
										additionalExtensions={editorExtensions}
										value={questionnaireText}
										onChange={setQuestionnaireText}
										language={language}
										onLanguageChange={changeLanguage}
										diagnostics={diagnostics}
										onIssueClick={revealIssue}
										readOnly={convertingTemplate || generatingPdf}
										viewCallback={(view) => {
											editorViewRef.current = view;
										}}
									/>
								</div>
							) : null}

							<StandaloneDiagnostics
								visible={!showQuestionnaireEditor}
								diagnostics={diagnostics}
								onIssueClick={revealIssue}
							/>
						</div>
					</div>
					<DialogFooter className="border-t border-border-primary bg-bg-primary px-6 py-4">
						<Button
							type="button"
							variant="secondary"
							data-test-id="import-form-dialog__cancel-button"
							onClick={() => onOpenChange(false)}
							disabled={importMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="secondary"
							data-test-id="import-form-dialog__ai-settings-button"
							onClick={() => setAiSettingsOpen(true)}
						>
							AI Settings
						</Button>
						<Button
							type="button"
							data-test-id="import-form-dialog__submit-button"
							onClick={primaryAction}
							disabled={primaryDisabled}
						>
							{primaryLabel}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<AiSettingsDialog
				open={aiSettingsOpen}
				onOpenChange={(nextOpen) => {
					setAiSettingsOpen(nextOpen);
					if (!nextOpen) {
						setAiConfigured(hasConfiguredAiProvider());
					}
				}}
			/>
		</>
	);
}
