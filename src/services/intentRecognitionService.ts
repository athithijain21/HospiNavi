import type { HospitalDepartment } from "../data/hospitalMapData";
import { hospitalBuildings } from "../data/hospitalMapData";
import { translateText } from "./translationService";

export type NavigationIntent =
  | { type: "where-am-i" }
  | { type: "which-floor" }
  | { type: "nearest-lift" }
  | { type: "repeat-directions" }
  | { type: "stop-navigation" }
  | { type: "pause-navigation" }
  | { type: "resume-navigation" }
  | { type: "navigate-floor"; floor: string }
  | { type: "navigate"; department: HospitalDepartment }
  | { type: "clarify-destination"; departments: HospitalDepartment[] }
  | { type: "requirement" };

export function recognizeNavigationIntent(
  input: string,
  departments: HospitalDepartment[],
): NavigationIntent {
  const normalized = input.trim().toLowerCase();
  const isKannada = /[\u0c80-\u0cff]/u.test(normalized);
  if (
    /\b(where am i|my location|current location)\b/.test(normalized) ||
    (isKannada && /(ನಾನು ಎಲ್ಲಿದ್ದೇನೆ|ನನ್ನ ಸ್ಥಳ|ಪ್ರಸ್ತುತ ಸ್ಥಳ)/u.test(normalized))
  ) {
    return { type: "where-am-i" };
  }
  if (
    /\b(which|what) floor\b/.test(normalized) ||
    (isKannada && /(ಯಾವ ಮಹಡಿ|ನಾನು ಯಾವ ಮಹಡಿ)/u.test(normalized))
  ) return { type: "which-floor" };
  if (
    /\b(nearest|closest|find).*\b(lift|elevator)\b/.test(normalized) ||
    (isKannada && /ಹತ್ತಿರದ.*(ಲಿಫ್ಟ್|ಎಲಿವೇಟರ್)/u.test(normalized))
  ) {
    return { type: "nearest-lift" };
  }
  if (
    /\b(repeat|say that again|repeat directions)\b/.test(normalized) ||
    (isKannada && /(ಮಾರ್ಗಸೂಚಿ.*ಪುನರಾವರ್ತಿಸಿ|ಮತ್ತೆ ಹೇಳಿ|ಮತ್ತೊಮ್ಮೆ ಹೇಳಿ)/u.test(normalized))
  ) {
    return { type: "repeat-directions" };
  }
  if (
    /\b(pause|hold) (the )?(journey|navigation|directions)\b/.test(normalized) ||
    (isKannada && /(ಮಾರ್ಗದರ್ಶನ|ಪ್ರಯಾಣ).*(ವಿರಮಿಸಿ|ವಿರಾಮ|ತಾತ್ಕಾಲಿಕವಾಗಿ ನಿಲ್ಲಿಸಿ)/u.test(normalized))
  ) {
    return { type: "pause-navigation" };
  }
  if (
    /\b(resume|continue) (the )?(journey|navigation|directions)\b/.test(normalized) ||
    (isKannada && /(ಮಾರ್ಗದರ್ಶನ|ಪ್ರಯಾಣ).*(ಮುಂದುವರಿಸಿ|ಪುನರಾರಂಭಿಸಿ)/u.test(normalized))
  ) {
    return { type: "resume-navigation" };
  }
  if (
    /\b(stop|cancel|end) (the )?(journey|navigation|directions)\b/.test(normalized) ||
    (isKannada && /(ಮಾರ್ಗದರ್ಶನ|ಪ್ರಯಾಣ).*(ನಿಲ್ಲಿಸಿ|ರದ್ದುಮಾಡಿ)/u.test(normalized))
  ) {
    return { type: "stop-navigation" };
  }

  const targetFloor = hospitalBuildings
    .flatMap((building) => building.floors)
    .find(
      (floor) =>
        (normalized.includes(floor.toLowerCase()) ||
          (isKannada && normalized.includes(translateText(floor, "kn")))) &&
        (/\b(how do i reach|take me to|guide me to|directions to|get me to)\b/.test(normalized) ||
          (isKannada && /(ಹೋಗಿ|ಮಾರ್ಗದರ್ಶನ|ಕರೆದುಕೊಂಡು ಹೋಗಿ)/u.test(normalized))),
    );
  if (targetFloor) return { type: "navigate-floor", floor: targetFloor };

  if (isKannada && /(ಹೋಗಿ|ಮಾರ್ಗದರ್ಶನ|ಕರೆದುಕೊಂಡು ಹೋಗಿ)/u.test(normalized)) {
    const matches = departments.filter((department) =>
      normalized.includes(translateText(department.name, "kn").toLowerCase()),
    );
    if (matches.length === 1) return { type: "navigate", department: matches[0] };
    if (matches.length > 1) return { type: "clarify-destination", departments: matches };
  }

  const requestedDestination = normalized.match(
    /\b(?:take me to|navigate to|directions to|find|go to|guide me to|where is|how do i reach)\s+(?:the\s+)?(.+?)(?:\s+department)?[.!?]?$/,
  )?.[1];
  if (requestedDestination) {
    const target = requestedDestination.trim();
    const matches = departments.filter(
      (item) =>
        item.name.toLowerCase() === target ||
        item.name.toLowerCase().includes(target),
    );
    if (matches.length === 1) {
      return { type: "navigate", department: matches[0] };
    }
    if (matches.length > 1) {
      return { type: "clarify-destination", departments: matches };
    }
  }
  return { type: "requirement" };
}
