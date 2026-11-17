/** Show a field's validation message beside the input it describes. */
export function PlanDefinitionFieldError({
	id,
	message,
}: {
	id: string;
	message?: string;
}) {
	return message ? (
		<p
			id={id}
			role="alert"
			className="whitespace-pre-line text-xs text-text-error-primary"
		>
			{message}
		</p>
	) : null;
}

/** Connect an invalid control to its inline message for assistive technology. */
export function planDefinitionFieldAttributes(
	message: string | undefined,
	errorId: string,
	descriptionId?: string,
) {
	return {
		"aria-invalid": Boolean(message),
		"aria-describedby": message ? errorId : descriptionId,
	};
}
