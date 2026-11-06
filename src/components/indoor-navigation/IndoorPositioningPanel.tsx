import { hospitalBuildings } from "../../data/hospitalMapData";
import { bleBeaconDatabase } from "../../data/bleBeaconData";
import { wifiPositioningService } from "../../services/wifiPositioningService";
import { getBLESupport } from "../../services/blePositioningService";
import type { useIndoorPosition } from "../../hooks/useIndoorPosition";
import { useLanguage } from "../../hooks/useLanguage";

type Props = {
  positioning: ReturnType<typeof useIndoorPosition>;
  isDemoMode: boolean;
  gpsPosition: {
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null;
  gpsLoading: boolean;
  gpsError: string;
  automaticStatus: string;
  onRetryGPS: () => void;
};

function formatUpdatedAt(timestamp: number, language: "en" | "kn") {
  return new Intl.DateTimeFormat(language === "kn" ? "kn-IN" : "en-IN", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

export default function IndoorPositioningPanel({
  positioning,
  isDemoMode,
  gpsPosition,
  gpsLoading,
  gpsError,
  automaticStatus,
  onRetryGPS,
}: Props) {
  const { language, t } = useLanguage();
  const support = getBLESupport();
  const selectedDemoBuilding =
    hospitalBuildings.find((item) => item.id === positioning.demoBuilding) ??
    hospitalBuildings[0];
  const position = positioning.currentPosition;
  const currentBuilding = hospitalBuildings.find(
    (item) => item.id === position?.buildingId,
  );
  const statusText = {
    idle: "Not positioning",
    scanning: "Scanning for BLE beacons",
    positioned:
      position?.source === "wifi"
        ? "Wi-Fi indoor position"
        : "Automatic indoor position",
    "low-confidence": "Waiting for a stable signal",
    manual: "Manual floor selection",
    demo: "Simulated signal",
    error: "Positioning unavailable",
  }[positioning.status];

  return (
    <section className="card indoor-positioning">
      <div className="indoor-positioning-heading">
        <div>
          <h2 className="section-title">{t("Indoor Positioning", language)}</h2>
          <p className="muted">
            {t("BLE signals can suggest a building and floor after stable, confidence-checked readings. GPS is not used to detect indoor floors.", language)}
          </p>
        </div>
        <span
          className={`indoor-positioning-badge indoor-status-${positioning.status}`}
          role="status"
        >
          {t(statusText, language)}
        </span>
      </div>

      <div className="indoor-position-grid" aria-live="polite">
        <div>
          <small>
            {t(position?.source === "manual"
              ? "Selected building"
              : position?.source === "demo"
                ? "Simulated building"
                : "Detected building", language)}
          </small>
          <strong>{currentBuilding ? t(currentBuilding.name, language) : t("Not detected", language)}</strong>
        </div>
        <div>
          <small>
            {t(position?.source === "manual"
              ? "Selected floor"
              : position?.source === "demo"
                ? "Simulated floor"
                : "Detected floor", language)}
          </small>
          <strong>{position ? t(position.floor, language) : t("Not detected", language)}</strong>
        </div>
        <div>
          <small>
            {position?.source === "wifi"
              ? t("Nearest Wi-Fi access point", language)
              : t("Nearest BLE beacon", language)}
          </small>
          <strong>{position?.nearestBeaconId ?? t("Unavailable", language)}</strong>
        </div>
        <div>
          <small>{t("Signal strength", language)}</small>
          <strong>{position?.rssi !== null && position?.rssi !== undefined ? `${position.rssi} dBm` : t("Unavailable", language)}</strong>
        </div>
        <div>
          <small>{t("Position confidence", language)}</small>
          <strong>
            {position
              ? position.source === "manual"
                ? t("Manual", language)
                : `${Math.round(position.confidence * 100)}%`
              : positioning.latestEstimate
                ? `${Math.round(positioning.latestEstimate.confidence * 100)}% · ${t("not accepted", language)}`
                : t("Unavailable", language)}
          </strong>
        </div>
        <div>
          <small>{t("Last positioning update", language)}</small>
          <strong>
            {position ? formatUpdatedAt(position.timestamp, language) : t("Not available", language)}
          </strong>
        </div>
      </div>

      <div className="indoor-positioning-note">
        <strong>{t("Hardware status", language)}</strong>
        <span>
          {t(support.reason, language)}
          {" "}
          {t("{{count}} surveyed BLE beacons configured.", language, { count: bleBeaconDatabase.length })}
        </span>
        <span>
          {t("Wi-Fi:", language)}{" "}
          {wifiPositioningService.isConfigured
            ? t("backend configured; calibrated readings must come from a native/supported adapter", language)
            : t("browser scanning unavailable; configure a backend and native/supported adapter", language)}
        </span>
      </div>
      <div className="indoor-gps-status">
        <strong>{t("Automatic location", language)}</strong>
        <span>{t(automaticStatus, language)}</span>
        <strong>{t("GPS (outdoor positioning only)", language)}</strong>
        <span>
          {gpsLoading
            ? t("Waiting for GPS fix…", language)
            : gpsError
              ? t("Unavailable", language)
              : gpsPosition
                ? `${t("Last fix:", language)} ${gpsPosition.latitude.toFixed(5)}, ${gpsPosition.longitude.toFixed(5)} · ±${Math.round(gpsPosition.accuracy)} m`
                : t("No GPS fix available", language)}
        </span>
        {gpsError && <span className="error">{t(gpsError, language)}</span>}
        <button
          className="secondary"
          onClick={onRetryGPS}
          disabled={gpsLoading}
          type="button"
        >
          {t("Retry GPS detection", language)}
        </button>
      </div>

      {positioning.error && (
        <p className="error indoor-positioning-error" role="alert">
          {t(positioning.error, language)}
        </p>
      )}

      <div className="indoor-positioning-actions">
        <button
          className="primary"
          onClick={() => void positioning.startBLE()}
          disabled={positioning.isScanning || isDemoMode}
          type="button"
        >
          {t(isDemoMode ? "BLE positioning disabled in Demo Mode" : "Start BLE positioning", language)}
        </button>
        {(positioning.isScanning || positioning.demoMode) && (
          <button
            className="secondary"
            onClick={positioning.stop}
            type="button"
          >
            {t("Stop positioning", language)}
          </button>
        )}
        {positioning.manualOverride && (
          <button
            className="secondary"
            onClick={positioning.resumeAutomatic}
            type="button"
          >
            {t("Resume automatic detection", language)}
          </button>
        )}
      </div>

      {positioning.demoMode && (
        <p className="demo-mode-warning" role="note">
          {t("SIMULATED POSITION — floor changes and RSSI are generated for testing only; this is not a real location reading.", language)}
        </p>
      )}
      {isDemoMode ? (
        <>
          <div className="indoor-demo-controls">
            <div>
              <label htmlFor="demo-building">{t("SAMPLE BUILDING", language)}</label>
              <select
                id="demo-building"
                value={positioning.demoBuilding}
                onChange={(event) => {
                  const nextBuilding = hospitalBuildings.find(
                    (item) => item.id === event.target.value,
                  );
                  if (!nextBuilding) return;
                  positioning.setDemoBuilding(nextBuilding.id);
                  positioning.setDemoFloor(nextBuilding.floors[0]);
                }}
              >
                {hospitalBuildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {t(building.name, language)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="demo-floor">{t("SAMPLE FLOOR", language)}</label>
              <select
                id="demo-floor"
                value={positioning.demoFloor}
                onChange={(event) => positioning.setDemoFloor(event.target.value)}
              >
                {selectedDemoBuilding?.floors.map((floor) => (
                  <option key={floor} value={floor}>
                    {t(floor, language)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="demo-signal-mode">{t("SIGNAL TEST SCENARIO", language)}</label>
              <select
                id="demo-signal-mode"
                value={positioning.demoSignalMode}
                onChange={(event) =>
                  positioning.setDemoSignalMode(
                    event.target.value as "stable" | "weak" | "conflicting",
                  )
                }
              >
                <option value="stable">{t("Stable signal", language)}</option>
                <option value="weak">{t("Weak signal", language)}</option>
                <option value="conflicting">{t("Conflicting floors", language)}</option>
              </select>
            </div>
            <button
              className="secondary"
              onClick={() =>
                positioning.startDemo(
                  positioning.demoBuilding,
                  positioning.demoFloor,
                  positioning.demoSignalMode,
                )
              }
              type="button"
            >
              {t("Start simulated positioning", language)}
            </button>
          </div>
          <p className="indoor-positioning-manual-help">
            {t("To override detection, choose a building/floor in the 3D map controls. The selected floor remains manual until automatic detection is resumed.", language)}
          </p>
        </>
      ) : (
        <p className="indoor-positioning-manual-help" role="note">
          {t("Simulated position controls are available only in Demo Mode. Real Hospital Mode uses configured live readings and manual selections, and does not treat either as an automatic detected position.", language)}
        </p>
      )}
    </section>
  );
}
