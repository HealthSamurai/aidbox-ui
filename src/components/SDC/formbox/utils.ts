import type {
	QuestionnaireResponse,
	Reference,
} from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";
import { getAidboxBaseURL } from "../../../utils";

export function humanize(value?: string | null) {
	if (!value) {
		return "";
	}

	return value
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function getFormBuilderUrl(questionnaireId?: string) {
	const url = new URL("ui/sdc", `${getAidboxBaseURL()}/`);
	const params = questionnaireId
		? `?${new URLSearchParams({ form: questionnaireId }).toString()}`
		: "";

	url.hash = `/forms/builder${params}`;

	return url.toString();
}

export function getLiquidTemplateEditorUrl(templateId: string) {
	const url = new URL("ui/sdc", `${getAidboxBaseURL()}/`);
	url.hash = `/forms/builder/liquid?${new URLSearchParams({ template: templateId }).toString()}`;

	return url.toString();
}

export function getNewLiquidTemplateUrl() {
	const url = new URL("ui/sdc", `${getAidboxBaseURL()}/`);
	// no id until the editor saves one: it asks the page for a new template
	url.hash = `/forms/builder/liquid?${new URLSearchParams({ new: "true" }).toString()}`;

	return url.toString();
}

export function getRendererWebComponentUrl() {
	return new URL(
		"static/aidbox-forms-renderer-webcomponent.js",
		`${getAidboxBaseURL()}/`,
	).toString();
}

export function getResponseRendererUrl(
	responseId: string,
	baseUrl = getAidboxBaseURL(),
) {
	const url = new URL("ui/sdc/renderer", `${baseUrl}/`);
	url.hash = `/questionnaire-response/${encodeURIComponent(responseId)}`;

	return url.toString();
}

/** Open a RequestGroup, optionally focused on one of its actions. */
export function getRequestGroupRendererUrl(
	requestGroupId: string,
	actionId?: string,
	baseUrl = getAidboxBaseURL(),
) {
	const url = new URL("ui/sdc/renderer", `${baseUrl}/`);
	const params = actionId
		? `?${new URLSearchParams({ "action-id": actionId })}`
		: "";
	url.hash = `/request-group/${encodeURIComponent(requestGroupId)}${params}`;

	return url.toString();
}

export function getQuestionnaireResponseJsonUrl(responseId: string) {
	const path = `/fhir/QuestionnaireResponse/${encodeURIComponent(responseId)}`;

	return `${getAidboxBaseURL()}${path}`;
}

/** Absolute URL of a box endpoint. */
export function getAidboxApiURL(path: string): string {
	return `${getAidboxBaseURL()}${path}`;
}

export function getResourceEditorUrl(
	resourceType: string,
	resourceId: string,
	search?: string,
) {
	return new URL(
		`u/resource/${encodeURIComponent(resourceType)}/edit/${encodeURIComponent(resourceId)}${search ?? ""}`,
		`${getAidboxBaseURL()}/`,
	).toString();
}

export function formatInstant(value?: string | null) {
	if (!value) {
		return "";
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

export function getReferenceLabel(
	resource?: Pick<Reference, "display" | "reference"> | null,
) {
	return resource?.display ?? resource?.reference ?? "";
}

export function getQuestionnaireResponseSubjectLabel(
	resource: Pick<QuestionnaireResponse, "subject">,
) {
	return getReferenceLabel(resource.subject);
}

/**
 * The statuses in which `authored` is the time the response was completed. In
 * any other status the filling is still going on and `authored` moves with every
 * partial save, so it must not be read as a completion date — not in the column,
 * not in the dialog, and not by the filter that searches on it.
 */
export const COMPLETED_RESPONSE_STATUSES = ["completed", "amended"] as const;

/** When a response was completed, or `undefined` while it still is not. */
export function getQuestionnaireResponseCompletionDate(
	resource: Pick<QuestionnaireResponse, "status" | "authored">,
) {
	return COMPLETED_RESPONSE_STATUSES.some(
		(status) => status === resource.status,
	)
		? resource.authored
		: undefined;
}

export function normalizeCanonicalReference(value?: string | null) {
	return value?.split("|")[0];
}

export function getCanonicalReferenceVersion(value?: string | null) {
	return value?.split("|")[1];
}
