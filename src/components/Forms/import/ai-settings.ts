import { MODEL_OPTIONS, PROVIDER_BY_ID } from "./ai-provider-catalog";

const AI_SETTINGS_STORAGE_KEY = "ai-config";

export type AiSettings = {
	model?: string | null;
	models?: Record<string, Record<string, string> | null>;
	provider?: string | null;
	providers?: Record<string, Record<string, string>>;
	speech?: Record<string, string> | null;
};

export function readAiSettings(): AiSettings {
	try {
		const raw = window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
		const settings: unknown = raw ? JSON.parse(decodeURIComponent(raw)) : null;
		return settings && typeof settings === "object" && !Array.isArray(settings)
			? (settings as AiSettings)
			: {};
	} catch {
		return {};
	}
}

export function saveAiProviderSettings(
	provider: string,
	model: string,
	options: Record<string, string>,
) {
	const current = readAiSettings();
	const settings: AiSettings = {
		...current,
		provider,
		model,
		providers: { ...current.providers, [provider]: options },
		models: { ...current.models, [model]: current.models?.[model] ?? {} },
	};
	window.localStorage.setItem(
		AI_SETTINGS_STORAGE_KEY,
		encodeURIComponent(JSON.stringify(settings)),
	);
}

export function getAiProviderFieldValue(
	providers: AiSettings["providers"],
	providerId: string,
	fieldName: string,
) {
	return providers?.[providerId]?.[fieldName] ?? "";
}

export function getAiSettingsValidationError(
	settings: AiSettings,
): string | null {
	const provider = settings.provider ? PROVIDER_BY_ID[settings.provider] : null;
	if (!provider) return "Select an AI provider.";
	if (!settings.model?.trim()) return "Select an AI model.";
	if (
		!provider.customModel &&
		!MODEL_OPTIONS.some(
			(model) => model.id === settings.model && model.provider === provider.id,
		)
	) {
		return `Select a model supported by ${provider.name}.`;
	}
	const missingFields = provider.fields.filter(
		(field) =>
			provider.requiredOptions.includes(field.name) &&
			!getAiProviderFieldValue(
				settings.providers,
				provider.id,
				field.name,
			).trim(),
	);
	return missingFields.length
		? `Enter ${missingFields.map((field) => field.label).join(", ")}.`
		: null;
}

export function hasConfiguredAiProvider() {
	return getAiSettingsValidationError(readAiSettings()) === null;
}

export function subscribeToAiSettings(onChange: () => void) {
	const onStorage = (event: StorageEvent) => {
		if (event.key === AI_SETTINGS_STORAGE_KEY || event.key === null) onChange();
	};
	window.addEventListener("storage", onStorage);
	return () => {
		window.removeEventListener("storage", onStorage);
	};
}
