import { useFhirServerVersion } from "@aidbox-ui/components/ConceptMap/version";
import { PreviewToolbar } from "@aidbox-ui/components/PlanDefinition/plan-definition-preview";
import type {
	Questionnaire,
	QuestionnaireResponse,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import { useLocalStorage } from "@aidbox-ui/hooks";
import { generateId } from "@aidbox-ui/utils";
import * as HSComp from "@health-samurai/react-components";
import {
	AlertCircle,
	LoaderCircle,
	PanelBottomClose,
	PanelBottomOpen,
} from "lucide-react";
import { Component, lazy, type ReactNode, Suspense, useState } from "react";
import { Renderer as ClassicRenderer } from "../renderer";

const QuestionnaireRenderer = lazy(() => import("./renderer"));

type RendererKind = "classic" | "formbox";

/**
 * Shared links and the rest of production still use the classic renderer, so
 * the preview defaults to it; Formbox is opt-in while in beta.
 */
function RendererSwitch({
	value,
	onChange,
}: {
	value: RendererKind;
	onChange: (value: RendererKind) => void;
}) {
	return (
		<HSComp.SegmentControl
			value={value}
			onValueChange={(next) => onChange(next as RendererKind)}
			items={[
				{ value: "formbox", label: "Formbox" },
				{ value: "classic", label: "Classic" },
			]}
			data-test-id="questionnaire-preview__renderer-switch"
		/>
	);
}

/** An edited Questionnaire may be anything; show why it does not render. */
class RenderErrorBoundary extends Component<
	{ children: ReactNode },
	{ error: Error | null }
> {
	state = { error: null as Error | null };

	static getDerivedStateFromError(error: Error) {
		return { error };
	}

	render() {
		if (!this.state.error) return this.props.children;
		return (
			<div className="p-4" data-test-id="questionnaire-preview__error">
				<HSComp.Alert variant="warning">
					<AlertCircle className="size-4" />
					<HSComp.AlertDescription>
						Cannot render the questionnaire: {this.state.error.message}
					</HSComp.AlertDescription>
				</HSComp.Alert>
			</div>
		);
	}
}

function Loading() {
	return (
		<output
			className="flex h-full items-center justify-center gap-2 text-sm text-text-secondary"
			data-test-id="questionnaire-preview__loading"
		>
			<LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
			Loading preview…
		</output>
	);
}

function ResponseHeader({
	collapsed,
	onToggleCollapse,
}: {
	collapsed: boolean;
	onToggleCollapse: () => void;
}) {
	return (
		<div
			className={`flex h-10 flex-none items-center justify-between bg-bg-secondary pr-2 pl-4 ${collapsed ? "border-t" : "border-b"}`}
		>
			<span className="typo-label text-text-secondary">
				QuestionnaireResponse
			</span>
			<HSComp.Tooltip>
				<HSComp.TooltipTrigger asChild>
					<HSComp.Button
						variant="ghost"
						size="small"
						onClick={onToggleCollapse}
						data-test-id="questionnaire-preview__response-toggle"
					>
						{collapsed ? (
							<PanelBottomOpen className="h-4 w-4" />
						) : (
							<PanelBottomClose className="h-4 w-4" />
						)}
					</HSComp.Button>
				</HSComp.TooltipTrigger>
				<HSComp.TooltipContent align="end">
					{collapsed ? "Restore" : "Collapse"}
				</HSComp.TooltipContent>
			</HSComp.Tooltip>
		</div>
	);
}

/** The response the form produces, updated on every answer. */
function ResponsePanel({ response }: { response: object | undefined }) {
	return response ? (
		<div
			className="min-h-0 flex-1"
			data-test-id="questionnaire-preview__response"
		>
			<HSComp.CodeEditor
				readOnly
				currentValue={JSON.stringify(response, null, 2)}
				mode="json"
			/>
		</div>
	) : (
		<div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
			Answer the form to see its QuestionnaireResponse
		</div>
	);
}

/**
 * The Questionnaire as a respondent sees it, rendered from the editor's
 * current, possibly unsaved, state, with the QuestionnaireResponse it produces
 * below, the way the ViewDefinition builder shows its result. Given a
 * response, the form starts from its answers.
 *
 * With `rendererSwitch` the classic renderer is the default and Formbox is
 * opt-in; without it Formbox is used.
 */
export function QuestionnairePreview({
	questionnaire,
	questionnaireResponse,
	rendererSwitch = false,
	showResponse = true,
	onSubmit,
	toolbarClassName,
}: {
	questionnaire: Questionnaire;
	questionnaireResponse?: QuestionnaireResponse;
	rendererSwitch?: boolean;
	/** The produced response below the form; off where the response is the resource itself. */
	showResponse?: boolean;
	/** Turns on the form's Save, which hands the response here. */
	onSubmit?: (response: object) => void;
	/** In a dialog the toolbar leaves room for its close button. */
	toolbarClassName?: string;
}) {
	const fhirVersion = useFhirServerVersion();
	const [selectedRenderer, setSelectedRenderer] = useLocalStorage<RendererKind>(
		{
			key: "questionnairePreview-renderer",
			defaultValue: "formbox",
			getInitialValueInEffect: false,
		},
	);
	// Anything but an explicit choice of classic, an outdated stored value
	// too, is Formbox.
	const renderer: RendererKind =
		rendererSwitch && selectedRenderer === "classic" ? "classic" : "formbox";
	// Keyed by the inputs: an edit starts a new form and a new response.
	const questionnaireKey = JSON.stringify([
		questionnaire,
		questionnaireResponse,
		renderer,
	]);
	const [response, setResponse] = useState<{
		key: string;
		value: object;
	} | null>(null);
	const [isResponseCollapsed, setIsResponseCollapsed] =
		useLocalStorage<boolean>({
			key: "questionnairePreview-responseCollapsed",
			defaultValue: false,
			getInitialValueInEffect: false,
		});
	const currentResponse =
		response?.key === questionnaireKey ? response.value : questionnaireResponse;
	const onResponseChange = (value: object) =>
		setResponse({ key: questionnaireKey, value });

	// The renderer keeps its answers; reset starts the form over.
	const [session, setSession] = useState(() => generateId());
	const [previewWidth, setPreviewWidth] = useState("100%");
	const form = (
		<section
			className="flex h-full min-h-0 flex-col bg-bg-primary"
			aria-label="Questionnaire preview"
			data-test-id="questionnaire-preview"
		>
			<PreviewToolbar
				onReset={() => {
					setSession(generateId());
					setResponse(null);
				}}
				width={previewWidth}
				onWidthChange={setPreviewWidth}
				className={toolbarClassName}
				actions={
					rendererSwitch && (
						<RendererSwitch value={renderer} onChange={setSelectedRenderer} />
					)
				}
			/>
			<div
				className={`flex min-h-0 flex-1 flex-col overflow-auto bg-bg-primary`}
			>
				{/* The classic renderer brings its own page and card and scrolls
				    inside; the Formbox form sits on the page as a card. */}
				<div
					className={
						renderer === "classic"
							? "mx-auto flex min-h-0 max-w-full flex-1 flex-col"
							: "mx-auto w-full max-w-full"
					}
					style={{ width: previewWidth }}
				>
					{renderer === "classic" ? (
						<ClassicRenderer
							key={session}
							questionnaire={questionnaire}
							questionnaireResponse={questionnaireResponse}
							onResponseChange={onResponseChange}
							onSubmit={onSubmit}
						/>
					) : fhirVersion ? (
						<div data-formbox-theme-root="">
							{/* A new key retries after the questionnaire is fixed. */}
							<RenderErrorBoundary key={`${questionnaireKey}-${session}`}>
								<Suspense fallback={<Loading />}>
									<QuestionnaireRenderer
										questionnaire={questionnaire}
										questionnaireResponse={questionnaireResponse}
										fhirVersion={fhirVersion}
										onResponseChange={onResponseChange}
										onSubmit={onSubmit}
									/>
								</Suspense>
							</RenderErrorBoundary>
						</div>
					) : (
						<Loading />
					)}
				</div>
			</div>
		</section>
	);

	if (!showResponse) return form;

	if (isResponseCollapsed) {
		return (
			<div className="flex h-full flex-col">
				<div className="min-h-0 flex-1">{form}</div>
				<ResponseHeader
					collapsed
					onToggleCollapse={() => setIsResponseCollapsed(false)}
				/>
			</div>
		);
	}

	return (
		<HSComp.ResizablePanelGroup
			direction="vertical"
			autoSaveId="questionnaire-preview-vertical-panel"
		>
			<HSComp.ResizablePanel minSize={20}>{form}</HSComp.ResizablePanel>
			<HSComp.ResizableHandle />
			<HSComp.ResizablePanel defaultSize={35} minSize={10}>
				<div className="flex h-full flex-col">
					<ResponseHeader
						collapsed={false}
						onToggleCollapse={() => setIsResponseCollapsed(true)}
					/>
					<ResponsePanel response={currentResponse} />
				</div>
			</HSComp.ResizablePanel>
		</HSComp.ResizablePanelGroup>
	);
}
