import type { LanguageModel } from "ai";
import catalogJson from "./ai-provider-catalog.json";

/** Turns the settings a provider takes into the model factory of its AI SDK package. */
type CreateProvider = (
	options: Record<string, unknown>,
) => (modelApiName: string) => LanguageModel;

// Bundled, each in a chunk of its own that loads when the provider is used.
const PROVIDER_LOADERS: Record<string, () => Promise<CreateProvider>> = {
	openai: () => import("@ai-sdk/openai").then((m) => m.createOpenAI),
	anthropic: () => import("@ai-sdk/anthropic").then((m) => m.createAnthropic),
	google: () =>
		import("@ai-sdk/google").then((m) => m.createGoogleGenerativeAI),
	"openai-compatible": () =>
		import("@ai-sdk/openai-compatible").then(
			(m) =>
				({ baseURL, ...options }) =>
					// The settings dialog requires a base URL for this provider.
					m.createOpenAICompatible({
						...options,
						name: "openai-compatible",
						baseURL: String(baseURL),
					}),
		),
};

export type ProviderField = {
	defaultValue?: string;
	label: string;
	name: string;
	placeholder: string;
	type: "password" | "text";
};

export type ProviderConfig = {
	customConfig?: Record<string, unknown>;
	customModel?: boolean;
	fields: ProviderField[];
	icon: string;
	id: string;
	loadCreateProvider: () => Promise<CreateProvider>;
	name: string;
	requiredOptions: string[];
};

export type AiModelOption = {
	id: string;
	modelApiName: string;
	name: string;
	provider: string;
};

type CatalogField = ProviderField & {
	required?: boolean;
};

type CatalogProvider = {
	customModel?: boolean;
	fields: CatalogField[];
	icon: string;
	id: string;
	models: string[];
	name: string;
};

const PROVIDER_CUSTOM_CONFIG: Record<string, Record<string, unknown>> = {
	anthropic: {
		headers: { "anthropic-dangerous-direct-browser-access": "true" },
	},
};

const AI_PROVIDER_CATALOG = catalogJson as CatalogProvider[];

export const PROVIDERS: ProviderConfig[] = AI_PROVIDER_CATALOG.filter(
	(provider) => provider.customModel || provider.models.length > 0,
).flatMap((provider) => {
	const loadCreateProvider = PROVIDER_LOADERS[provider.id];
	if (!loadCreateProvider) return [];
	return [
		{
			customConfig: PROVIDER_CUSTOM_CONFIG[provider.id],
			customModel: provider.customModel,
			fields: provider.fields.map(
				({ defaultValue, label, name, placeholder, type }) => ({
					defaultValue,
					label,
					name,
					placeholder,
					type,
				}),
			),
			icon: provider.icon,
			id: provider.id,
			name: provider.name,
			loadCreateProvider,
			requiredOptions: provider.fields
				.filter((field) => field.required)
				.map((field) => field.name),
		},
	];
});

export const MODEL_OPTIONS: AiModelOption[] = AI_PROVIDER_CATALOG.flatMap(
	(provider) =>
		provider.models.map((modelApiName) => ({
			id: `${provider.id}:${modelApiName}`,
			modelApiName,
			name: modelApiName,
			provider: provider.id,
		})),
);

export const PROVIDER_BY_ID = Object.fromEntries(
	PROVIDERS.map((provider) => [provider.id, provider]),
) as Record<string, ProviderConfig>;

export function applyProviderFieldDefaults(
	providers: Record<string, Record<string, string>> | undefined,
): Record<string, Record<string, string>> {
	const nextProviders = structuredClone(providers ?? {});

	for (const provider of PROVIDERS) {
		for (const field of provider.fields) {
			if (
				field.defaultValue !== undefined &&
				!nextProviders[provider.id]?.[field.name]?.trim()
			) {
				nextProviders[provider.id] = {
					...(nextProviders[provider.id] ?? {}),
					[field.name]: field.defaultValue,
				};
			}
		}
	}

	return nextProviders;
}
