import { Text } from "@react-three/drei";
import type { HospitalBuilding, HospitalDepartment, FloorSpace } from "../../data/hospitalMapData";
import { getFloorSpaces } from "../../data/hospitalMapData";
import HospitalCorridor from "./HospitalCorridor";
import HospitalNavigationPath from "./HospitalNavigationPath";
import HospitalRoom from "./HospitalRoom";

type Props = {
  building: HospitalBuilding;
  floor: string;
  departments: HospitalDepartment[];
  destination: HospitalDepartment | null;
  startBuilding: string;
  startFloor: string;
  y: number;
  selected: boolean;
  onSelectFloor: () => void;
  onSelectDestination: (department: HospitalDepartment) => void;
  onSelectRoom: (space: FloorSpace) => void;
  onHoverRoom: (space: FloorSpace | null) => void;
};

export default function HospitalFloorModel({
  building,
  floor,
  departments,
  destination,
  startBuilding,
  startFloor,
  y,
  selected,
  onSelectFloor,
  onSelectDestination,
  onSelectRoom,
  onHoverRoom,
}: Props) {
  const spaces = getFloorSpaces(building.id, floor, departments);

  return (
    <group position={[0, y, 0]}>
      <mesh
        position={[0, -0.07, 0]}
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          onSelectFloor();
        }}
      >
        <boxGeometry args={[11.7, 0.13, 8.5]} />
        <meshStandardMaterial
          color={selected ? "#e5e9e7" : "#d9e0df"}
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
          destination={destination}
          startBuilding={startBuilding}
          startFloor={startFloor}
        />
      )}
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
