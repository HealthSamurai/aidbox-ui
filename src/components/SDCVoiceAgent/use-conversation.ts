import { generateId } from "@aidbox-ui/utils";
import { getAidboxURL } from "@aidbox-ui/utils/http";
import { toast } from "@health-samurai/react-components";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type Call,
	closeCall,
	playPcm,
	SAMPLE_RATE,
	stopAudio,
	voiceWsUrl,
	WORKLET,
} from "./browser-audio";

/**
 * Owns the live conversation: the socket, the microphone, and the transcript.
 * The page above decides *whether* to run; this decides *how* to carry it.
 */

export type Msg = { id: string; role: "user" | "assistant"; content: string };
type CallState = "idle" | "starting" | "live" | "ended";

function message(payload: { role?: string; text?: string }): Msg {
	return {
		id: generateId(),
		role: payload.role === "assistant" ? "assistant" : "user",
		content: String(payload.text || ""),
	};
}

export function useConversation() {
	const [callState, setCallState] = useState<CallState>("idle");
	const [status, setStatus] = useState("");
	const [error, setError] = useState("");
	const [messages, setMessages] = useState<Msg[]>([]);
	// the id $call minted for this run: what the results are read back by
	const [callId, setCallId] = useState<string | undefined>();
	const callRef = useRef<Call | null>(null);
	const watchRef = useRef<{ id: string; ws: WebSocket } | null>(null);

	const handleEvent = useCallback((raw: string, call?: Call) => {
		const msg = JSON.parse(raw);
		if (msg.type === "status") {
			setCallState("live");
			setStatus(String(msg.status || ""));
		}
		if (msg.type === "error") {
			const text = String(msg.message || "The call failed.");
			setError(text);
			toast.error(text);
		}
		if (msg.type === "stopAudio" && call) stopAudio(call);
		if (msg.type === "message") setMessages((xs) => [...xs, message(msg)]);
	}, []);

	const end = useCallback(async () => {
		const call = callRef.current;
		callRef.current = null;
		try {
			call?.ws.send(JSON.stringify({ type: "stop" }));
			call?.ws.close();
		} catch {
			// ignore
		}
		await closeCall(call);

		const watch = watchRef.current;
		watchRef.current = null;
		watch?.ws.close();
	}, []);

	useEffect(() => () => void end(), [end]);

	/** Opens the browser socket and wires it to the transcript. */
	const openSocket = useCallback(
		(existingAudio?: AudioContext) => {
			const ws = new WebSocket(voiceWsUrl());
			ws.binaryType = "arraybuffer";
			const audio =
				existingAudio ?? new AudioContext({ sampleRate: SAMPLE_RATE });
			const call: Call = { ws, audio, nextStart: 0, sources: [] };
			callRef.current = call;

			ws.onmessage = (event) => {
				if (event.data instanceof ArrayBuffer) {
					playPcm(call, event.data);
					return;
				}
				handleEvent(String(event.data), call);
			};
			ws.onerror = () => {
				setError("The voice socket failed.");
				toast.error("The voice socket failed.");
			};
			ws.onclose = () => {
				void closeCall(call);
				if (callRef.current === call) {
					callRef.current = null;
					setCallState("ended");
					setStatus("");
				}
			};

			return { call, ws };
		},
		[handleEvent],
	);

	/** Typed conversation: same agent, same socket, no speech provider opened. */
	const startText = useCallback(
		(
			draft: unknown,
			context?: Record<string, string>,
			callId?: string,
			credentials?: Record<string, { apiKey?: string; baseUrl?: string }>,
		) => {
			const { ws } = openSocket();
			ws.onopen = () =>
				ws.send(
					JSON.stringify({
						type: "start",
						draft,
						textMode: true,
						context,
						call: callId,
						credentials,
					}),
				);
		},
		[openSocket],
	);

	/** Automatic spoken conversation between the agent and a synthetic patient. */
	const startDemo = useCallback(
		async (
			draft: unknown,
			patientVoice: string,
			context?: Record<string, string>,
			callId?: string,
			credentials?: Record<string, { apiKey?: string; baseUrl?: string }>,
		) => {
			const audio = new AudioContext({ sampleRate: SAMPLE_RATE });
			await audio.resume();
			const { ws } = openSocket(audio);
			ws.onopen = () =>
				ws.send(
					JSON.stringify({
						type: "start",
						draft,
						demoMode: true,
						patientVoice,
						context,
						call: callId,
						credentials,
					}),
				);
		},
		[openSocket],
	);

	const startBrowser = useCallback(
		async (
			draft: unknown,
			context?: Record<string, string>,
			callId?: string,
			credentials?: Record<string, { apiKey?: string; baseUrl?: string }>,
		) => {
			// The microphone is acquired before the socket exists: awaiting it after
			// the connection is made races the open event, and a socket that opens
			// first never fires the handler that sends `start`.
			const audio = new AudioContext({ sampleRate: SAMPLE_RATE });
			await audio.audioWorklet.addModule(
				URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" })),
			);
			await audio.resume();
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					channelCount: 1,
				},
			});

			const { call, ws } = openSocket(audio);
			const worklet = new AudioWorkletNode(audio, "pcm-worklet");
			worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
				if (ws.readyState === WebSocket.OPEN) ws.send(event.data);
			};
			const source = audio.createMediaStreamSource(stream);
			source.connect(worklet);
			call.stream = stream;
			call.source = source;
			call.worklet = worklet;

			ws.onopen = () =>
				ws.send(
					JSON.stringify({
						type: "start",
						draft,
						context,
						call: callId,
						credentials,
					}),
				);
		},
		[openSocket],
	);

	/** The phone call belongs to Twilio; this socket only watches its transcript. */
	const watchCall = useCallback(
		(callId: string) => {
			const url = getAidboxURL("/sdc/voice/watch");
			url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
			const ws = new WebSocket(url.toString());
			const watch = { id: callId, ws };
			watchRef.current = watch;
			setCallId(callId);
			ws.onopen = () => ws.send(JSON.stringify({ call: callId }));
			ws.onmessage = (event) => handleEvent(String(event.data));
			// A phone call ends on its own — the agent says goodbye and hangs up, or
			// the person does. The watch socket closing is how the page learns of it,
			// and what lets the results panel start looking for the answers.
			ws.onclose = () => {
				if (watchRef.current === watch) {
					watchRef.current = null;
					setCallState("ended");
					setStatus("");
				}
			};
		},
		[handleEvent],
	);

	const say = useCallback((text: string) => {
		const ws = callRef.current?.ws;
		if (!text || !ws || ws.readyState !== WebSocket.OPEN) return false;
		ws.send(JSON.stringify({ type: "user", text }));
		return true;
	}, []);

	const mute = useCallback(() => {
		const ws = callRef.current?.ws;
		if (!ws || ws.readyState !== WebSocket.OPEN) return false;
		ws.send(JSON.stringify({ type: "mute" }));
		return true;
	}, []);

	return {
		callId,
		setCallId,
		callState,
		setCallState,
		status,
		setStatus,
		error,
		setError,
		messages,
		setMessages,
		watchRef,
		end,
		startText,
		startDemo,
		startBrowser,
		watchCall,
		say,
		mute,
		running: callState === "starting" || callState === "live",
	};
}
