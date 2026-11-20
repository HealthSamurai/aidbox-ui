import { getAidboxBaseURL } from "@aidbox-ui/utils";

/**
 * Microphone capture and playback for a browser call. The socket carries raw
 * 16 kHz PCM in both directions, which is what the SDC voice endpoint speaks.
 */

export type Call = {
	ws: WebSocket;
	audio: AudioContext;
	stream?: MediaStream;
	source?: MediaStreamAudioSourceNode;
	worklet?: AudioWorkletNode;
	nextStart: number;
	sources: AudioBufferSourceNode[];
	/** Last sample played, so the next chunk can be joined onto it smoothly. */
	lastSample?: number;
};

export const SAMPLE_RATE = 16_000;

export function voiceWsUrl(path = "/sdc/voice/browser") {
	const url = new URL(`${getAidboxBaseURL()}${path}`);
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
	return url.toString();
}

/**
 * Playback starts this far ahead of the first chunk, so a late arrival has
 * somewhere to land instead of leaving a hole in the audio.
 */
const JITTER_BUFFER_S = 0.15;

/**
 * Deepgram's chunks do not join cleanly: the last sample of one and the first
 * of the next can differ by two thirds of full scale, and that step is heard
 * as a click. Ramping across the seam turns the step into a slope. Two
 * milliseconds is long enough to be inaudible as a discontinuity and short
 * enough not to be heard as a fade.
 */
const SEAM_RAMP_SAMPLES = Math.round(SAMPLE_RATE * 0.002);

/** Queues a chunk so consecutive chunks play back to back without a gap. */
export function playPcm(call: Call, data: ArrayBuffer) {
	const samples = new Int16Array(data);
	if (!samples.length) return;

	const buf = call.audio.createBuffer(1, samples.length, SAMPLE_RATE);
	const ch = buf.getChannelData(0);
	for (let i = 0; i < samples.length; i++) ch[i] = (samples[i] ?? 0) / 32768;

	// Slide the opening samples from wherever the previous chunk ended up to
	// where this one begins. The correction decays to nothing within a couple of
	// milliseconds, so the audio itself is untouched past the seam.
	const ramp = Math.min(SEAM_RAMP_SAMPLES, samples.length);
	const step = (call.lastSample ?? ch[0] ?? 0) - (ch[0] ?? 0);
	if (step !== 0) {
		for (let i = 0; i < ramp; i++) {
			ch[i] = (ch[i] ?? 0) + step * (1 - i / ramp);
		}
	}
	call.lastSample = ch[samples.length - 1] ?? 0;

	const src = call.audio.createBufferSource();
	src.buffer = buf;
	src.connect(call.audio.destination);
	src.onended = () => {
		const i = call.sources.indexOf(src);
		if (i >= 0) call.sources.splice(i, 1);
	};

	const now = call.audio.currentTime;
	const start = call.nextStart > now ? call.nextStart : now + JITTER_BUFFER_S;
	call.nextStart = start + buf.duration;
	call.sources.push(src);
	src.start(start);
}

/** Drops whatever is still queued — the agent was interrupted. */
export function stopAudio(call?: Call | null) {
	if (!call) return;
	call.nextStart = 0;
	// nothing is playing, so the next chunk starts a fresh run
	call.lastSample = undefined;
	for (const src of call.sources.splice(0)) {
		try {
			src.stop();
			src.disconnect();
		} catch {
			// ignore
		}
	}
}

export async function closeCall(call?: Call | null) {
	if (!call) return;
	stopAudio(call);
	try {
		call.worklet?.disconnect();
		call.source?.disconnect();
		for (const track of call.stream?.getTracks() ?? []) {
			track.stop();
		}
		await call.audio.close();
	} catch {
		// ignore
	}
}

/** Downsamples the mic to 16 kHz and posts 100 ms Int16 chunks to the page. */
export const WORKLET = `
class PCMWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffers = [];
    this.targetSampleRate = 16000;
    this.chunkSamples = Math.round(sampleRate * 0.1);
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    this.buffers.push(new Float32Array(input));
    const total = this.buffers.reduce((n, b) => n + b.length, 0);
    if (total < this.chunkSamples) return true;
    const merged = new Float32Array(total);
    let off = 0;
    for (const b of this.buffers) { merged.set(b, off); off += b.length; }
    this.buffers = [];
    const ratio = sampleRate / this.targetSampleRate;
    const len = Math.floor(merged.length / ratio);
    const pcm = new Int16Array(len);
    for (let i = 0; i < len; i++) {
      const x = i * ratio;
      const j = Math.floor(x);
      const f = x - j;
      const a = merged[j] || 0;
      const b = merged[j + 1] || a;
      const s = Math.max(-1, Math.min(1, a + (b - a) * f));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    return true;
  }
}
registerProcessor('pcm-worklet', PCMWorklet);
`;
