import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { LanguageContext } from "./languageContextValue";
import type { Language } from "./services/translationService";
import { translateText } from "./services/translationService";

const storageKey = "hospinav-language";
const aiAssistantStorageKey = "hospinav-ai-assistant-enabled";

function getInitialLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored === "en" || stored === "kn" || stored === "hi" || stored === "ml"
      ? stored
      : "en";
  } catch {
    return "en";
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const [aiAssistantEnabled, setAiAssistantEnabled] = useState(() => {
    try {
      return window.localStorage.getItem(aiAssistantStorageKey) !== "false";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(storageKey, language);
    } catch (error) {
      console.error("Unable to persist the selected HospiNav language.", error);
    }
  }, [language]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        aiAssistantStorageKey,
        String(aiAssistantEnabled),
      );
    } catch (error) {
      console.error("Unable to persist the HospiNav AI assistant setting.", error);
    }
  }, [aiAssistantEnabled]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      aiAssistantEnabled,
      setAiAssistantEnabled,
      t: translateText,
    }),
    [aiAssistantEnabled, language],
  );
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
