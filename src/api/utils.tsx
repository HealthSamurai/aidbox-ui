import type { OperationOutcome } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { isOperationOutcome } from "@aidbox-ui/fhir-types/hl7-fhir-r5-core";
import { hasProperty } from "@aidbox-ui/type-utils";
import type * as AidboxTypes from "@health-samurai/aidbox-client";
import { ErrorResponse } from "@health-samurai/aidbox-client";
import * as HSComp from "@health-samurai/react-components";
import type { MutationFunctionContext } from "@tanstack/react-query";
import type { JSX } from "react";

export function toastError(expression: string, diagnostics?: string) {
	let message: JSX.Element;
	if (diagnostics) {
		message = (
			<div className="text-left">
				<b>{expression}</b>
				<p>{diagnostics}</p>
			</div>
		);
	} else {
		message = (
			<div className="text-left">
				<b>{expression}</b>
			</div>
		);
	}
	HSComp.toast.error(message, {
		position: "bottom-right",
		style: {
			margin: "1rem",
			backgroundColor: "var(--destructive)",
			color: "var(--accent)",
		},
	});
}

export function parseOperationOutcome(
	oo: OperationOutcome,
): { expression: string; diagnostics: string }[] {
	const issues = oo.issue;

	return issues.flatMap((issue) => {
		if (typeof issue !== "object" || issue === null) {
			return [];
		}

		const expression =
			hasProperty(issue, "expression") && Array.isArray(issue.expression)
				? issue.expression
						.filter((e): e is string => typeof e === "string")
						.join(", ")
				: null;

		const diagnostics =
			hasProperty(issue, "diagnostics") && typeof issue.diagnostics === "string"
				? issue.diagnostics
				: null;

		if (expression === null && diagnostics === null) {
			return [];
		}

		return {
			expression: expression || "Error",
			diagnostics: diagnostics || "unknown error",
		};
	});
}

export function toastOperationOutcome(oo: OperationOutcome) {
	const issues = parseOperationOutcome(oo);
	if (issues.length === 0)
		return toastError(
			"Invalid OperationOutcome: no details provided",
			JSON.stringify(oo),
		);

	issues.forEach(({ expression, diagnostics }) => {
		toastError(expression, diagnostics);
	});
}

export async function toastErrorResponse(error: Error) {
	if (error instanceof ErrorResponse) {
		const reason: AidboxTypes.ResponseWithMeta = error.responseWithMeta;
		const body = await reason.response.text();
		try {
			const parsed = JSON.parse(body);
			if (isOperationOutcome(parsed)) return toastOperationOutcome(parsed);
		} catch {}
	}
	return toastError("Error", error.message);
}

export async function onError(error: unknown) {
	if (error instanceof Error) {
		if (error instanceof ErrorResponse) return await toastErrorResponse(error);

		if (isOperationOutcome(error.cause))
			return toastOperationOutcome(error.cause);

		return toastError("Error", error.message);
	} else {
		return toastError("Error", "unknown error");
	}
}

export async function onMutationError<T>(
	error: Error,
	_vars: T,
	_onMutateResult: unknown,
	_context: MutationFunctionContext,
) {
	return onError(error);
}
