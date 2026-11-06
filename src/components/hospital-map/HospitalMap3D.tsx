import { Canvas } from "@react-three/fiber";
import { useRef, useState } from "react";
import type {
  FloorSpace,
  HospitalBuilding,
  HospitalDepartment,
} from "../../data/hospitalMapData";
import type { IndoorPositionEstimate } from "../../services/indoorPositioningService";
import type { IndoorRoute } from "../../services/hospitalRouteService";
import { getFloorSpaces } from "../../data/hospitalMapData";
import HospitalMapScene from "./HospitalMapScene";
import MapControls from "./MapControls";
import { useLanguage } from "../../hooks/useLanguage";

export type MapViewMode = "building" | "floor";

type Props = {
  buildings: HospitalBuilding[];
  departments: HospitalDepartment[];
  selectedBuilding: string;
  selectedFloor: string;
  destination: HospitalDepartment | null;
  route: IndoorRoute | null;
  viewMode: MapViewMode;
  onBuildingChange: (buildingId: string) => void;
  onFloorChange: (floor: string) => void;
  onSelectDestination: (department: HospitalDepartment) => void;
  onViewModeChange: (viewMode: MapViewMode) => void;
  currentPosition: IndoorPositionEstimate | null;
  visualStartPoint: {
    buildingId: string;
    floor: string;
    position: [number, number];
  } | null;
  placingVisualStart: boolean;
  onPlaceVisualStart: (position: [number, number]) => void;
};

export default function HospitalMap3D(props: Props) {
  const { language, t } = useLanguage();
  const [exploded, setExploded] = useState(false);
  const [is2D, setIs2D] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<FloorSpace | null>(null);
  const [hoveredRoom, setHoveredRoom] = useState<FloorSpace | null>(null);
  const resetRef = useRef<(() => void) | null>(null);
  const selectedBuilding =
    props.buildings.find((building) => building.id === props.selectedBuilding) ??
    props.buildings[0];
  const floorSpaces = getFloorSpaces(
    props.selectedBuilding,
    props.selectedFloor,
    props.departments,
  );
  const destinationRoom = props.destination
    ? floorSpaces.find((space) => space.department?.id === props.destination?.id)
    : null;
  const isCurrentRoom = (space: FloorSpace | null) =>
    space?.department
      ? space.department.building === props.selectedBuilding &&
        space.department.floor === props.selectedFloor
      : Boolean(
          space?.id.startsWith(
            `${props.selectedBuilding}-${props.selectedFloor}-shared-`,
          ),
        );
  const visibleRoom =
    (isCurrentRoom(hoveredRoom) ? hoveredRoom : null) ??
    destinationRoom ??
    (selectedRoom?.department === null && isCurrentRoom(selectedRoom)
      ? selectedRoom
      : null);
  const cameraPosition: [number, number, number] =
    props.viewMode === "building"
      ? [10, 10, 12]
      : is2D
        ? [0, exploded ? 17 : 13, 0.01]
        : exploded
          ? [12, 12, 15]
          : [9, 8, 10];
  return (
    <div className="hospital-map3d">
      <MapControls
        viewMode={props.viewMode}
        is2D={is2D}
        exploded={exploded}
        onViewModeChange={props.onViewModeChange}
        onToggle2D={() => {
          const next = !is2D;
          setIs2D(next);
          if (next) setExploded(false);
        }}
        onToggleExploded={() => {
          const next = !exploded;
          setExploded(next);
          if (next) setIs2D(false);
        }}
        onResetCamera={() => resetRef.current?.()}
      />
      <div className="map3d-stage">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{
            position: cameraPosition,
            fov: is2D ? 38 : 42,
            near: 0.1,
            far: 100,
          }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <color attach="background" args={["#eef6f7"]} />
          <fog attach="fog" args={["#eef6f7", 25, 45]} />
          <HospitalMapScene
            buildings={props.buildings}
            departments={props.departments}
            selectedBuilding={props.selectedBuilding}
            selectedFloor={props.selectedFloor}
            destination={props.destination}
            route={props.route}
            currentPosition={props.currentPosition}
            visualStartPoint={props.visualStartPoint}
            placingVisualStart={props.placingVisualStart}
            viewMode={props.viewMode}
            exploded={exploded}
            is2D={is2D}
            resetRef={resetRef}
            onBuildingChange={props.onBuildingChange}
            onFloorChange={(floor) => {
              setSelectedRoom(null);
              props.onFloorChange(floor);
            }}
            onSelectDestination={props.onSelectDestination}
            onPlaceVisualStart={props.onPlaceVisualStart}
            onSelectRoom={setSelectedRoom}
            onHoverRoom={setHoveredRoom}
            onViewModeChange={props.onViewModeChange}
          />
        </Canvas>
        <div className="map3d-compass" aria-hidden="true">
          N<b>↑</b>
        </div>
        <div className="map3d-help">
          <span>↖</span> {t("Drag to rotate", language)} <i />{" "}
          {t("Scroll to zoom", language)} <i /> {t("Right-drag to pan", language)}
        </div>
        {visibleRoom && props.viewMode === "floor" && (
          <div className="map3d-room-card" role="status">
            <strong>{t(visibleRoom.label, language)}</strong>
            <span>{t("Room", language)} {visibleRoom.roomNumber}</span>
            {visibleRoom.department && (
              <span>
                {t("Building", language)} {visibleRoom.department.building} ·{" "}
                {t(visibleRoom.department.floor, language)}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="map3d-footer">
        <div className="map3d-current">
          <span className="map3d-status-dot" />
          <div>
            <strong>
              {props.viewMode === "building"
                ? props.currentPosition
                  ? `${t("Current Location", language)} · ${t(props.buildings.find((item) => item.id === props.currentPosition?.buildingId)?.name ?? "Hospital", language)} · ${t(props.currentPosition.floor, language)}`
                  : t("Hospital campus", language)
                : `${t(selectedBuilding?.name ?? "Hospital", language)} · ${t(props.selectedFloor, language)}`}
            </strong>
            <small>
              {props.currentPosition &&
              props.currentPosition.buildingId === props.selectedBuilding &&
              props.currentPosition.floor === props.selectedFloor
                ? props.currentPosition.source === "manual"
                  ? t("Manual floor selection · no room-level position is available.", language)
                  : props.currentPosition.source === "gps"
                    ? t("GPS matched to a surveyed entrance; GPS does not identify indoor floors.", language)
                  : `${Math.round(props.currentPosition.confidence * 100)}% ${t("floor confidence · room-level position requires calibrated beacon coordinates.", language)}`
                : props.viewMode === "building"
                  ? t("Select a building to open its cutaway floor plan.", language)
                  : t("Illustrative sample layout — not an official hospital floor plan.", language)}
            </small>
          </div>
        </div>
        <div className="map3d-legend" aria-label={t("Map legend", language)}>
          <span><i className="legend-room" /> {t("Rooms", language)}</span>
          <span><i className="legend-start" /> {t("Start", language)}</span>
          <span><i className="legend-route" /> {t("Route", language)}</span>
          <span><i className="legend-destination" /> {t("Destination", language)}</span>
        </div>
      </div>
    </div>
  );
}
