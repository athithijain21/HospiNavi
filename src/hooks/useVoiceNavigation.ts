import { useCallback, useEffect, useRef, useState } from "react";
import type { HospitalDepartment } from "../data/hospitalMapData";
import type { PositioningSource } from "../services/indoorPositioningService";
import type { IndoorRoute } from "../services/hospitalRouteService";
import {
  createVoiceRecognition,
  getVoiceRecognitionSupport,
  requestMicrophonePermission,
  voiceRecognitionErrorMessage,
  type SpeechRecognitionLike,
} from "../services/voiceRecognitionService";
import { voiceNavigationService } from "../services/voiceNavigationService";
import {
  createSpeechFallbackRecorder,
  isSpeechFallbackConfigured,
} from "../services/speechFallbackService";
import { translateNavigationText } from "../services/translationService";
import { useLanguage } from "./useLanguage";

export type VoiceStatus =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "paused"
  | "unsupported"
  | "error";

type Props = {
  departments: HospitalDepartment[];
  onNavigate: (department: HospitalDepartment) => boolean;
  onRequirement: (text: string) => void | Promise<void>;
  onStopNavigation: () => void;
  getPosition: () => {
    buildingId: string;
    floor: string;
    source: PositioningSource;
  } | null;
  getDirections: () => string[];
  onPauseNavigation?: () => void;
  onResumeNavigation?: () => void;
  getNearestLiftDirections?: () => string[];
  getNearestLiftRoute?: () => { route: IndoorRoute; targetLabel: string } | null;
  getFloorRoute?: (
    floor: string,
  ) => { route: IndoorRoute; targetLabel: string } | null;
  onSelectRoute?: (
    route: IndoorRoute,
    targetLabel: string,
    targetNodeId: string,
  ) => void;
  onClarification?: (message: string) => void;
  onRecognizedText?: (text: string) => void;
  language?: string;
};

