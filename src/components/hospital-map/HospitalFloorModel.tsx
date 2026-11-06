import { Text } from "@react-three/drei";
import type { HospitalBuilding, HospitalDepartment, FloorSpace } from "../../data/hospitalMapData";
import { getFloorSpaces } from "../../data/hospitalMapData";
import type { IndoorPositionEstimate } from "../../services/indoorPositioningService";
import type { IndoorRoute } from "../../services/hospitalRouteService";
import HospitalCorridor from "./HospitalCorridor";
import HospitalNavigationPath from "./HospitalNavigationPath";
import HospitalRoom from "./HospitalRoom";

type Props = {
  building: HospitalBuilding;
  floor: string;
  departments: HospitalDepartment[];
  destination: HospitalDepartment | null;
  route: IndoorRoute | null;
  currentPosition: IndoorPositionEstimate | null;
  visualStartPosition: [number, number] | null;
  placingVisualStart: boolean;
  y: number;
  selected: boolean;
  onSelectFloor: () => void;
  onSelectDestination: (department: HospitalDepartment) => void;
  onPlaceVisualStart: (position: [number, number]) => void;
  onSelectRoom: (space: FloorSpace) => void;
  onHoverRoom: (space: FloorSpace | null) => void;
};

export default function HospitalFloorModel({
  building,
  floor,
  departments,
  destination,
  route,
  currentPosition,
  visualStartPosition,
  placingVisualStart,
  y,
  selected,
  onSelectFloor,
  onSelectDestination,
  onPlaceVisualStart,
  onSelectRoom,
  onHoverRoom,
}: Props) {
  const spaces = getFloorSpaces(building.id, floor, departments);
  const isCurrentLocation =
    currentPosition?.buildingId === building.id && currentPosition.floor === floor;
  const currentRouteNode =
    route?.nodes.find(
      (node) =>
        currentPosition?.nearestBeaconId
          ? (node.positioningId === currentPosition.nearestBeaconId ||
              (currentPosition.source === "gps" &&
                node.id === currentPosition.nearestBeaconId)) &&
            (currentPosition.source === "gps" ||
              node.positioningSource === currentPosition.source)
          : currentPosition?.source === "manual" &&
            node.id === route?.nodes[0]?.id,
    ) ?? null;

  return (
    <group position={[0, y, 0]}>
      <mesh
        position={[0, -0.07, 0]}
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          if (placingVisualStart) {
            onPlaceVisualStart([event.point.x, event.point.z]);
          } else {
            onSelectFloor();
          }
        }}
      >
        <boxGeometry args={[11.7, 0.13, 8.5]} />
        <meshStandardMaterial
          color={isCurrentLocation ? "#cfece8" : selected ? "#e5e9e7" : "#d9e0df"}
          roughness={0.78}
        />
      </mesh>
      <mesh position={[0, -0.13, 0]} receiveShadow>
        <boxGeometry args={[11.45, 0.06, 8.25]} />
        <meshStandardMaterial color="#bdcdcc" roughness={0.76} />
      </mesh>
      <HospitalCorridor />
      {spaces.map((space) => (
        <HospitalRoom
          key={space.id}
          space={space}
          selected={destination !== null && space.department?.id === destination.id}
          onHover={onHoverRoom}
          onSelect={() => {
            onSelectRoom(space);
            if (space.department) onSelectDestination(space.department);
          }}
        />
      ))}
      {selected && (
        <HospitalNavigationPath
          buildingId={building.id}
          floor={floor}
          route={route}
          currentPosition={currentPosition}
        />
      )}
      {visualStartPosition && (
        <group position={[visualStartPosition[0], 0.2, visualStartPosition[1]]}>
          <mesh>
            <sphereGeometry args={[0.16, 20, 16]} />
            <meshStandardMaterial color="#168aff" emissive="#073c79" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
            <ringGeometry args={[0.2, 0.28, 32]} />
            <meshBasicMaterial color="#168aff" transparent opacity={0.85} />
          </mesh>
          <Text
            position={[0, 0.3, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.13}
            color="#0756a3"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.01}
            outlineColor="white"
          >
            VISUAL START · NOT ROUTABLE
          </Text>
        </group>
      )}
      {placingVisualStart && (
        <Text
          position={[0, 0.12, -3.55]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.13}
          color="#0756a3"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="white"
        >
          CLICK AN OPEN FLOOR AREA TO PLACE A VISUAL-ONLY START
        </Text>
      )}
      <Text
        position={[-5.15, 0.11, -3.82]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.09}
        color="#087e83"
        anchorX="left"
        anchorY="middle"
      >
        {isCurrentLocation
          ? currentRouteNode?.mapPosition
            ? `${currentPosition?.source === "manual" ? "CONFIRMED START" : "CURRENT POSITION"} · ${currentRouteNode.label}`
            : "CURRENT FLOOR · ROOM POSITION NOT AVAILABLE"
          : ""}
      </Text>
      <Text
        position={[0, 0.11, -3.82]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.2}
        color="#37636a"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.012}
        outlineColor="#ffffff"
      >
        {building.id} · {building.name} · {floor}
      </Text>
      <Text
        position={[0, 0.11, 3.88]}
        rotation={[-Math.PI / 2, Math.PI, 0]}
        fontSize={0.11}
        color="#779297"
        anchorX="center"
        anchorY="middle"
      >
        SAMPLE LAYOUT · NOT AN OFFICIAL FLOOR PLAN
      </Text>
    </group>
  );
}
