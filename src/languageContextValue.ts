import { createContext } from "react";
import {
  translateText,
  type Language,
} from "./services/translationService";

export type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: typeof translateText;
};

export const LanguageContext = createContext<LanguageContextValue | null>(null);
