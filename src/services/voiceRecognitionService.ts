type SpeechRecognitionResult = {
  0: { transcript: string };
};

type SpeechRecognitionEvent = Event & {
  results: ArrayLike<SpeechRecognitionResult>;
};

type SpeechRecognitionErrorEvent = Event & { error: string };

export type SpeechRecognitionLike = EventTarget & {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export type VoiceRecognitionSupport = {
  supported: boolean;
  reason: string;
};

export function getVoiceRecognitionSupport(): VoiceRecognitionSupport {
  if (typeof window === "undefined") {
    return { supported: false, reason: "Speech recognition is unavailable." };
  }
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    ? { supported: true, reason: "Speech recognition is available." }
    : {
        supported: false,
        reason: "This browser does not support speech recognition. Use the text input instead.",
      };
}

export function createVoiceRecognition(language = "en-US") {
  const support = getVoiceRecognitionSupport();
  if (!support.supported) throw new Error(support.reason);
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  const Constructor =
    speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
  if (!Constructor) throw new Error(support.reason);
  const recognition = new Constructor();
  recognition.lang = language;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  return recognition;
}

export function voiceRecognitionErrorMessage(error: string) {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Microphone permission was denied. Allow microphone access or use text input.";
  }
  if (error === "no-speech") return "No speech was detected. Please try again.";
  if (error === "audio-capture") {
    return "No microphone was found. Connect a microphone or use text input.";
  }
  if (error === "network") {
    return "Speech recognition network service is unavailable. Use text input.";
  }
  return `Speech recognition failed (${error}). You can use text input instead.`;
}
