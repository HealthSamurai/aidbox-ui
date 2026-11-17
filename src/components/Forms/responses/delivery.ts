import type { SdcWorkflow } from "../api/forms";
import { formatInstant } from "../utils";

export function getDeliveryStatus(workflow?: SdcWorkflow) {
	if (!workflow) {
		return undefined;
	}

	const steps = workflow.steps ?? [];
	const sent = steps.some(
		(step) => step.outcome?.["delivery-status"] === "sent",
	);
	const latestDeliveryStatus = steps.at(-1)?.outcome?.["delivery-status"];

	if (sent) {
		return "sent";
	}

	if (latestDeliveryStatus) {
		return latestDeliveryStatus;
	}

	switch (workflow.status) {
		case "in-progress":
			return "queued";
		case "completed":
			return "sent";
		case "failed":
			return "failed";
		case "canceled":
		case "cancelled":
			return "canceled";
		default:
			return undefined;
	}
}

export function getDeliveryDate(workflow?: SdcWorkflow) {
	const sendFormSteps = (workflow?.steps ?? []).filter(
		(step) => step.name === "send-form",
	);

	// The form has been sent — show when it actually went out.
	const sentStep = sendFormSteps.findLast(
		(step) => step.outcome?.["delivery-status"] === "sent",
	);

	if (sentStep) {
		return sentStep.task?.["completed-at"] ?? sentStep.task?.["scheduled-at"];
	}

	// Sending is deferred — show when the form will be sent. A scheduled send
	// leaves a queued step carrying `scheduled-for`, plus the pending step that
	// will do the sending, whose `scheduled-at` is the same instant.
	const pendingStep = sendFormSteps.findLast(
		(step) => !step.task?.["completed-at"] && step.task?.["scheduled-at"],
	);

	if (pendingStep) {
		return pendingStep.task?.["scheduled-at"];
	}

	const scheduledFor = sendFormSteps.findLast(
		(step) => step.outcome?.["scheduled-for"],
	);

	return (
		scheduledFor?.outcome?.["scheduled-for"] ??
		sendFormSteps.findLast((step) => step.task?.["completed-at"])?.task?.[
			"completed-at"
		]
	);
}

const DELIVERY_STATUS_LABELS: Record<string, string> = {
	canceled: "Canceled",
	cancelled: "Canceled",
	failed: "Failed",
	queued: "Queued",
	sent: "Sent",
};

const PROVIDER_LABELS: Record<string, string> = {
	"mailgun-provider": "Mailgun",
	"postmark-provider": "Postmark",
	"sendgrid-provider": "SendGrid",
	"smtp-provider": "SMTP",
};

// Ported from `failure-message`, `src-ui/sdc/documents/core.cljc`.
const FAILURE_REASON_LABELS: Record<string, string> = {
	"deadline-expired": "Form expired",
	"reminder-sent": "Not completed after reminder",
};

export type DeliveryDetail = {
	label: string;
	value: string;
	/** Cut the value off with an ellipsis instead of wrapping it onto more lines. */
	truncate?: boolean;
};

/**
 * Everything the Delivery Details dialog shows: the status headline, then the
 * rows grouped into the three sections the dialog separates with a hairline.
 */
export type DeliveryDetailsView = {
	/** No workflow at all — the response was never sent by email. */
	isEmpty: boolean;
	status?: string;
	statusLabel?: string;
	/** One-line plain-English reading of the status, e.g. what happens next. */
	statusSummary?: string;
	statusRows: DeliveryDetail[];
	formRows: DeliveryDetail[];
	deliveryRows: DeliveryDetail[];
	/** Plumbing, kept behind the collapsed "Technical details" block. */
	technicalRows: DeliveryDetail[];
};

function humanize(value: string) {
	const [first, ...rest] = value.replace(/-/g, " ");

	return `${(first ?? "").toUpperCase()}${rest.join("")}`;
}

function getDeliveryStatusLabel(status?: string) {
	if (!status) {
		return undefined;
	}

	return DELIVERY_STATUS_LABELS[status.toLowerCase()] ?? humanize(status);
}

