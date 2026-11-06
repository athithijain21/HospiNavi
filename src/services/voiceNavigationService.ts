import type { HospitalDepartment } from "../data/hospitalMapData";
import {
  recognizeNavigationIntent,
  type NavigationIntent,
} from "./intentRecognitionService";
import type { PositioningSource } from "./indoorPositioningService";
import type { IndoorRoute } from "./hospitalRouteService";

type SpeechSynthesisWithVoices = typeof window.speechSynthesis;

export type VoiceNavigationCallbacks = {
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
};

export const voiceNavigationService = {
  recognizeIntent(text: string, departments: HospitalDepartment[]): NavigationIntent {
    return recognizeNavigationIntent(text, departments);
  },

  speak(text: string, language = "en-US") {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      throw new Error("Speech output is not supported by this browser.");
    }
    const speech: SpeechSynthesisWithVoices = window.speechSynthesis;
    speech.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    speech.speak(utterance);
    return utterance;
  },

  async handleCommand(
    text: string,
    callbacks: VoiceNavigationCallbacks,
    speak: (text: string) => void,
  ) {
    const intent = recognizeNavigationIntent(text, callbacks.departments);
    switch (intent.type) {
      case "where-am-i": {
        const position = callbacks.getPosition();
        speak(
          position
            ? position.source === "manual"
              ? `Your selected location is building ${position.buildingId}, ${position.floor}.`
              : position.source === "demo"
                ? `Simulated location: building ${position.buildingId}, ${position.floor}. This is not your actual location.`
                : `You are in building ${position.buildingId}, ${position.floor}.`
            : "Your indoor location is not available. Select a building and floor or start indoor positioning.",
        );
        return intent;
      }
      case "which-floor": {
        const position = callbacks.getPosition();
        speak(
          position
            ? position.source === "manual"
              ? `Your selected floor is ${position.floor}, building ${position.buildingId}.`
              : position.source === "demo"
                ? `Simulated floor: ${position.floor}, building ${position.buildingId}.`
                : `You are on ${position.floor}, building ${position.buildingId}.`
            : "I do not have a confirmed indoor floor yet.",
        );
        return intent;
      }
      case "nearest-lift": {
        const nearest = callbacks.getNearestLiftRoute?.() ?? null;
        if (nearest) {
          callbacks.onSelectRoute?.(
            nearest.route,
            nearest.targetLabel,
            nearest.route.nodes.at(-1)?.id ?? "",
          );
        }
        const directions = nearest?.route.instructions ??
          callbacks.getNearestLiftDirections?.() ??
          [];
        speak(
          directions.length > 0
            ? directions.join(" ")
            : "No surveyed lift route is available from the confirmed starting point. Please follow hospital signs or ask staff.",
        );
        return intent;
      }
      case "navigate-floor": {
        const target = callbacks.getFloorRoute?.(intent.floor) ?? null;
        if (target) {
          callbacks.onSelectRoute?.(
            target.route,
            target.targetLabel,
            target.route.nodes.at(-1)?.id ?? "",
          );
        }
        speak(
          target
            ? target.route.instructions.join(" ")
            : `No surveyed elevator route to ${intent.floor} is available from the confirmed starting point.`,
        );
        return intent;
      }
      case "repeat-directions": {
        const directions = callbacks.getDirections();
        speak(
          directions.length > 0
            ? directions.join(" ")
            : "There are no active route directions to repeat.",
        );
        return intent;
      }
      case "stop-navigation":
        callbacks.onStopNavigation();
        speak("Navigation stopped.");
        return intent;
      case "pause-navigation":
        callbacks.onPauseNavigation?.();
        return intent;
      case "resume-navigation":
        callbacks.onResumeNavigation?.();
        return intent;
      case "navigate": {
        const routeAvailable = callbacks.onNavigate(intent.department);
        speak(
          routeAvailable
            ? `Starting directions to ${intent.department.name}, ${intent.department.building}, ${intent.department.floor}, room ${intent.department.room}.`
            : `${intent.department.name} is selected, but no verified indoor route is available from the confirmed starting point.`,
        );
        return intent;
      }
      case "clarify-destination": {
        const options = intent.departments
          .map(
            (department) =>
              `${department.name}, ${department.building}, ${department.floor}, room ${department.room}`,
          )
          .join("; ");
        const message = `I found multiple configured destinations: ${options}. Please specify the department and building you want.`;
        callbacks.onClarification?.(message);
        speak(message);
        return intent;
      }
      case "requirement":
        await callbacks.onRequirement(text);
        return intent;
    }
  },
};
