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
		if (typeof error.cause === "string") {
			const cause = JSON.parse(error.cause);
			const issues: unknown[] = cause.issue;
			issues.forEach((o: any) => {
				HSComp.toast.error(
					<div className="text-left">
						<b>{o.expression}</b>
						<p>{o.diagnostics}</p>
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
