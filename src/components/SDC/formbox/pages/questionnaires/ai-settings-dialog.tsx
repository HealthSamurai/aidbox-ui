import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Select,
	SelectTrigger,
	SelectValue,
} from "@health-samurai/react-components";
import { AlertTriangle, SquareMinus, SquarePlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppSelectContent, AppSelectItem } from "../../../shared/app-select";
import {
	applyProviderFieldDefaults,
	MODEL_OPTIONS,
	PROVIDER_BY_ID,
	PROVIDERS,
	type ProviderConfig,
} from "./ai-provider-catalog";
import {
	getAiProviderFieldValue,
	getAiSettingsValidationError,
	readAiSettings,
	saveAiProviderSettings,
} from "./ai-settings";

type AiSettingsDialogProps = {
	onOpenChange: (open: boolean) => void;
	open: boolean;
};

function providerOption(provider: ProviderConfig) {
	return (
		<div className="flex min-w-0 items-center gap-2">
			<img src={provider.icon} alt="" className="size-5 shrink-0" />
			<span className="truncate">{provider.name}</span>
		</div>
	);
}

export function AiSettingsDialog({
	onOpenChange,
	open,
}: AiSettingsDialogProps) {
	const [providerId, setProviderId] = useState<string | null>(null);
	const [modelId, setModelId] = useState<string | null>(null);
	const [providers, setProviders] = useState<
		Record<string, Record<string, string>>
	>({});
	const [saveError, setSaveError] = useState<string | null>(null);
	const [showOptionalFields, setShowOptionalFields] = useState(false);

	useEffect(() => {
		if (!open) {
			return;
		}

		const settings = readAiSettings();
		const provider = settings.provider ?? null;
		const providerValues = applyProviderFieldDefaults(settings.providers);

		setSaveError(null);
		setProviderId(provider);
		setModelId(settings.model ?? null);
		setProviders(providerValues);

		const providerConfig = provider ? PROVIDER_BY_ID[provider] : null;
		const providerOptions = provider ? providerValues[provider] : null;
		setShowOptionalFields(
			Boolean(
				providerConfig?.fields.some(
					(field) =>
						!providerConfig.requiredOptions.includes(field.name) &&
						providerOptions?.[field.name],
				),
			),
		);
	}, [open]);

	const selectedProvider = providerId ? PROVIDER_BY_ID[providerId] : null;
	const modelOptions = useMemo(
		() => MODEL_OPTIONS.filter((model) => model.provider === providerId),
		[providerId],
	);
	const requiredFields =
		selectedProvider?.fields.filter((field) =>
			selectedProvider.requiredOptions.includes(field.name),
		) ?? [];
	const optionalFields =
		selectedProvider?.fields.filter(
			(field) => !selectedProvider.requiredOptions.includes(field.name),
		) ?? [];

	const setProviderField = (field: string, value: string) => {
		if (!providerId) {
			return;
		}

		setProviders((previous) => ({
			...previous,
			[providerId]: {
				...(previous[providerId] ?? {}),
				[field]: value,
			},
		}));
	};

	const storesSecrets = Boolean(
		selectedProvider?.fields.some((field) => field.type === "password"),
	);

	const handleProviderChange = (nextProviderId: string) => {
		setProviderId(nextProviderId);
		setModelId(null);
		setShowOptionalFields(false);
	};

	const handleSave = () => {
		const validationError = getAiSettingsValidationError({
			provider: providerId,
			model: modelId,
			providers,
		});
		if (!providerId || !modelId || validationError) {
			setSaveError(validationError);
			return;
		}
		try {
			saveAiProviderSettings(providerId, modelId, providers[providerId] ?? {});
		} catch {
			setSaveError(
				"Could not save AI settings. Browser storage may be full or unavailable. Your changes are still here; try saving again.",
			);
			return;
		}
		setSaveError(null);
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[32rem]"
				data-ai-settings-dialog
				data-test-id="ai-settings-dialog"
			>
				<form
					className="flex min-h-0 flex-1 flex-col"
					onSubmit={(event) => {
						event.preventDefault();
						handleSave();
					}}
				>
					<DialogHeader className="border-b border-border-primary bg-bg-primary px-6 py-5 pr-14">
						<DialogTitle data-test-id="ai-settings-dialog__title">
							AI Settings
						</DialogTitle>
						<DialogDescription className="sr-only">
							Configure the AI provider and model used for PDF questionnaire
							import.
						</DialogDescription>
					</DialogHeader>
					<div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-6">
						<div className="grid gap-1.5">
							<div className="text-sm font-medium text-text-primary">
								AI Provider
							</div>
							<Select
								value={providerId ?? ""}
								onValueChange={handleProviderChange}
							>
								<SelectTrigger
									className="h-10 bg-bg-primary"
									data-test-id="ai-settings-form__provider-select"
								>
									<SelectValue placeholder="Select" />
								</SelectTrigger>
								<AppSelectContent className="max-h-72">
									{PROVIDERS.map((provider) => (
										<AppSelectItem
											key={provider.id}
											data-test-id="ai-settings-form__provider-option"
											value={provider.id}
										>
											{providerOption(provider)}
										</AppSelectItem>
									))}
								</AppSelectContent>
							</Select>
						</div>

						{storesSecrets ? (
							<div
								className="flex items-start gap-3 rounded-md border border-border-warning bg-bg-warning-secondary px-4 py-3"
								data-test-id="ai-settings-form__credentials-warning"
							>
								<AlertTriangle className="mt-0.5 size-4 shrink-0 text-text-warning-primary" />
								<div className="text-sm text-text-warning-primary">
									Credentials are stored in this browser's local storage in
									plain text and are sent from the browser straight to the
									provider. Any script running on this origin can read them —
									use a key scoped to this purpose and revoke it when you are
									done.
								</div>
							</div>
						) : null}

						{selectedProvider ? (
							<>
								{requiredFields.map((field) => (
									<div key={field.name} className="grid gap-1.5">
										<label
											htmlFor={`ai-settings-${selectedProvider.id}-${field.name}`}
											className="text-sm font-medium text-text-primary"
										>
											{field.label}{" "}
											<span className="text-text-error-primary">*</span>
										</label>
										<Input
											id={`ai-settings-${selectedProvider.id}-${field.name}`}
											data-test-id={`ai-settings-form__${field.name}-input`}
											type={field.type}
											value={getAiProviderFieldValue(
												providers,
												selectedProvider.id,
												field.name,
											)}
											placeholder={field.placeholder}
											className="bg-bg-primary"
											onChange={(event) =>
												setProviderField(field.name, event.target.value)
											}
										/>
									</div>
								))}

								{optionalFields.length > 0 ? (
									<button
										type="button"
										data-test-id="ai-settings-form__toggle-optional-settings-button"
										className="flex w-fit items-center gap-2 rounded-md px-2 py-1 text-sm text-text-secondary hover:bg-bg-secondary"
										onClick={() => setShowOptionalFields((value) => !value)}
									>
										{showOptionalFields ? (
											<SquareMinus className="size-4" />
										) : (
											<SquarePlus className="size-4" />
										)}
										{showOptionalFields
											? "Hide optional provider settings"
											: "Show optional provider settings"}
									</button>
								) : null}

								{showOptionalFields
									? optionalFields.map((field) => (
											<div key={field.name} className="grid gap-1.5">
												<label
													htmlFor={`ai-settings-${selectedProvider.id}-${field.name}`}
													className="text-sm font-medium text-text-primary"
												>
													{field.label}
												</label>
												<Input
													id={`ai-settings-${selectedProvider.id}-${field.name}`}
													data-test-id={`ai-settings-form__${field.name}-input`}
													type={field.type}
													value={getAiProviderFieldValue(
														providers,
														selectedProvider.id,
														field.name,
													)}
													placeholder={field.placeholder}
													className="bg-bg-primary"
													onChange={(event) =>
														setProviderField(field.name, event.target.value)
													}
												/>
											</div>
										))
									: null}

								{selectedProvider.customModel ? (
									<div className="grid gap-1.5">
										<label
											htmlFor="ai-settings-model-id"
											className="text-sm font-medium text-text-primary"
										>
											Model ID{" "}
											<span className="text-text-error-primary">*</span>
										</label>
										<Input
											id="ai-settings-model-id"
											data-test-id="ai-settings-form__model-id-input"
											value={modelId ?? ""}
											placeholder="e.g., gpt-3.5-turbo, llama2, mistral-7b-instruct"
											className="bg-bg-primary"
											onChange={(event) => setModelId(event.target.value)}
										/>
									</div>
								) : (
									<div className="grid gap-1.5">
										<div className="text-sm font-medium text-text-primary">
											AI Model{" "}
											<span className="text-text-error-primary">*</span>
										</div>
										<Select value={modelId ?? ""} onValueChange={setModelId}>
											<SelectTrigger
												className="h-10 bg-bg-primary"
												data-test-id="ai-settings-form__model-select"
											>
												<SelectValue placeholder="Select" />
											</SelectTrigger>
											<AppSelectContent className="max-h-72">
												{modelOptions.map((model) => (
													<AppSelectItem
														key={model.id}
														data-test-id="ai-settings-form__model-option"
														value={model.id}
													>
														{model.name}
													</AppSelectItem>
												))}
											</AppSelectContent>
										</Select>
									</div>
								)}
							</>
						) : null}
					</div>
					<DialogFooter className="border-t border-border-primary bg-bg-primary px-6 py-4">
						{saveError ? (
							<p
								role="alert"
								className="mr-auto text-sm text-text-error-primary"
							>
								{saveError}
							</p>
						) : null}
						<Button
							type="submit"
							data-test-id="ai-settings-dialog__save-button"
						>
							Save
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
