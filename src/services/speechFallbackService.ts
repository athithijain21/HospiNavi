const speechEndpoint = import.meta.env.VITE_SPEECH_TO_TEXT_ENDPOINT?.trim();

export function isSpeechFallbackConfigured() {
  return Boolean(speechEndpoint);
}

type RecorderHandle = {
  stop: () => void;
  result: Promise<string>;
};

function encodeWav(samples: Float32Array[], sampleRate: number) {
  const input = new Float32Array(samples.reduce((count, sample) => count + sample.length, 0));
  let inputOffset = 0;
  for (const sample of samples) {
    input.set(sample, inputOffset);
    inputOffset += sample.length;
  }
  const outputSampleRate = 16000;
  const sampleCount = Math.max(1, Math.round(input.length * outputSampleRate / sampleRate));
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  let offset = 0;
  const writeString = (value: string) => {
    for (const character of value) view.setUint8(offset++, character.charCodeAt(0));
  };
  writeString("RIFF");
  view.setUint32(offset, 36 + sampleCount * 2, true);
  offset += 4;
  writeString("WAVEfmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint32(offset, outputSampleRate, true);
  offset += 4;
  view.setUint32(offset, outputSampleRate * 2, true);
  offset += 4;
  view.setUint16(offset, 2, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeString("data");
  view.setUint32(offset, sampleCount * 2, true);
  offset += 4;
  for (let index = 0; index < sampleCount; index += 1) {
    const sourceIndex = Math.min(input.length - 1, Math.round(index * sampleRate / outputSampleRate));
    const clamped = Math.max(-1, Math.min(1, input[sourceIndex] ?? 0));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export async function createSpeechFallbackRecorder(locale: string): Promise<RecorderHandle> {
  if (!speechEndpoint) throw new Error("Server speech recognition is not configured.");
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access is unavailable in this browser.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("Audio recording is unavailable in this browser.");
  }
  const context = new AudioContextConstructor();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const samples: Float32Array[] = [];
  let stopped = false;
  let resolveResult: (value: string) => void = () => undefined;
  let rejectResult: (reason: unknown) => void = () => undefined;
  const result = new Promise<string>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  const finish = async () => {
    if (stopped) return;
    stopped = true;
    processor.disconnect();
    source.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    await context.close();
    try {
      const formData = new FormData();
      formData.append("locale", locale);
      formData.append("audio", encodeWav(samples, context.sampleRate), "speech.wav");
      const response = await fetch(speechEndpoint, { method: "POST", body: formData });
      const payload = (await response.json()) as { text?: string; error?: string };
      if (!response.ok || !payload.text?.trim()) {
        throw new Error(payload.error ?? "Server speech recognition failed.");
      }
      resolveResult(payload.text.trim());
    } catch (error) {
      rejectResult(error);
    }
  };
  processor.onaudioprocess = (event) => {
    if (!stopped) samples.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };
  source.connect(processor);
  processor.connect(context.destination);
  return { stop: () => void finish(), result };
}