// The one date row means different things depending on where the delivery got
// to: an email already out, one still waiting for its slot, or a failed attempt.
function getDeliveryDateLabel(status?: string) {
	switch (status) {
		case "sent":
			return "Sent at";
		case "failed":
			return "Attempted at";
		default:
			return "Scheduled for";
	}
}

// "today at 1:13 PM" / "tomorrow at 9:00 AM" / "on Aug 20 at 10:00 AM": the
// status summary reads as a sentence, so nearby days are spelled out the way one
// would say them out loud rather than as a bare timestamp.
function formatRelativeDateTime(value: string) {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return undefined;
	}

	const now = new Date();
	const time = new Intl.DateTimeFormat(undefined, {
		timeStyle: "short",
	}).format(date);
	const startOfDay = (at: Date) =>
		new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
	const days = Math.round(
		(startOfDay(date) - startOfDay(now)) / (24 * 60 * 60 * 1000),
	);

	if (days === 0) {
		return `today at ${time}`;
	}

	if (days === 1) {
		return `tomorrow at ${time}`;
	}

	if (days === -1) {
		return `yesterday at ${time}`;
	}

	const day = new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
	}).format(date);

	return `on ${day} at ${time}`;
}

// Sits right under the status badge, so it says what the badge cannot: which way
// the delivery is facing — already out, still waiting, or stopped.
function getDeliveryStatusSummary(
	status?: string,
	deliveryDate?: string | null,
) {
	const when = deliveryDate ? formatRelativeDateTime(deliveryDate) : undefined;

	switch (status) {
		case "sent":
			return when ? `Sent to the recipient ${when}` : "Sent to the recipient";
		case "queued":
			return when ? `Scheduled to send ${when}` : "Waiting to be sent";
		case "failed":
			return when ? `Sending failed ${when}` : "Sending failed";
		case "canceled":
		case "cancelled":
			return "Sending was canceled";
		default:
			return undefined;
	}
}

function addDays(value: string, days: number) {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return undefined;
	}

	date.setDate(date.getDate() + days);

	return date;
}

// Days and hours together, so a deadline a few minutes short of a week reads
// "6d 23h left" instead of the bare "6d left" whole days alone would give.
function formatTimeLeft(leftMs: number) {
	const minutes = Math.floor(leftMs / 60_000);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (hours < 1) {
		return `${minutes}m left`;
	}

	if (days < 1) {
		return `${hours}h left`;
	}

	const hoursLeft = hours % 24;

	return hoursLeft > 0 ? `${days}d ${hoursLeft}h left` : `${days}d left`;
}

// Ported from `format-expiration`, `src-ui/sdc/documents/core.cljc`.
function formatExpiration(createdAt?: string, deadlineDays?: number) {
	if (!createdAt || !deadlineDays) {
		return undefined;
	}

	const expiresAt = addDays(createdAt, deadlineDays);

	if (!expiresAt) {
		return undefined;
	}

	const leftMs = expiresAt.getTime() - Date.now();
	const left = leftMs <= 0 ? "expired" : formatTimeLeft(leftMs);

	return `${formatInstant(expiresAt.toISOString())} (${left})`;
}

// Ported from `format-follow-up`, `src-ui/sdc/documents/core.cljc`: the reminder
// is sent `follow-up-delay-days` after the form was created, at `follow-up-time`
// UTC.
function formatFollowUp(workflow?: SdcWorkflow) {
	const input = workflow?.input;

	if (!input?.["follow-up-enabled"]) {
		return undefined;
	}

	const reminderStep = (workflow?.steps ?? []).findLast(
		(step) => step.name === "send-reminder",
	);

	if (reminderStep) {
		const sentAt = reminderStep.task?.["completed-at"];

		return sentAt ? `Sent ${formatInstant(sentAt)}` : "Sent";
	}

	const createdAt = input["created-at"];
	const delayDays = input["follow-up-delay-days"];

	if (!createdAt || delayDays === undefined) {
		return undefined;
	}

	const remindAt = addDays(createdAt, delayDays);

	if (!remindAt) {
		return undefined;
	}

	const time = input["follow-up-time"] ?? "10:00";
	const [hours, minutes] = time.split(":");
	remindAt.setUTCHours(Number(hours ?? 10), Number(minutes ?? 0), 0, 0);

	return `Scheduled ${formatInstant(remindAt.toISOString())}`;
}

