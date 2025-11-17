import type { OperationOutcome } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { isOperationOutcome } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { hasProperty } from "@aidbox-ui/type-utils";
import type * as AidboxTypes from "@health-samurai/aidbox-client";
import { AidboxClientError } from "@health-samurai/aidbox-client";
import * as HSComp from "@health-samurai/react-components";
import type { MutationFunctionContext } from "@tanstack/react-query";

export function parseOperationOutcome(
	oo: OperationOutcome,
): { expression: string; diagnostics: string }[] {
	const issues = oo.issue;

	return issues.flatMap((issue) => {
		if (typeof issue !== "object" || issue === null) {
			return [];
		}

		const expression =
			hasProperty(issue, "expression") && typeof issue.expression === "string"
				? issue.expression
				: null;

		const diagnostics =
			hasProperty(issue, "diagnostics") && typeof issue.diagnostics === "string"
				? issue.diagnostics
				: null;

		if (expression === null || diagnostics === null) {
			return [];
		}

		return { expression, diagnostics };
	});
}

export function toastOperationOutcome(oo: OperationOutcome) {
	const issues = parseOperationOutcome(oo);
	if (issues.length === 0)
		throw new Error("Invalid OperationOutcome", { cause: oo });

	issues.forEach(({ expression, diagnostics }) => {
		HSComp.toast.error(
			<div className="text-left">
				<b>{expression}</b>
				<p>{diagnostics}</p>
			</div>,
			{
				position: "bottom-right",
				style: {
					margin: "1rem",
					backgroundColor: "var(--destructive)",
					color: "var(--accent)",
				},
			},
		);
	});
}

export async function toastAidboxClientError<T>(
	error: Error,
	_vars: T,
	_onMutateResult: unknown,
	_context: MutationFunctionContext,
) {
	if (error instanceof AidboxClientError) {
		const reason: AidboxTypes.AidboxRawResponse = error.rawResponse;
		const body = await reason.response.text();
		try {
			const parsed = JSON.parse(body);
			if (isOperationOutcome(parsed)) return toastOperationOutcome(parsed);
		} catch {
			// we don't care if error couln't be parsed
		}
	}
	HSComp.toast.error("Unknown error", {
		position: "bottom-right",
		style: {
			margin: "1rem",
			backgroundColor: "var(--destructive)",
			color: "var(--accent)",
		},
	});
	return;
}
