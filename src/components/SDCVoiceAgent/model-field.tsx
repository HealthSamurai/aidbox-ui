import { Label } from "@health-samurai/react-components";
import { useId, useState } from "react";
import { useVoiceModels } from "./api";
import { GroupedCombobox, type OptionGroup } from "./grouped-combobox";
import type { TestConnection, VoiceProvider } from "./test-settings-dialog";

/** Radix needs a non-empty value, so "no override" travels as a sentinel. */
const CLEARED = "__default__";

/** Picks a model from catalogues grouped by provider. */
export function ModelField({
	kind,
	label,
	onChange,
	onProviderChange,
	providerFilter,
	selectedProvider,
	tests = [],
	value,
}: {
	kind: "llm" | "stt" | "tts";
	label: string;
	onChange: (value: string) => void;
	onProviderChange?: (provider: VoiceProvider) => void;
	providerFilter?: VoiceProvider;
	selectedProvider?: VoiceProvider;
	tests?: TestConnection[];
	value: string;
}) {
	const fieldId = useId();
	const [opened, setOpened] = useState(false);
	const query = useVoiceModels(kind, opened, tests);
	const models = (query.data?.models ?? []).filter(
		(model) => !providerFilter || model.provider === providerFilter,
	);
	const fallback = query.data?.default;
	const providers = (query.data?.providers ?? []).filter(
		({ provider }) => !providerFilter || provider === providerFilter,
	);

	const byProvider = new Map<string, OptionGroup>();
	for (const { provider } of providers) {
		byProvider.set(provider, { heading: provider, options: [] });
	}
	for (const model of models) {
		const group = byProvider.get(model.provider) ?? {
			heading: model.provider,
			options: [],
		};
		group.options.push({
			value: model.name,
			// Voice ids are opaque, so catalogues may supply a readable label.
			label: model.label ?? model.name,
		});
		byProvider.set(model.provider, group);
	}
	for (const { provider, configured } of providers) {
		const group = byProvider.get(provider);
		if (group && group.options.length === 0) {
			group.options.push({
				value: `__provider_status__${provider}`,
				label: configured ? "Could not load models" : "No API key set",
				disabled: true,
				className: "text-text-error-primary opacity-70",
			});
		}
	}
	const groups = [...byProvider.values()];

	const known = models.some(
		(model) =>
			model.name === value &&
			(!selectedProvider || model.provider === selectedProvider),
	);
	if (value && !known) {
		groups.unshift({
			heading: "Current",
			options: [{ value, label: String(value) }],
		});
	}

	if (value) {
		groups.unshift({
			heading: " ",
			options: [
				{
					value: CLEARED,
					label: fallback ? `Use default (${fallback})` : "Use default",
				},
			],
		});
	}

	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={fieldId}>{label}</Label>
			<GroupedCombobox
				id={fieldId}
				ariaLabel={label}
				testId={`agent-form__${kind}-model-dropdown`}
				className="bg-bg-primary"
				emptyText={
					query.isPending && opened
						? "Loading…"
						: query.isError
							? "Could not reach the providers."
							: "No models found. Check Test settings."
				}
				groups={groups}
				loading={opened && query.isFetching}
				onOpen={() => setOpened(true)}
				placeholder={fallback ? `${fallback} (default)` : "Choose a model…"}
				searchPlaceholder="Search models…"
				value={value}
				onValueChange={(next, provider) => {
					onChange(next === CLEARED ? "" : next);
					if (next !== CLEARED && provider && provider !== "Current") {
						onProviderChange?.(provider as VoiceProvider);
					}
				}}
			/>
		</div>
	);
}
