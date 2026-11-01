import { OrbitControls } from "@react-three/drei";
import type { ComponentRef } from "react";
import { useCallback, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type {
  FloorSpace,
  HospitalBuilding,
  HospitalDepartment,
} from "../../data/hospitalMapData";
import HospitalCampusModel from "./HospitalCampusModel";
import HospitalFloorModel from "./HospitalFloorModel";

type Props = {
  buildings: HospitalBuilding[];
  departments: HospitalDepartment[];
  selectedBuilding: string;
  selectedFloor: string;
  startBuilding: string;
  startFloor: string;
  destination: HospitalDepartment | null;
  viewMode: "building" | "floor";
  exploded: boolean;
  is2D: boolean;
  resetRef: { current: (() => void) | null };
  onBuildingChange: (id: string) => void;
  onFloorChange: (floor: string) => void;
  onSelectDestination: (department: HospitalDepartment) => void;
  onSelectRoom: (space: FloorSpace) => void;
  onHoverRoom: (space: FloorSpace | null) => void;
  onViewModeChange: (mode: "building" | "floor") => void;
};

export default function HospitalMapScene({
  buildings,
  departments,
  selectedBuilding,
  selectedFloor,
  startBuilding,
  startFloor,
  destination,
  viewMode,
  exploded,
  is2D,
  resetRef,
  onBuildingChange,
  onFloorChange,
  onSelectDestination,
  onSelectRoom,
  onHoverRoom,
  onViewModeChange,
}: Props) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const building = buildings.find((item) => item.id === selectedBuilding) ?? buildings[0];
  const setCameraPosition = useCallback(() => {
    const aspect = size.width / size.height;
    const responsiveScale = Math.max(1, 0.92 / aspect);
    if (viewMode === "building") {
      camera.position.set(10 * responsiveScale, 10 * responsiveScale, 12 * responsiveScale);
    } else if (is2D) {
      camera.position.set(0, Math.max(13, 17.5 / aspect), 0.01);
    } else if (exploded) {
      camera.position.set(12, 16, 16);
    } else {
      camera.position.set(9 * responsiveScale, 10 * responsiveScale, 10 * responsiveScale);
    }
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
    controls.current?.saveState();
  }, [camera, exploded, is2D, size.height, size.width, viewMode]);
  useEffect(() => {
    resetRef.current = setCameraPosition;
    setCameraPosition();
    return () => {
      resetRef.current = null;
    };
  }, [resetRef, setCameraPosition, selectedBuilding, selectedFloor]);

  if (viewMode === "building") {
    return (
      <>
        <ambientLight intensity={0.85} />
        <hemisphereLight args={["#ffffff", "#d0e0df", 0.85]} />
        <directionalLight
          position={[6, 12, 8]}
          intensity={1.55}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <HospitalCampusModel
          buildings={buildings}
          selectedBuilding={selectedBuilding}
          onSelectBuilding={(id) => {
            onBuildingChange(id);
            onFloorChange(
              buildings.find((item) => item.id === id)?.floors[0] ?? "Ground Floor",
            );
            onViewModeChange("floor");
          }}
        />
        <OrbitControls
          ref={controls}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={8}
          maxDistance={21}
          minPolarAngle={0.28}
          maxPolarAngle={Math.PI / 2.15}
        />
      </>
    );
  }

  if (!building) return null;
  const floors = exploded ? building.floors : [selectedFloor];
  const centerY = exploded ? ((floors.length - 1) * 2.05) / 2 : 0;

  return (
    <>
      <ambientLight intensity={0.62} />
      <hemisphereLight args={["#ffffff", "#b8c8c8", 0.68]} />
      <directionalLight
        position={[-5, 12, 8]}
        intensity={2.15}
        castShadow
        shadow-mapSize-width={1536}
        shadow-mapSize-height={1536}
      />
      <group position={[0, -centerY, 0]}>
        {floors.map((floor) => {
          const index = building.floors.indexOf(floor);
          const y = exploded ? index * 2.05 : 0;
          return (
            <HospitalFloorModel
              key={floor}
              building={building}
              floor={floor}
              departments={departments}
              destination={destination}
              startBuilding={startBuilding}
              startFloor={startFloor}
              y={y}
              selected={floor === selectedFloor}
              onSelectFloor={() => onFloorChange(floor)}
              onSelectDestination={onSelectDestination}
              onSelectRoom={onSelectRoom}
              onHoverRoom={onHoverRoom}
            />
          );
        })}
      </group>
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enableRotate={!is2D}
        minDistance={7}
        maxDistance={exploded ? 25 : 17}
        minPolarAngle={is2D ? 0.0001 : 0.35}
        maxPolarAngle={is2D ? 0.0001 : Math.PI / 2.2}
        target={[0, 0, 0]}
      />
    </>
  );
}
