import type { AidboxClientR5 } from "@aidbox-ui/AidboxClient";
import { toast } from "@health-samurai/react-components";
import { useCallback } from "react";
import type { VoiceAgentContextSlot } from "./api";
import type { Transport } from "./conversation-panel";
import type { useConversation } from "./use-conversation";

/**
 * Placing the run: save whatever is on screen, then reach the agent over the
 * chosen transport. Saving first is the invariant — a run must never use a
 * prompt that is not what is stored.
 */

/**
 * $call refuses a bad request with an OperationOutcome, and the client surfaces
 * it as a thrown value rather than an Error, so the diagnostics have to be dug
 * out by hand or the page just says "undefined".
 */
export function errorText(error: unknown): string {
	const source =
		error && typeof error === "object" && "error" in error
			? (error as { error: unknown }).error
			: error && typeof error === "object" && "resource" in error
				? (error as { resource: unknown }).resource
				: error;

	if (source && typeof source === "object") {
		const outcome = source as {
			issue?: Array<{ diagnostics?: string }>;
			message?: string;
		};
		const diagnostics = outcome.issue
			?.map((issue) => issue.diagnostics)
			.filter(Boolean)
			.join("; ");
		if (diagnostics) return diagnostics;
		if (outcome.message) return outcome.message;
	}

	if (source instanceof Error) return source.message;
	return String(source ?? "unknown error");
}

export function useAgentRun({
	browserCredentials,
	call,
	client,
	contextValues,
	demoVoice,
	draft,
	phone,
	save,
	slots,
	transport,
}: {
	browserCredentials: Record<string, { apiKey?: string; baseUrl?: string }>;
	call: ReturnType<typeof useConversation>;
	client: AidboxClientR5;
	contextValues: Record<string, string>;
	demoVoice: string;
	/** What is on screen right now: rehearsals run this, unsaved. */
	draft: unknown;
	phone: string;
	save: () => Promise<string | undefined>;
	slots: VoiceAgentContextSlot[];
	transport: Transport;
}) {
	const placeCall = useCallback(
		async ({
			agent,
			browser,
		}: {
			/** A saved agent's id, or the draft itself for a rehearsal. */
			agent: string | unknown;
			browser?: boolean;
		}) => {
			call.setStatus(browser ? "Connecting" : `Dialling ${phone}`);

			const result = await client.request<{
				parameter?: {
					name: string;
					valueString?: string;
					valueReference?: { reference?: string };
				}[];
			}>({
				method: "POST",
				url: "/sdc/voice/$call",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					resourceType: "Parameters",
					parameter: [
						{ name: "transport", valueString: browser ? "browser" : "phone" },
						// A draft travels whole, with its Devices contained: the box keeps
						// it inside the Task rather than saving anything, so trying a model
						// out leaves nothing behind.
						typeof agent === "string"
							? {
									name: "agent",
									valueReference: { reference: `SDCVoiceAgent/${agent}` },
								}
							: { name: "agent", resource: agent },
						...(browser ? [] : [{ name: "to", valueString: phone }]),
						// every declared slot has to arrive filled in, or $call refuses
						// rather than start a half-blind conversation
						...slots.map((slot) => ({
							name: "context",
							part: [
								{ name: "name", valueString: slot.name },
								{
									name: "content",
									valueReference: {
										reference: `${slot.type}/${contextValues[slot.name]}`,
									},
								},
							],
						})),
					],
				}),
			});

			if (!result.isOk()) throw result.value;

			const params = result.value.resource?.parameter ?? [];
			const callId = params.find((p) => p.name === "call-id")?.valueString;
			if (!callId) {
				throw new Error("The call was placed but returned no call id.");
			}
			return callId;
		},
		[call, client, contextValues, phone, slots],
	);

	const run = useCallback(async () => {
		await call.end();
		call.setMessages([]);
		call.setError("");
		call.setCallState("starting");

		try {
			// the browser transports get the same slots the phone would, so a
			// rehearsal hears what a real call would hear
			const context = Object.fromEntries(
				slots
					.filter((slot) => contextValues[slot.name])
					.map((slot) => [
						slot.name,
						`${slot.type}/${contextValues[slot.name]}`,
					]),
			);
			// A rehearsal runs what is on screen and writes nothing: no agent, no
			// prompt revision, no Device. Only the phone commits, because a real
			// call has to be traceable afterwards.
			if (transport === "phone") {
				call.setStatus("Saving");
				const id = await save();
				if (!id) throw new Error("The agent was saved without an id.");
				call.watchCall(await placeCall({ agent: id }));
			} else {
				// A rehearsal goes through $call too: it mints the Task its transcript
				// and answers will hang off, which is how the lab shows them once the
				// conversation is over.
				const callId = await placeCall({ agent: draft, browser: true });
				call.setCallId(callId);
				if (transport === "text") {
					call.startText(draft, context, callId, browserCredentials);
				} else if (transport === "demo") {
					await call.startDemo(
						draft,
						demoVoice,
						context,
						callId,
						browserCredentials,
					);
				} else {
					await call.startBrowser(draft, context, callId, browserCredentials);
				}
			}
		} catch (error) {
			const message = errorText(error);
			call.setError(message);
			toast.error(message);
			call.setCallState("idle");
			call.setStatus("");
		}
	}, [
		browserCredentials,
		call,
		contextValues,
		demoVoice,
		draft,
		placeCall,
		save,
		slots,
		transport,
	]);

	const stop = useCallback(async () => {
		try {
			const watch = call.watchRef.current;
			if (watch) {
				const result = await client.request({
					method: "POST",
					url: "/sdc/voice/$hangup",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ call: watch.id }),
				});
				if (!result.isOk()) throw result.value;
			}
			await call.end();
			call.setCallState("ended");
			call.setStatus("");
		} catch (error) {
			const message = errorText(error);
			call.setError(message);
			toast.error(message);
		}
	}, [call, client]);

	return { run, stop };
}
