import type { AidboxClientR5 } from "@aidbox-ui/AidboxClient";

/**
 * PDF export through the response's own print template.
 *
 * `$render` finds the liquid template the form is linked to for a purpose and
 * returns the finished file, so the whole thing is one request and the text in
 * the file stays text. A form without a print template is not exported.
 */

import { resourceOf, withFallback } from "@aidbox-ui/utils/http";
import { ErrorResponse } from "@health-samurai/aidbox-client";
import { getTemplateLabel, type LiquidTemplateLibrary } from "../api/templates";
import { PRINT_PURPOSE, type ResponsePdfTarget } from "./response-labels";

async function templateName(client: AidboxClientR5, templateId: string) {
	const library = await withFallback<LiquidTemplateLibrary | undefined>(
		resourceOf(
			client.request<LiquidTemplateLibrary>({
				method: "GET",
				url: `/fhir/Library/${encodeURIComponent(templateId)}`,
				params: [["_elements", "id,name,title"]],
			}),
			"Failed to fetch the template",
		),
		undefined,
	);

	if (!library) {
		return templateId;
	}

	const label = getTemplateLabel(library);

	return label === "Untitled template"
		? templateId
		: `${label} (${templateId})`;
}

async function renderFailure(
	client: AidboxClientR5,
	response: Response,
	templateId?: string,
) {
	const named = templateId
		? await templateName(client, templateId)
		: "the template";
	const text = await response.text();
	let detail = `HTTP ${response.status}`;

	if (text) {
		try {
			const body = JSON.parse(text) as {
				issue?: Array<{ diagnostics?: string }>;
				message?: string;
			};
			detail = body.issue?.[0]?.diagnostics ?? body.message ?? text;
		} catch {
			detail = text;
		}
	}

	if (response.status === 404) {
		return `Could not print ${named}: the template is missing.`;
	}

	return `Could not print ${named}: ${detail}`;
}

/** Render the response's print template as a PDF. */
export async function createResponsePdfFromTemplate(
	client: AidboxClientR5,
	target: ResponsePdfTarget,
): Promise<Blob> {
	try {
		const { response } = await client.rawRequest({
			method: "POST",
			// the operation lives outside /fhir, see box.sdc.fhir.manifest
			url: `/QuestionnaireResponse/${encodeURIComponent(target.responseId)}/$render`,
			// a PDF; the client would ask for JSON by default
			headers: { accept: "*/*" },
			body: JSON.stringify({
				parameter: [
					{ name: "purpose", valueString: PRINT_PURPOSE },
					{ name: "format", valueString: "pdf" },
				],
				resourceType: "Parameters",
			}),
		});
		return await response.blob();
	} catch (error) {
		if (!(error instanceof ErrorResponse)) throw error;
		throw new Error(
			await renderFailure(
				client,
				error.responseWithMeta.response,
				target.templateId,
			),
		);
	}
}
