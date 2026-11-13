import { createContext } from "react";
import {
  translateText,
  type Language,
} from "./services/translationService";

export type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  aiAssistantEnabled: boolean;
  setAiAssistantEnabled: (enabled: boolean) => void;
  t: typeof translateText;
};

export const LanguageContext = createContext<LanguageContextValue | null>(null);
