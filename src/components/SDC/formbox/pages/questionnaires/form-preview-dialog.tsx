import type { Questionnaire } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import * as HSComp from "@health-samurai/react-components";
import { AlertCircle, ChevronDown, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import type { Form } from "../../api/forms";
import { getFormLabel, useQuestionnaire } from "../../api/forms";
import { usePlanDefinition } from "../../api/plan-definitions";
import {
	questionnaireTemplates,
	useRenderedQuestionnaire,
	useTemplateNames,
} from "../../api/templates";
import { Renderer } from "../../components/renderer";
import { generateId } from "../../shared/id";
import { PreviewDialog } from "../../shared/preview-dialog";
import { PlanDefinitionPreviewFrame } from "../plan-definitions/plan-definition-preview";

const FORM_VIEW = "form";

function TemplateSelect({
	onSelect,
	purpose,
	templates,
}: {
	onSelect: (purpose: string | null) => void;
	purpose: string | null;
	templates: Array<{ label: string; purpose: string }>;
}) {
	const selected = templates.find((template) => template.purpose === purpose);

	return (
		<HSComp.DropdownMenu>
			<HSComp.DropdownMenuTrigger asChild>
				<HSComp.Button
					className="min-w-40 max-w-64 justify-start gap-1.5"
					data-test-id="form-preview-dialog__template-button"
					size="small"
					variant="secondary"
				>
					<FileText className="size-4 shrink-0" />
					<span className="truncate">{selected?.label ?? "Form"}</span>
					<ChevronDown className="ml-auto size-4 shrink-0" />
				</HSComp.Button>
			</HSComp.DropdownMenuTrigger>
			<HSComp.DropdownMenuContent align="start">
				<HSComp.DropdownMenuItem
					data-test-id="form-preview-dialog__template-form"
					onClick={() => onSelect(null)}
				>
					Form
				</HSComp.DropdownMenuItem>
				{templates.map((template) => (
					<HSComp.DropdownMenuItem
						data-test-id="form-preview-dialog__template-item"
						key={`${template.purpose}-${template.label}`}
						onClick={() => onSelect(template.purpose)}
					>
						<span className="truncate">{template.label}</span>
						<span className="ml-auto text-text-tertiary text-xs uppercase">
							{template.purpose}
						</span>
					</HSComp.DropdownMenuItem>
				))}
			</HSComp.DropdownMenuContent>
		</HSComp.DropdownMenu>
	);
}

function TemplatePreview({
	purpose,
	questionnaire,
}: {
	purpose: string;
	questionnaire: Questionnaire;
}) {
	const { data, error, isLoading } = useRenderedQuestionnaire(
		questionnaire,
		purpose,
	);

	if (isLoading) {
		return (
			<div
				className="flex flex-1 items-center justify-center bg-bg-primary px-4 py-6 text-sm text-text-secondary"
				data-test-id="form-preview-dialog__template-loading"
			>
				Rendering template…
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-4" data-test-id="form-preview-dialog__template-error">
				<HSComp.Alert variant="warning">
					<AlertCircle className="size-4" />
					<HSComp.AlertDescription>
						{error instanceof Error
							? error.message
							: "Failed to render the template."}
					</HSComp.AlertDescription>
				</HSComp.Alert>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 bg-white p-4">
			<iframe
				className="h-full min-h-0 flex-1 border-0 bg-white"
				data-test-id="form-preview-dialog__template-result"
				sandbox="allow-same-origin"
				srcDoc={data ?? ""}
				title="Template preview"
			/>
		</div>
	);
}

/** Preview a Questionnaire or PlanDefinition, loading its full definition unless one is supplied. */
export function FormPreviewDialog({
	onOpenChange,
	form,
	loadResource = true,
}: {
	onOpenChange: (open: boolean) => void;
	form: Form | null;
	loadResource?: boolean;
}) {
	const [handle] = useState(() => generateId());
	const [view, setView] = useState<string>(FORM_VIEW);
	const isPlanDefinition = form?.resourceType === "PlanDefinition";
	const questionnaire = useQuestionnaire(
		loadResource && form?.resourceType === "Questionnaire"
			? (form.id ?? "")
			: "",
	);
	const planDefinition = usePlanDefinition(
		loadResource && isPlanDefinition ? form.id : undefined,
	);
	const query = isPlanDefinition ? planDefinition : questionnaire;
	const fullForm = loadResource ? query.data : form;

	// only a Questionnaire prints through a template; a PlanDefinition has none of its own
	const formQuestionnaire =
		fullForm?.resourceType === "Questionnaire" ? fullForm : undefined;
	const linkedTemplates = useMemo(
		() => (formQuestionnaire ? questionnaireTemplates(formQuestionnaire) : []),
		[formQuestionnaire],
	);
	const { data: templateNames } = useTemplateNames(
		linkedTemplates.map((linked) => linked.templateId),
	);
	const templates = linkedTemplates.map((linked) => ({
		label: templateNames?.get(linked.templateId) ?? "Untitled template",
		purpose: linked.purpose,
	}));
	const purpose = view === FORM_VIEW ? null : view;

	return (
		<PreviewDialog
			open={form !== null}
			onOpenChange={(next) => {
				// the next form opens on its form view, not on a template picked here
				if (!next) {
					setView(FORM_VIEW);
				}

				onOpenChange(next);
			}}
			title={form ? getFormLabel(form) : "Preview"}
			testId="form-preview-dialog"
			error={
				loadResource && query.isError
					? `Failed to load the full ${isPlanDefinition ? "package" : "questionnaire"} for preview.`
					: undefined
			}
			isLoading={loadResource && query.isLoading}
			toolbar={
				templates.length > 0 ? (
					<div className="flex items-center border-b bg-bg-primary px-4 py-2">
						<TemplateSelect
							onSelect={(next) => setView(next ?? FORM_VIEW)}
							purpose={purpose}
							templates={templates}
						/>
					</div>
				) : null
			}
		>
			{fullForm?.resourceType === "PlanDefinition" ? (
				<PlanDefinitionPreviewFrame
					key={fullForm.id}
					planDefinition={fullForm}
					handle={handle}
				/>
			) : formQuestionnaire && purpose ? (
				<TemplatePreview purpose={purpose} questionnaire={formQuestionnaire} />
			) : fullForm ? (
				<Renderer questionnaire={fullForm} />
			) : null}
		</PreviewDialog>
	);
}
