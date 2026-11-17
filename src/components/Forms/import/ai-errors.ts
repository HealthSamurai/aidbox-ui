type ErrorLike = Record<string, unknown>;

function asErrorLike(error: unknown): ErrorLike | null {
	return typeof error === "object" && error !== null
		? (error as ErrorLike)
		: null;
}

function parseStatusCode(value: unknown) {
	if (typeof value === "number" && Number.isInteger(value)) {
		return value;
	}

	if (typeof value === "string" && /^\d{3}$/.test(value)) {
		return Number(value);
	}

	return null;
}

function findStatusCode(
	error: unknown,
	visited = new Set<unknown>(),
): number | null {
	const candidate = asErrorLike(error);

	if (!candidate || visited.has(error)) {
		return null;
	}

	visited.add(error);

	const directStatus =
		parseStatusCode(candidate.statusCode) ?? parseStatusCode(candidate.status);

	if (directStatus !== null) {
		return directStatus;
	}

	return (
		findStatusCode(candidate.lastError, visited) ??
		findStatusCode(candidate.cause, visited)
	);
}

function findErrorMessage(error: unknown): string | null {
	if (typeof error === "string") {
		return error;
	}

	const message = asErrorLike(error)?.message;
	return typeof message === "string" && message.trim() ? message : null;
}

export function getAiProviderErrorMessage(
	providerName: string,
	error: unknown,
) {
	const statusCode = findStatusCode(error);

	if (statusCode === 401) {
		return `${providerName} authentication failed. Check the API key and organization in AI Settings.`;
	}

	if (statusCode === 403) {
		return `${providerName} denied access. Check the API key, organization, project, and model permissions in AI Settings.`;
	}

	if (statusCode === 429) {
		return `${providerName} rate limit or quota was exceeded. Check the account quota or try again later.`;
	}

	const message = findErrorMessage(error);

	if (message && /failed to fetch/i.test(message)) {
		return `The ${providerName} request failed before the browser could read the provider's error. Check the API key, organization, base URL, and browser network or CORS settings.`;
	}

	return message ?? "Failed to generate questionnaire";
}
