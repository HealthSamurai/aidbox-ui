import {
	AppSelectContent,
	AppSelectItem,
} from "@aidbox-ui/components/app-select";
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Badge,
	Button,
	Input,
	Label,
	Select,
	SelectTrigger,
	SelectValue,
} from "@health-samurai/react-components";
import { Phone } from "lucide-react";
import { useEffect, useState } from "react";
import type { VoiceAgentContextSlot } from "./api";
import { type ContextCandidate, ContextPicker } from "./context-picker";
import { ModelField } from "./model-field";
import type { TestConnection, VoiceProvider } from "./test-settings-dialog";
import { Transcript } from "./transcript";
import type { Msg } from "./use-conversation";

/**
 * Running the agent: pick how to reach it, supply what the call needs, listen.
 * The transports are not equal — text, browser, and demo are sandboxes, while
 * phone reaches a person — so the phone one is styled and worded apart.
 */

export type Transport = "text" | "browser" | "demo" | "phone";

const TRANSPORT_LABEL: Record<Transport, string> = {
	text: "Text",
	browser: "Browser call",
	demo: "Demo call",
	phone: "Phone call",
};

const START_LABEL: Record<Transport, string> = {
	text: "Start chat",
	browser: "Start session",
	demo: "Start demo",
	phone: "Call",
};

export function ConversationPanel({
	transport,
	onTransportChange,
	phone,
	onPhoneChange,
	demoVoice,
	onDemoVoiceChange,
	demoVoiceProvider,
	demoVoiceTests,
	slots,
	contextValues,
	onContextChange,
	messages,
	running,
	status,
	error,
	blocker,
	canStart,
	onStart,
	onStop,
	onMute,
	onSay,
}: {
	transport: Transport;
	onTransportChange: (transport: Transport) => void;
	phone: string;
	onPhoneChange: (phone: string) => void;
	demoVoice: string;
	onDemoVoiceChange: (voice: string) => void;
	demoVoiceProvider: VoiceProvider;
	demoVoiceTests: TestConnection[];
	slots: VoiceAgentContextSlot[];
	contextValues: Record<string, string>;
	onContextChange: (
		name: string,
		id: string,
		resource?: ContextCandidate,
	) => void;
	messages: Msg[];
	running: boolean;
	status: string;
	error: string;
	blocker: string;
	canStart: boolean;
	onStart: () => void;
	onStop: () => void;
	onMute?: () => boolean;
	onSay: (text: string) => boolean;
}) {
	const [typed, setTyped] = useState("");
	const [muted, setMuted] = useState(false);

	useEffect(() => {
		if (!running) setMuted(false);
	}, [running]);

	return (
		<section
			className="flex flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-6rem)]"
			data-test-id="conversation-panel"
		>
			<div className="flex flex-wrap items-center gap-2">
				<Select
					value={transport}
					onValueChange={(value) => onTransportChange(value as Transport)}
				>
					<SelectTrigger
						aria-label="Transport"
						data-test-id="conversation-panel__transport-dropdown"
						className="w-40 bg-bg-primary"
					>
						<SelectValue />
					</SelectTrigger>
					<AppSelectContent data-test-id="conversation-panel__transport-options">
						{(Object.keys(TRANSPORT_LABEL) as Transport[]).map((key) => (
							<AppSelectItem
								key={key}
								data-test-id="conversation-panel__transport-option"
								value={key}
							>
								{TRANSPORT_LABEL[key]}
							</AppSelectItem>
						))}
					</AppSelectContent>
				</Select>
				<Button
					variant={transport === "phone" ? "primary" : "secondary"}
					data-test-id="conversation-panel__start-button"
					disabled={!canStart}
					title={blocker}
					onClick={onStart}
				>
					{transport === "phone" ? <Phone className="size-4" /> : null}
					{START_LABEL[transport]}
				</Button>
				<Button
					variant="secondary"
					danger={transport === "phone"}
					data-test-id="conversation-panel__stop-button"
					disabled={!running}
					onClick={onStop}
				>
					{transport === "phone" ? "Hang up" : "Stop"}
				</Button>
				{transport === "demo" && onMute ? (
					<Button
						variant="secondary"
						disabled={!running}
						onClick={() => {
							if (onMute()) setMuted((value) => !value);
						}}
					>
						{muted ? "Unmute voice" : "Mute voice"}
					</Button>
				) : null}
				{running ? (
					<Badge
						variant="secondary"
						data-test-id="conversation-panel__status-badge"
					>
						{status || "Live"}
					</Badge>
				) : null}
			</div>

			{blocker && !running ? (
				<p
					className="text-text-tertiary typo-label"
					data-test-id="conversation-panel__blocker-text"
				>
					{blocker}
				</p>
			) : null}

			{error ? (
				<Alert variant="critical" data-test-id="conversation-panel__error">
					<AlertTitle>Call error</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			{transport === "demo" ? (
				<ModelField
					kind="tts"
					label="Patient voice"
					onChange={onDemoVoiceChange}
					providerFilter={demoVoiceProvider}
					selectedProvider={demoVoiceProvider}
					tests={demoVoiceTests}
					value={demoVoice}
				/>
			) : null}

			{slots.length > 0 ? (
				<div className="flex flex-col gap-3">
					{slots.map((slot) => (
						<ContextPicker
							key={slot.name}
							slot={slot}
							value={contextValues[slot.name]}
							onChange={(id, resource) =>
								onContextChange(slot.name, id, resource)
							}
						/>
					))}
				</div>
			) : null}

			{transport === "phone" ? (
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="voice-phone">Number to call</Label>
					<Input
						id="voice-phone"
						data-test-id="conversation-panel__phone-input"
						type="text"
						inputMode="tel"
						className="bg-bg-primary font-mono"
						placeholder="+15551234567 or sip:me@host"
						value={phone}
						onChange={(e) => onPhoneChange(e.target.value)}
					/>
				</div>
			) : null}

			<Transcript messages={messages} />

			{transport === "text" ? (
				<form
					className="flex gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						if (onSay(typed.trim())) setTyped("");
					}}
				>
					<Input
						aria-label="Reply"
						data-test-id="conversation-panel__reply-input"
						className="flex-1 bg-bg-primary"
						placeholder="Answer as the patient…"
						value={typed}
						onChange={(e) => setTyped(e.target.value)}
					/>
					<Button
						variant="secondary"
						type="submit"
						data-test-id="conversation-panel__send-button"
						disabled={!typed.trim() || !running}
					>
						Send
					</Button>
				</form>
			) : null}
		</section>
	);
}
