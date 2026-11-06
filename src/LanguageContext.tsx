import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { LanguageContext } from "./languageContextValue";
import type { Language } from "./services/translationService";
import { translateText } from "./services/translationService";

const storageKey = "hospinav-language";

function getInitialLanguage(): Language {
  try {
    return window.localStorage.getItem(storageKey) === "kn" ? "kn" : "en";
  } catch {
    return "en";
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language === "kn" ? "kn" : "en";
    try {
      window.localStorage.setItem(storageKey, language);
    } catch (error) {
      console.error("Unable to persist the selected HospiNav language.", error);
    }
  }, [language]);

  const value = useMemo(
    () => ({ language, setLanguage, t: translateText }),
    [language],
  );
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
