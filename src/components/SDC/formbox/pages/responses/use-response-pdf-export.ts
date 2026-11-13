import { type AidboxClientR5, useAidboxClient } from "@aidbox-ui/AidboxClient";
import type {
	QuestionnaireResponse,
	Task,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import { toast } from "@health-samurai/react-components";
import { useCallback, useState } from "react";
import { sdcRequest, searchResources } from "../../api/plan-definitions";
import {
	buildResponsePdfFileName,
	getResponsePdfTarget,
	type PdfExportTarget,
	type QuestionnaireCatalog,
	type RequestGroupPdfTarget,
} from "./response-labels";
import { createResponsePdfFromTemplate } from "./response-template-pdf";

/**
 * Combine all saved RequestGroup responses in action order, regardless of grid
 * filters. A form without a print template is left out of the file.
 */
async function createRequestGroupPdf(
	client: AidboxClientR5,
	target: RequestGroupPdfTarget,
	questionnaireCatalog: QuestionnaireCatalog,
) {
	const { PDFDocument } = await import("pdf-lib");
	const pdf = await PDFDocument.create();
	const actions = target.requestGroup.action ?? [];
	const taskIds = actions.flatMap((action) =>
		action.resource?.reference?.startsWith("Task/")
			? [action.resource.reference.slice(5)]
			: [],
	);
	const tasks = taskIds.length
		? (
				await searchResources<Task>(client, "Task", [
					["_id", taskIds.join(",")],
				])
			).resources
		: [];
	const tasksByReference = new Map(
		tasks.map((task) => [`Task/${task.id}`, task]),
	);

	for (const action of actions) {
		const task = tasksByReference.get(action.resource?.reference ?? "");
		if (!task)
			throw new Error(`Could not load ${action.title || action.id || "form"}.`);
		const reference = task.output?.find((output) =>
			output.type.coding?.some(
				(coding) =>
					coding.system === "http://hl7.org/fhir/uv/sdc/CodeSystem/temp" &&
					coding.code === "questionnaire-response",
			),
		)?.valueReference?.reference;
		if (!reference) continue;

		const response = await sdcRequest<QuestionnaireResponse>(
			client,
			`/sdc/${reference}`,
		);
		const responseTarget = getResponsePdfTarget(response, questionnaireCatalog);
		if (!responseTarget) continue;
		const blob = await createResponsePdfFromTemplate(client, responseTarget);
		const document = await PDFDocument.load(await blob.arrayBuffer());
		const pages = await pdf.copyPages(document, document.getPageIndices());
		for (const page of pages) pdf.addPage(page);
	}

	if (!pdf.getPageCount())
		throw new Error(
			"The package has no responses whose form has a print template.",
		);
	pdf.setTitle(target.formLabel);
	return new Blob([new Uint8Array(await pdf.save())], {
		type: "application/pdf",
	});
}

function describeFailure(error: unknown) {
	return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * Saving several files from one click trips the browser's guard against
 * automatic downloads, and it drops the extra files silently — the page is
 * never told. All we can do is say so, so a missing file is not a mystery.
 */
const MULTIPLE_DOWNLOADS_NOTE =
	" If files are missing, allow this site to download multiple files.";

/** A response whose form has no print template is left out of the run. */
function describeSkipped(skippedCount: number) {
	return skippedCount === 1
		? "1 response has no print template."
		: `${skippedCount} responses have no print template.`;
}

/**
 * Export one or more responses as PDF files.
 *
 * Rendering a response takes seconds, so the whole run is reported through a
 * single toast that counts up, and the caller gets a busy flag to keep the
 * export controls from being pressed again mid-run.
 */
export function useResponsePdfExport(
	questionnaireCatalog: QuestionnaireCatalog,
) {
	const client = useAidboxClient();
	const [isExporting, setIsExporting] = useState(false);

	const exportResponses = useCallback(
		async (targets: PdfExportTarget[], skippedCount = 0) => {
			if (targets.length === 0) {
				if (skippedCount > 0) {
					toast.error(describeSkipped(skippedCount));
				}

				return;
			}

			const toastId = toast.loading(
				targets.length === 1
					? "Preparing PDF…"
					: `Preparing PDFs (1 of ${targets.length})…`,
			);
			const failures: string[] = [];

			setIsExporting(true);

			try {
				// Sequentially: one toast counts the run up, and a burst of parallel
				// renders gains nothing on the server.
				for (const [index, target] of targets.entries()) {
					if (targets.length > 1) {
						toast.loading(
							`Preparing PDFs (${index + 1} of ${targets.length})…`,
							{ id: toastId },
						);
					}

					try {
						const blob =
							"requestGroup" in target
								? await createRequestGroupPdf(
										client,
										target,
										questionnaireCatalog,
									)
								: await createResponsePdfFromTemplate(client, target);
						const url = URL.createObjectURL(blob);
						const link = document.createElement("a");
						link.href = url;
						link.download = buildResponsePdfFileName(target);
						document.body.appendChild(link);
						link.click();
						link.remove();
						URL.revokeObjectURL(url);
					} catch (error) {
						failures.push(`${target.formLabel}: ${describeFailure(error)}`);
					}
				}
			} finally {
				setIsExporting(false);
			}

			const exported = targets.length - failures.length;
			const skippedNote =
				skippedCount > 0 ? ` ${describeSkipped(skippedCount)}` : "";

			if (failures.length === 0) {
				const message =
					targets.length === 1
						? "PDF downloaded."
						: `${targets.length} PDFs downloaded.${MULTIPLE_DOWNLOADS_NOTE}`;

				toast.success(`${message}${skippedNote}`, { id: toastId });

				return;
			}

			toast.error(
				exported === 0
					? `Could not export the PDF. ${failures[0]}`
					: `Exported ${exported} of ${targets.length} PDFs.${skippedNote} ${failures[0]}`,
				{ id: toastId },
			);
		},
		[client, questionnaireCatalog],
	);

	return { exportResponses, isExporting };
}
