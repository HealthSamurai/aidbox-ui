import { useFhirServerVersion } from "@aidbox-ui/components/ConceptMap/version";
import { PreviewToolbar } from "@aidbox-ui/components/PlanDefinition/plan-definition-preview";
import type { Questionnaire } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
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

const QuestionnaireRenderer = lazy(() => import("./renderer"));

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
function ResponsePanel({ response }: { response: object | null }) {
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
 * The Questionnaire as a respondent sees it, rendered with the Formbox
 * renderer from the editor's current, possibly unsaved, state, with the
 * QuestionnaireResponse it produces below, the way the ViewDefinition builder
 * shows its result.
 */
export function QuestionnairePreview({
	questionnaire,
}: {
	questionnaire: Questionnaire;
}) {
	const fhirVersion = useFhirServerVersion();
	// Keyed by the questionnaire: an edit starts a new form and a new response.
	const questionnaireKey = JSON.stringify(questionnaire);
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
		response?.key === questionnaireKey ? response.value : null;

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
			/>
			<div className="min-h-0 flex-1 overflow-auto bg-bg-primary p-6">
				{/* The form sits on the page as a card, the way a respondent gets it. */}
				<div
					className="mx-auto max-w-full overflow-hidden rounded-lg border border-border-default bg-bg-primary"
					style={{ width: previewWidth }}
				>
					{fhirVersion ? (
						<div className="px-8 py-7" data-formbox-theme-root="">
							{/* A new key retries after the questionnaire is fixed. */}
							<RenderErrorBoundary key={`${questionnaireKey}-${session}`}>
								<Suspense fallback={<Loading />}>
									<QuestionnaireRenderer
										questionnaire={questionnaire}
										fhirVersion={fhirVersion}
										onResponseChange={(value) =>
											setResponse({ key: questionnaireKey, value })
										}
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
