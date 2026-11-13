import { useLanguage } from "../hooks/useLanguage";

type Props = {
  compact?: boolean;
};

export default function AIAssistantToggle({ compact = false }: Props) {
  const { language, t, aiAssistantEnabled, setAiAssistantEnabled } = useLanguage();
  const stateLabel = aiAssistantEnabled ? "AI Assistant ON" : "AI Assistant OFF";

  return (
    <div className={compact ? "ai-assistant-toggle is-compact" : "ai-assistant-toggle"}>
      <span className="ai-assistant-toggle-copy">
        <strong>{t("AI Assistant", language)}</strong>
        <small>{t(stateLabel, language)}</small>
      </span>
      <button
        className="ai-assistant-switch"
        type="button"
        role="switch"
        aria-checked={aiAssistantEnabled}
        aria-label={t("AI Assistant", language)}
        onClick={() => setAiAssistantEnabled(!aiAssistantEnabled)}
      >
        <span />
      </button>
    </div>
  );
}
