import type { OperationOutcome } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core";

function isOperationOutcome(value: unknown): value is OperationOutcome {
	return (
		typeof value === "object" &&
		value !== null &&
		"resourceType" in value &&
		value.resourceType === "OperationOutcome" &&
		"issue" in value &&
		Array.isArray(value.issue) &&
		value.issue.length > 0 &&
		value.issue.every(
			(issue) =>
				issue &&
				["fatal", "error", "warning", "information"].includes(issue.severity) &&
				typeof issue.code === "string",
		)
	);
}

export function errorOutcome(message: string): OperationOutcome {
	return {
		resourceType: "OperationOutcome",
		issue: [{ severity: "error", code: "processing", diagnostics: message }],
	};
}

/** Preserve the complete server response for persistent, navigable diagnostics. */
export class ResourceRequestError extends Error {
	readonly outcome: OperationOutcome;
	readonly status: number;
	constructor(outcome: OperationOutcome, status: number) {
		super(
			outcome.issue
				.map((issue) => issue.diagnostics ?? issue.details?.text ?? issue.code)
				.join("; "),
			{ cause: outcome },
		);
		this.name = "ResourceRequestError";
		this.outcome = outcome;
		this.status = status;
	}
}

export async function readResourceError(response: Response, fallback: string) {
	const text = await response.text();
	let outcome = errorOutcome(text || fallback);
	try {
		const body: unknown = JSON.parse(text);
		if (isOperationOutcome(body)) outcome = body;
		else {
			// Not a complete OperationOutcome (servers behind the SDC proxy leave out
			// issue codes, for one), but its diagnostics still say what went wrong.
			const message =
				typeof body === "object" && body
					? "issue" in body && Array.isArray(body.issue)
						? body.issue[0]?.diagnostics
						: "message" in body
							? body.message
							: undefined
					: undefined;
			outcome = errorOutcome(typeof message === "string" ? message : fallback);
		}
	} catch {
		// Plain-text errors and empty responses are valid error responses too.
	}
	return new ResourceRequestError(outcome, response.status);
}

export function toOperationOutcome(
	error: unknown,
	fallback = "Could not save changes",
): OperationOutcome {
	if (error instanceof ResourceRequestError) return error.outcome;
	if (isOperationOutcome(error)) return error;
	if (error instanceof Error && isOperationOutcome(error.cause))
		return error.cause;
	return errorOutcome(error instanceof Error ? error.message : fallback);
}
