import { useCallback, useEffect, useRef, useState } from "react";
import type { HospitalDepartment } from "../data/hospitalMapData";
import type { PositioningSource } from "../services/indoorPositioningService";
import type { IndoorRoute } from "../services/hospitalRouteService";
import {
  createVoiceRecognition,
  getVoiceRecognitionSupport,
  voiceRecognitionErrorMessage,
  type SpeechRecognitionLike,
} from "../services/voiceRecognitionService";
import { voiceNavigationService } from "../services/voiceNavigationService";
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
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState("");
  const [supported] = useState(() => getVoiceRecognitionSupport().supported);
  const [transcript, setTranscript] = useState("");
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const recognitionFailed = useRef(false);
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

  const speak = useCallback(
    (text: string) => {
      try {
        setError("");
        const speechText = translateNavigationText(
          text,
          language.startsWith("kn") ? "kn" : "en",
        );
        if (
          language.startsWith("kn") &&
          typeof window !== "undefined" &&
          "speechSynthesis" in window &&
          window.speechSynthesis.getVoices().length > 0 &&
          !window.speechSynthesis
            .getVoices()
            .some((voice) => voice.lang.toLowerCase().startsWith("kn"))
        ) {
          setError(t("Kannada voice unavailable; directions are available as text.", interfaceLanguage));
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
            ? speechError.message
            : "Speech output is unavailable.",
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

  const startListening = useCallback(() => {
    const support = getVoiceRecognitionSupport();
    if (!support.supported) {
      setStatus("unsupported");
      setError(support.reason);
      return;
    }
    setError("");
    try {
      const currentRecognition = createVoiceRecognition(language);
      recognition.current = currentRecognition;
      recognitionFailed.current = false;
      receivedResult.current = false;
      currentRecognition.onresult = (event) => {
        const text = event.results[0]?.[0]?.transcript?.trim();
        if (text) {
          receivedResult.current = true;
          void processText(text);
        }
      };
      currentRecognition.onerror = (event) => {
        recognitionFailed.current = true;
        setError(t(voiceRecognitionErrorMessage(event.error), interfaceLanguage));
        setStatus("error");
      };
      currentRecognition.onend = () => {
        recognition.current = null;
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
    } catch (recognitionError) {
      setError(
        recognitionError instanceof Error
          ? t(recognitionError.message, interfaceLanguage)
          : t("Unable to start speech recognition.", interfaceLanguage),
      );
      setStatus("error");
    }
  }, [interfaceLanguage, language, processText, t]);

  const stopListening = useCallback(() => {
    recognition.current?.stop();
    recognition.current = null;
    if (statusRef.current === "listening") setStatus("idle");
  }, []);

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
    stopListening,
    processText,
    speak,
    speakDirections,
    pause,
    resume,
  };
}
