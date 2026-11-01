import { Canvas } from "@react-three/fiber";
import { useRef, useState } from "react";
import type {
  FloorSpace,
  HospitalBuilding,
  HospitalDepartment,
} from "../../data/hospitalMapData";
import { getFloorSpaces } from "../../data/hospitalMapData";
import HospitalMapScene from "./HospitalMapScene";
import MapControls from "./MapControls";

export type MapViewMode = "building" | "floor";

type Props = {
  buildings: HospitalBuilding[];
  departments: HospitalDepartment[];
  selectedBuilding: string;
  selectedFloor: string;
  startBuilding: string;
  startFloor: string;
  destination: HospitalDepartment | null;
  viewMode: MapViewMode;
  onBuildingChange: (buildingId: string) => void;
  onFloorChange: (floor: string) => void;
  onSelectDestination: (department: HospitalDepartment) => void;
  onViewModeChange: (viewMode: MapViewMode) => void;
};

export default function HospitalMap3D(props: Props) {
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
            startBuilding={props.startBuilding}
            startFloor={props.startFloor}
            destination={props.destination}
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
            onSelectRoom={setSelectedRoom}
            onHoverRoom={setHoveredRoom}
            onViewModeChange={props.onViewModeChange}
          />
        </Canvas>
        <div className="map3d-compass" aria-hidden="true">
          N<b>↑</b>
        </div>
        <div className="map3d-help">
          <span>↖</span> Drag to rotate <i /> Scroll to zoom <i /> Right-drag to pan
        </div>
        {visibleRoom && props.viewMode === "floor" && (
          <div className="map3d-room-card" role="status">
            <strong>{visibleRoom.label}</strong>
            <span>Room {visibleRoom.roomNumber}</span>
            {visibleRoom.department && (
              <span>
                Building {visibleRoom.department.building} ·{" "}
                {visibleRoom.department.floor}
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
                ? "Hospital campus"
                : `${selectedBuilding?.name ?? "Hospital"} · ${props.selectedFloor}`}
            </strong>
            <small>
              {props.viewMode === "building"
                ? "Select a building to open its cutaway floor plan."
                : "Illustrative sample layout — not an official hospital floor plan."}
            </small>
          </div>
        </div>
        <div className="map3d-legend" aria-label="Map legend">
          <span><i className="legend-room" /> Rooms</span>
          <span><i className="legend-start" /> Start</span>
          <span><i className="legend-route" /> Route</span>
          <span><i className="legend-destination" /> Destination</span>
        </div>
      </div>
    </div>
  );
}
