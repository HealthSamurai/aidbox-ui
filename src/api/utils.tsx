import type { OperationOutcome } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { isOperationOutcome } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { hasProperty } from "@aidbox-ui/type-utils";
import type * as AidboxTypes from "@health-samurai/aidbox-client";
import { AidboxClientError } from "@health-samurai/aidbox-client";
import * as HSComp from "@health-samurai/react-components";
import type { MutationFunctionContext } from "@tanstack/react-query";

export function toastOperationOutcome(oo: OperationOutcome) {
	const issues = oo.issue;
	issues.forEach((o) => {
		if (typeof o !== "object" || o === null) {
			console.error("Invalid OperationOutcome error");
			return;
		}

		const expression =
			hasProperty(o, "expression") && typeof o.expression === "string"
				? o.expression
				: null;

		const diagnostics =
			hasProperty(o, "diagnostics") && typeof o.diagnostics === "string"
				? o.diagnostics
				: null;

		if (expression === null && diagnostics === null) {
			console.error("Empty OperationOutcome error");
			return;
		}

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