export function useVoiceNavigation({
  departments,
  onNavigate,
  onRequirement,
  onStopNavigation,
  getPosition,
  getDirections,
  onPauseNavigation,
  onResumeNavigation,
  getNearestLiftDirections,
  getNearestLiftRoute,
  getFloorRoute,
  onSelectRoute,
  onClarification,
  onRecognizedText,
  language = "en-US",
}: Props) {
  const { language: interfaceLanguage, t } = useLanguage();
  const [support] = useState(getVoiceRecognitionSupport);
  const [status, setStatus] = useState<VoiceStatus>(
    support.supported ? "idle" : "unsupported",
  );
  const [error, setError] = useState("");
  const supported = support.supported;
  const [transcript, setTranscript] = useState("");
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const startInProgress = useRef(false);
  const recognitionFailed = useRef(false);
  const fallbackRecorder = useRef<Awaited<ReturnType<typeof createSpeechFallbackRecorder>> | null>(null);
  const receivedResult = useRef(false);
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  const callbacks = useRef({
    departments,
    onNavigate,
    onRequirement,
    onStopNavigation,
    getPosition,
    getDirections,
    onPauseNavigation,
    onResumeNavigation,
    getNearestLiftDirections,
    getNearestLiftRoute,
    getFloorRoute,
    onSelectRoute,
    onClarification,
  });
  useEffect(() => {
    callbacks.current = {
      departments,
      onNavigate,
      onRequirement,
      onStopNavigation,
      getPosition,
      getDirections,
      onPauseNavigation,
      onResumeNavigation,
      getNearestLiftDirections,
      getNearestLiftRoute,
      getFloorRoute,
      onSelectRoute,
      onClarification,
    };
  }, [
    departments,
    getDirections,
    getPosition,
    onNavigate,
    onRequirement,
    onPauseNavigation,
    onResumeNavigation,
    getNearestLiftDirections,
    getNearestLiftRoute,
    getFloorRoute,
    onSelectRoute,
    onClarification,
    onStopNavigation,
  ]);
  const onRecognizedTextRef = useRef(onRecognizedText);
  useEffect(() => {
    onRecognizedTextRef.current = onRecognizedText;
  }, [onRecognizedText]);

  useEffect(() => {
    if (recognition.current) recognition.current.lang = language;
  }, [language]);

  const speak = useCallback(
    (text: string) => {
      try {
        setError("");
        const speechLanguage = language.startsWith("kn")
          ? "kn"
          : language.startsWith("hi")
            ? "hi"
            : language.startsWith("ml")
              ? "ml"
              : "en";
        const speechText = translateNavigationText(text, speechLanguage);
        if (
          typeof window !== "undefined" &&
          "speechSynthesis" in window &&
          !window.speechSynthesis
            .getVoices()
            .some((voice) => voice.lang.toLowerCase().startsWith(speechLanguage))
        ) {
          setError(t("Selected language voice unavailable; directions are available as text.", interfaceLanguage));
          setStatus("idle");
          return;
        }
        setStatus("speaking");
        const utterance = voiceNavigationService.speak(speechText, language);
        utterance.onend = () => {
          if (statusRef.current === "speaking") setStatus("idle");
        };
        utterance.onerror = () => {
          setError(t("Speech output failed. You can read the directions on screen.", interfaceLanguage));
          setStatus("error");
        };
      } catch (speechError) {
        setError(
          speechError instanceof Error
            ? t(speechError.message, interfaceLanguage)
            : t("Speech output is unavailable.", interfaceLanguage),
        );
        setStatus("error");
      }
    },
    [interfaceLanguage, language, t],
  );

  const processText = useCallback(
    async (text: string) => {
      setTranscript(text);
      setError("");
      setStatus("processing");
      onRecognizedTextRef.current?.(text);
      try {
        const intent = await voiceNavigationService.handleCommand(
          text,
          {
            ...callbacks.current,
            onRequirement: async (requirement) => {
              await callbacks.current.onRequirement(requirement);
              setStatus("idle");
            },
          },
          speak,
        );
        if (intent.type === "pause-navigation") {
          setStatus("paused");
        } else if (intent.type === "resume-navigation") {
          setStatus(
            typeof window !== "undefined" &&
              "speechSynthesis" in window &&
              window.speechSynthesis.speaking
              ? "speaking"
              : "idle",
          );
        } else if (statusRef.current === "processing") {
          setStatus("idle");
        }
      } catch (commandError) {
        setError(
          commandError instanceof Error
            ? commandError.message
            : t("Unable to process the voice command.", interfaceLanguage),
        );
        setStatus("error");
      }
    },
    [interfaceLanguage, speak, t],
  );

  const startListening = useCallback(async () => {
    if (startInProgress.current || recognition.current) return;
    startInProgress.current = true;
    const support = getVoiceRecognitionSupport();
    if (!support.supported) {
      startInProgress.current = false;
      setStatus("unsupported");
      setError(t(support.reason, interfaceLanguage));
      return;
    }
    setError("");
    try {
      await requestMicrophonePermission();
      const currentRecognition = createVoiceRecognition(language);
      recognition.current = currentRecognition;
      recognitionFailed.current = false;
      receivedResult.current = false;
      currentRecognition.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        const text = result?.[0]?.transcript?.trim();
        if (text) {
          receivedResult.current = true;
          void processText(text);
        }
      };
      currentRecognition.onerror = (event) => {
        recognitionFailed.current = true;
        const message = voiceRecognitionErrorMessage(event.error);
        if (!message) {
          setStatus("idle");
          return;
        }
        setError(t(message, interfaceLanguage));
        setStatus("error");
      };
      currentRecognition.onend = () => {
        if (recognition.current !== currentRecognition) return;
        recognition.current = null;
        startInProgress.current = false;
        if (
          statusRef.current === "listening" &&
          !recognitionFailed.current &&
          !receivedResult.current
        ) {
          setStatus("idle");
        }
      };
      setStatus("listening");
      currentRecognition.start();
      startInProgress.current = false;
    } catch (recognitionError) {
      startInProgress.current = false;
      if (
        recognitionError instanceof DOMException &&
        recognitionError.name === "NotAllowedError"
      ) {
        setError(
          t(
            "Microphone permission was denied. Allow microphone access or use text input.",
            interfaceLanguage,
          ),
        );
      } else if (
        recognitionError instanceof DOMException &&
        recognitionError.name === "NotFoundError"
      ) {
        setError(
          t(
            "No microphone was found. Connect a microphone or use text input.",
            interfaceLanguage,
          ),
        );
      } else {
        setError(
          recognitionError instanceof Error
            ? t(recognitionError.message, interfaceLanguage)
            : t("Unable to start speech recognition.", interfaceLanguage),
        );
      }
      setStatus("error");
    }
  }, [interfaceLanguage, language, processText, t]);

  const stopListening = useCallback(() => {
    const activeFallback = fallbackRecorder.current;
    if (activeFallback) {
      fallbackRecorder.current = null;
      activeFallback.stop();
      startInProgress.current = false;
      if (statusRef.current === "listening") setStatus("processing");
      void activeFallback.result.then(processText).catch((fallbackError: unknown) => {
        setError(
          fallbackError instanceof Error
            ? t(fallbackError.message, interfaceLanguage)
            : t("Server speech recognition failed. Use text input.", interfaceLanguage),
        );
        setStatus("error");
      });
      return;
    }
    const currentRecognition = recognition.current;
    currentRecognition?.stop();
    recognition.current = null;
    if (!currentRecognition) startInProgress.current = false;
    if (statusRef.current === "listening") setStatus("idle");
  }, [interfaceLanguage, processText, t]);

  const retryListening = useCallback(() => {
    stopListening();
    void startListening();
  }, [startListening, stopListening]);

  const startServerFallback = useCallback(async () => {
    if (!isSpeechFallbackConfigured() || startInProgress.current || fallbackRecorder.current) return;
    startInProgress.current = true;
    setError("");
    try {
      fallbackRecorder.current = await createSpeechFallbackRecorder(language);
      setStatus("listening");
    } catch (fallbackError) {
      startInProgress.current = false;
      setError(
        fallbackError instanceof Error
          ? t(fallbackError.message, interfaceLanguage)
          : t("Server speech recognition failed. Use text input.", interfaceLanguage),
      );
      setStatus("error");
    }
  }, [interfaceLanguage, language, t]);

  const speakDirections = useCallback(
    (directions: string[]) => {
      speak(
        directions.length > 0
          ? directions.join(" ")
          : t("There are no active route directions.", interfaceLanguage),
      );
    },
    [interfaceLanguage, speak, t],
  );

  const pause = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.resume();
    setStatus("speaking");
  }, []);

  useEffect(
    () => () => {
      recognition.current?.stop();
      fallbackRecorder.current?.stop();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  return {
    status,
    error,
    supported,
    transcript,
    setTranscript,
    startListening,
    retryListening,
    startServerFallback,
    serverFallbackAvailable: isSpeechFallbackConfigured(),
    stopListening,
    processText,
    speak,
    speakDirections,
    pause,
    resume,
  };
}
