import type { MapViewMode } from "./HospitalMap3D";

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
  return (
    <>
      <div className="map3d-toolbar">
        <div className="map3d-view-toggle" aria-label="Map view">
          <button
            className={viewMode === "building" ? "active" : ""}
            onClick={() => onViewModeChange("building")}
            type="button"
          >
            Campus
          </button>
          <button
            className={viewMode === "floor" ? "active" : ""}
            onClick={() => onViewModeChange("floor")}
            type="button"
          >
            Floor plan
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
                aria-label={is2D ? "Switch to 3D view" : "Switch to 2D view"}
                title={is2D ? "Switch to 3D view" : "Switch to 2D view"}
              >
                {is2D ? "2D view" : "3D view"}
              </button>
              <button
                className={`map3d-action${exploded ? " active" : ""}`}
                onClick={onToggleExploded}
                type="button"
                aria-pressed={exploded}
              >
                {exploded ? "Stack floors" : "Explode floors"}
              </button>
            </>
          )}
          <button
            className="map3d-action"
            onClick={onResetCamera}
            type="button"
            title="Reset camera"
          >
            Reset view
          </button>
        </div>
      </div>
    </>
  );
}