function getFailureReason(workflow?: SdcWorkflow) {
	const steps = workflow?.steps ?? [];
	const error = steps.findLast((step) => step.outcome?.error?.message)?.outcome
		?.error?.message;

	if (error) {
		return error;
	}

	const reason = steps.findLast((step) => step.outcome?.reason)?.outcome
		?.reason;

	if (!reason) {
		return undefined;
	}

	return FAILURE_REASON_LABELS[reason] ?? humanize(reason);
}

function keepFilledRows(
	rows: Array<{ label: string; value?: string; truncate?: boolean }>,
) {
	return rows.filter((row): row is DeliveryDetail => Boolean(row.value));
}

/** Contents of the Delivery Details dialog. Rows without a value are dropped. */
export function buildDeliveryDetails({
	completedAt,
	formLabel,
	isSendingCanceled = false,
	subject,
	workflow,
}: {
	/** When the response was completed; omitted while it is still being filled in. */
	completedAt?: string;
	formLabel?: string;
	isSendingCanceled?: boolean;
	subject?: string;
	workflow?: SdcWorkflow;
}): DeliveryDetailsView {
	// No workflow means the response was never sent by email — there is nothing
	// to tell about its delivery.
	if (!workflow) {
		return {
			isEmpty: true,
			statusRows: [],
			formRows: [],
			deliveryRows: [],
			technicalRows: [],
		};
	}

	const status = isSendingCanceled ? "canceled" : getDeliveryStatus(workflow);
	const deliveryDate = getDeliveryDate(workflow);
	const input = workflow?.input;
	const provider = input?.provider;

	return {
		isEmpty: false,
		status,
		statusLabel: getDeliveryStatusLabel(status),
		statusSummary: getDeliveryStatusSummary(status, deliveryDate),
		statusRows: keepFilledRows([
			{
				label: getDeliveryDateLabel(status),
				value: deliveryDate ? formatInstant(deliveryDate) : undefined,
			},
			{
				label: "Completed at",
				value: completedAt ? formatInstant(completedAt) : undefined,
			},
			{ label: "Reason", value: getFailureReason(workflow) },
		]),
		formRows: keepFilledRows([
			{ label: "Form", value: formLabel, truncate: true },
			{ label: "Subject", value: subject },
			{ label: "Recipient", value: input?.email },
			{ label: "Email subject", value: input?.["email-subject"] },
		]),
		deliveryRows: keepFilledRows([
			{
				label: "Form link expires",
				value: formatExpiration(
					input?.["created-at"],
					input?.["deadline-days"],
				),
			},
			{ label: "Reminder", value: formatFollowUp(workflow) },
			{
				label: "Delivery initiated",
				value: input?.["created-at"]
					? formatInstant(input["created-at"])
					: undefined,
			},
		]),
		technicalRows: keepFilledRows([
			{
				label: "Provider",
				value: provider ? (PROVIDER_LABELS[provider] ?? provider) : undefined,
			},
		]),
	};
}

export function formatDeliveryDetails(view: DeliveryDetailsView) {
	return [
		...keepFilledRows([{ label: "Status", value: view.statusLabel }]),
		...view.statusRows,
		...view.formRows,
		...view.deliveryRows,
		...view.technicalRows,
	]
		.map((detail) => `${detail.label}: ${detail.value}`)
		.join("\n");
}

/** Whether the dialog has anything at all to show. */
export function hasDeliveryDetails(view: DeliveryDetailsView) {
	return (
		!view.isEmpty &&
		Boolean(
			view.statusLabel ||
				view.statusRows.length ||
				view.formRows.length ||
				view.deliveryRows.length ||
				view.technicalRows.length,
		)
	);
}

// The workflow stays in-progress after the email goes out (it keeps watching for
// completion), so the workflow status alone would still allow cancelling a form
// the patient has already received.
export function canCancelResponseSending({
	isSendingCanceled = false,
	workflow,
}: {
	isSendingCanceled?: boolean;
	workflow?: SdcWorkflow;
}) {
	return (
		!isSendingCanceled &&
		workflow?.status === "in-progress" &&
		getDeliveryStatus(workflow) !== "sent"
	);
}
