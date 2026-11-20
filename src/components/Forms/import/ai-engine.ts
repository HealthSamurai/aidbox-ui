import type { Questionnaire } from "@aidbox-ui/fhir-types/hl7-fhir-r4-core/index";
import type { LanguageModel } from "ai";
import { getAiProviderErrorMessage } from "./ai-errors";
import {
	type AiModelOption,
	MODEL_OPTIONS,
	PROVIDER_BY_ID,
	type ProviderConfig,
} from "./ai-provider-catalog";
import {
	type AiSettings,
	getAiProviderFieldValue,
	readAiSettings,
} from "./ai-settings";
import { SYSTEM_PROMPT, transformGeneratedQuestionnaire } from "./importer-ai";

type GenerateQuestionnaireOptions = {
	onStream?: (questionnaire: Questionnaire) => void;
	pdfBuffer: ArrayBuffer;
	signal?: AbortSignal;
};

type GenerateQuestionnaireResult = {
	finishReason?: string;
	questionnaire: Questionnaire;
};

function kebabToCamel(value: string) {
	const camel = value.replace(/-([a-z])/g, (_, char: string) =>
		char.toUpperCase(),
	);

	return camel.replace(/Url$/, "URL");
}

function toProviderOptions(
	provider: ProviderConfig,
	providerOptions: Record<string, string>,
) {
	return {
		name: provider.id,
		...Object.fromEntries(
			Object.entries(providerOptions)
				.filter(([, value]) => value !== "")
				.map(([key, value]) => [kebabToCamel(key), value]),
		),
		...(provider.customConfig ?? {}),
	};
}

function getModelOption(settings: AiSettings): AiModelOption | null {
	if (!settings.model) {
		return null;
	}

	const provider = settings.provider ? PROVIDER_BY_ID[settings.provider] : null;

	if (provider?.customModel) {
		return {
			id: settings.model,
			modelApiName: settings.model,
			name: settings.model,
			provider: provider.id,
		};
	}

	return (
		MODEL_OPTIONS.find(
			(model) =>
				model.id === settings.model && model.provider === settings.provider,
		) ?? null
	);
}

function validateConfiguredProvider(settings: AiSettings) {
	const provider = settings.provider ? PROVIDER_BY_ID[settings.provider] : null;
	const model = getModelOption(settings);

	if (!provider || !model) {
		throw new Error(
			"Please set your AI provider in the settings to import PDF files.",
		);
	}

	const providerOptions = settings.providers?.[provider.id] ?? {};
	const missingOptions = provider.requiredOptions.filter(
		(option) =>
			getAiProviderFieldValue(
				settings.providers,
				provider.id,
				option,
			).trim() === "",
	);

	if (missingOptions.length > 0) {
		throw new Error(
			`Missing required options for ${provider.name}: ${missingOptions.join(
				", ",
			)}`,
		);
	}

	return { provider, model, providerOptions };
}

async function makeModel(
	provider: ProviderConfig,
	model: AiModelOption,
	providerOptions: Record<string, string>,
): Promise<LanguageModel> {
	const createProvider = await provider.loadCreateProvider();
	const modelFactory = createProvider(
		toProviderOptions(provider, providerOptions),
	);

	if (typeof modelFactory !== "function") {
		throw new Error(`Failed to initialize AI provider: ${provider.name}`);
	}

	return modelFactory(model.modelApiName);
}

function ensureQuestionnaire(value: unknown): Questionnaire {
	const object = Array.isArray(value) ? value[0] : value;

	if (!isQuestionnaireResource(object)) {
		throw new Error("AI did not return a Questionnaire resource.");
	}

	return transformGeneratedQuestionnaire(object as Questionnaire);
}

function isQuestionnaireResource(value: unknown): value is Questionnaire {
	return (
		!!value &&
		typeof value === "object" &&
		(value as { resourceType?: string }).resourceType === "Questionnaire"
	);
}

function maybeQuestionnaire(value: unknown): Questionnaire | null {
	const object = Array.isArray(value) ? value[0] : value;
	return isQuestionnaireResource(object) ? object : null;
}

function isAbortError(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"name" in error &&
		error.name === "AbortError"
	);
}

async function generateWithProvider(
	{ onStream, pdfBuffer, signal }: GenerateQuestionnaireOptions,
	{
		provider,
		model,
		providerOptions,
	}: ReturnType<typeof validateConfiguredProvider>,
): Promise<GenerateQuestionnaireResult> {
	const [{ streamObject }, aiModel] = await Promise.all([
		import("ai"),
		makeModel(provider, model, providerOptions),
	]);

	const result = await streamObject({
		output: "no-schema",
		abortSignal: signal,
		// Retries are silent and back off, so a rate-limited provider would leave
		// the dialog saying "Generating..." for minutes. Fail fast and let the user
		// press Generate again.
		maxRetries: 2,
		model: aiModel,
		messages: [
			{ role: "system", content: SYSTEM_PROMPT },
			{
				role: "user",
				content: [
					{
						type: "text",
						text: "Generate questionnaire from this PDF document:",
					},
					{
						type: "file",
						mediaType: "application/pdf",
						data: pdfBuffer.slice(0),
					},
				],
			},
		],
	});

	let finishReason: string | undefined;

	for await (const part of result.fullStream) {
		const streamPart = part as Record<string, unknown>;

		if (signal?.aborted) {
			throw new DOMException("Aborted", "AbortError");
		}

		if (streamPart.type === "object") {
			const questionnaire = maybeQuestionnaire(streamPart.object);

			if (questionnaire) {
				onStream?.(transformGeneratedQuestionnaire(questionnaire));
			}
		} else if (streamPart.type === "finish") {
			finishReason =
				typeof streamPart.finishReason === "string"
					? streamPart.finishReason
					: undefined;
		} else if (streamPart.type === "error") {
			throw streamPart.error ?? new Error("Failed to generate questionnaire");
		}
	}

	const finalObject = await result.object;

	return {
		finishReason,
		questionnaire: ensureQuestionnaire(finalObject),
	};
}

export async function generateQuestionnaireFromPdf(
	options: GenerateQuestionnaireOptions,
): Promise<GenerateQuestionnaireResult> {
	const providerConfig = validateConfiguredProvider(readAiSettings());

	try {
		return await generateWithProvider(options, providerConfig);
	} catch (error) {
		if (options.signal?.aborted || isAbortError(error)) {
			throw error;
		}

		throw new Error(
			getAiProviderErrorMessage(providerConfig.provider.name, error),
			{ cause: error },
		);
	}
}
