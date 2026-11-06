import type { MapViewMode } from "./HospitalMap3D";
import { useLanguage } from "../../hooks/useLanguage";

type Props = {
  viewMode: MapViewMode;
  is2D: boolean;
  exploded: boolean;
  onViewModeChange: (mode: MapViewMode) => void;
  onToggle2D: () => void;
  onToggleExploded: () => void;
  onResetCamera: () => void;
};

export default function MapControls({
  viewMode,
  is2D,
  exploded,
  onViewModeChange,
  onToggle2D,
  onToggleExploded,
  onResetCamera,
}: Props) {
  const { language, t } = useLanguage();
  return (
    <>
      <div className="map3d-toolbar">
        <div className="map3d-view-toggle" aria-label={t("Map view", language)}>
          <button
            className={viewMode === "building" ? "active" : ""}
            onClick={() => onViewModeChange("building")}
            type="button"
          >
            {t("Campus", language)}
          </button>
          <button
            className={viewMode === "floor" ? "active" : ""}
            onClick={() => onViewModeChange("floor")}
            type="button"
          >
            {t("Floor plan", language)}
          </button>
        </div>
        <div className="map3d-actions">
          {viewMode === "floor" && (
            <>
              <button
                className={`map3d-action${is2D ? " active" : ""}`}
                onClick={onToggle2D}
                type="button"
                aria-pressed={is2D}
                aria-label={t(is2D ? "Switch to 3D view" : "Switch to 2D view", language)}
                title={t(is2D ? "Switch to 3D view" : "Switch to 2D view", language)}
              >
                {t(is2D ? "2D view" : "3D view", language)}
              </button>
              <button
                className={`map3d-action${exploded ? " active" : ""}`}
                onClick={onToggleExploded}
                type="button"
                aria-pressed={exploded}
              >
                {t(exploded ? "Stack floors" : "Explode floors", language)}
              </button>
            </>
          )}
          <button
            className="map3d-action"
            onClick={onResetCamera}
            type="button"
            title={t("Reset camera", language)}
          >
            {t("Reset view", language)}
          </button>
        </div>
      </div>
    </>
  );
}
