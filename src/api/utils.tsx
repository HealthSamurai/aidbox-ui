import { hasProperty, isArray } from "@aidbox-ui/type-utils";
import * as HSComp from "@health-samurai/react-components";
import type { MutationFunctionContext } from "@tanstack/react-query";

export function onError<T>(
	cb?: (
		error: Error,
		vars: T,
		onMutateResult: unknown,
		context: MutationFunctionContext,
	) => Promise<unknown> | unknown,
) {
	return (
		error: Error,
		vars: T,
		onMutateResult: unknown,
		context: MutationFunctionContext,
	) => {
		if (error.cause !== null) {
			const cause: unknown =
				typeof error.cause === "string" ? JSON.parse(error.cause) : error.cause;

			if (
				typeof cause !== "object" ||
				cause === null ||
				!hasProperty(cause, "issue") ||
				!isArray(cause.issue)
			) {
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

			const issues = cause.issue;
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
		return cb?.(error, vars, onMutateResult, context);
	};
}
