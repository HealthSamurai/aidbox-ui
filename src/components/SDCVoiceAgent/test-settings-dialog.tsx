import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
} from "@health-samurai/react-components";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

export type VoiceKind = "llm" | "stt" | "tts";
export type VoiceProvider = "openai" | "deepgram" | "cartesia" | "elevenlabs";

type ProviderCredentials = { apiKey?: string; baseUrl?: string };

export type VoiceTestConfig = {
	selection: Record<VoiceKind, VoiceProvider>;
	providers: Partial<Record<VoiceProvider, ProviderCredentials>>;
};

export type TestConnection = ProviderCredentials & { provider: VoiceProvider };

const VOICE_TEST_CONFIG_KEY = "sdc-voice-test-config";

const PROVIDERS: Record<
	VoiceKind,
	Array<{ value: VoiceProvider; label: string }>
> = {
	llm: [{ value: "openai", label: "OpenAI" }],
	stt: [
		{ value: "deepgram", label: "Deepgram" },
		{ value: "cartesia", label: "Cartesia" },
	],
	tts: [
		{ value: "deepgram", label: "Deepgram" },
		{ value: "cartesia", label: "Cartesia" },
		{ value: "elevenlabs", label: "ElevenLabs" },
	],
};

const DEFAULT_CONFIG: VoiceTestConfig = {
	selection: { llm: "openai", stt: "deepgram", tts: "deepgram" },
	providers: {},
};

export function readVoiceTestConfig(): VoiceTestConfig {
	try {
		const stored = JSON.parse(
			localStorage.getItem(VOICE_TEST_CONFIG_KEY) ?? "{}",
		) as {
			providers?: Record<string, ProviderCredentials>;
			selection?: Partial<Record<VoiceKind | "openai-compatible", string>>;
		};
		const providers = { ...stored.providers };
		if (stored.selection?.llm === "openai-compatible") {
			const migrated = providers["openai-compatible"] ?? providers.openai;
			if (migrated) providers.openai = migrated;
		}
		delete providers["openai-compatible"];
		return {
			selection: {
				...DEFAULT_CONFIG.selection,
				...stored.selection,
				llm: "openai",
			} as Record<VoiceKind, VoiceProvider>,
			providers,
		};
	} catch {
		localStorage.removeItem(VOICE_TEST_CONFIG_KEY);
		return DEFAULT_CONFIG;
	}
}

export function writeVoiceTestConfig(config: VoiceTestConfig) {
	localStorage.setItem(VOICE_TEST_CONFIG_KEY, JSON.stringify(config));
}

export function testConnection(
	config: VoiceTestConfig,
	kind: VoiceKind,
): TestConnection | undefined {
	const provider = config.selection[kind];
	const credentials = config.providers[provider];
	if (!credentials?.apiKey?.trim()) return undefined;
	return { provider, ...credentials };
}

export function testConnections(
	config: VoiceTestConfig,
	kind: VoiceKind,
): TestConnection[] {
	return PROVIDERS[kind].flatMap(({ value: provider }) => {
		const credentials = config.providers[provider];
		return credentials?.apiKey?.trim() ? [{ provider, ...credentials }] : [];
	});
}

const PROVIDER_LABELS: Record<VoiceProvider, string> = {
	openai: "OpenAI",
	deepgram: "Deepgram",
	cartesia: "Cartesia",
	elevenlabs: "ElevenLabs",
};

export function TestSettingsDialog({
	config,
	onChange,
	onOpenChange,
	open,
}: {
	config: VoiceTestConfig;
	onChange: (config: VoiceTestConfig) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const [providers, setProviders] = useState(config.providers);

	useEffect(() => {
		if (open) setProviders(config.providers);
	}, [config.providers, open]);

	const selected: VoiceProvider[] = [
		"openai",
		"deepgram",
		"cartesia",
		"elevenlabs",
	];
	const patch = (provider: VoiceProvider, values: ProviderCredentials) =>
		setProviders((current) => ({
			...current,
			[provider]: { ...current[provider], ...values },
		}));

	const save = () => {
		onChange({ ...config, providers });
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[32rem]"
				data-test-id="voice-test-settings-dialog"
			>
				<DialogHeader className="border-border-primary border-b px-6 py-5 pr-14">
					<DialogTitle data-test-id="voice-test-settings-dialog__title">
						Voice test settings
					</DialogTitle>
					<DialogDescription>
						Credentials apply only to browser rehearsals on this device.
					</DialogDescription>
				</DialogHeader>

				<div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-6 py-5">
					<div className="flex items-start gap-3 rounded-md border border-border-warning bg-bg-warning-secondary px-4 py-3 text-sm text-text-warning-primary">
						<AlertTriangle
							aria-hidden="true"
							className="mt-0.5 size-4 shrink-0"
						/>
						<p>
							Keys are stored as plain text in this browser. Use scoped test
							keys and revoke them when you are done.
						</p>
					</div>

					{selected.map((provider, index) => {
						const credentials = providers[provider] ?? {};
						return (
							<section
								key={provider}
								className={
									index
										? "grid gap-3 border-border-primary border-t pt-5"
										: "grid gap-3"
								}
							>
								<h3 className="font-medium text-sm text-text-primary">
									{PROVIDER_LABELS[provider]}
								</h3>
								{provider === "openai" ? (
									<div className="grid gap-1.5">
										<Label htmlFor={`voice-test-${provider}-base-url`}>
											Base URL{" "}
											<span className="text-text-tertiary">(optional)</span>
										</Label>
										<Input
											id={`voice-test-${provider}-base-url`}
											data-test-id={`voice-test-settings-dialog__${provider}-base-url-input`}
											name={`${provider}-base-url`}
											type="text"
											inputMode="url"
											autoComplete="url"
											className="bg-bg-primary"
											placeholder="https://api.openai.com/v1"
											value={credentials.baseUrl ?? ""}
											onChange={(event) =>
												patch(provider, { baseUrl: event.target.value })
											}
										/>
									</div>
								) : null}
								<div className="grid gap-1.5">
									<Label htmlFor={`voice-test-${provider}-api-key`}>
										API key
									</Label>
									<Input
										id={`voice-test-${provider}-api-key`}
										data-test-id={`voice-test-settings-dialog__${provider}-api-key-input`}
										name={`${provider}-api-key`}
										type="password"
										autoComplete="off"
										className="bg-bg-primary"
										placeholder="Paste a scoped test key"
										value={credentials.apiKey ?? ""}
										onChange={(event) =>
											patch(provider, { apiKey: event.target.value })
										}
									/>
								</div>
							</section>
						);
					})}
				</div>

				<DialogFooter className="border-border-primary border-t px-6 py-4">
					<Button
						variant="ghost"
						danger
						data-test-id="voice-test-settings-dialog__clear-keys-button"
						onClick={() => setProviders({})}
					>
						Clear keys
					</Button>
					<Button
						variant="primary"
						data-test-id="voice-test-settings-dialog__save-button"
						onClick={save}
					>
						Save test settings
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
