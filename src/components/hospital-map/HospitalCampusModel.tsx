import { Text } from "@react-three/drei";
import type { HospitalBuilding } from "../../data/hospitalMapData";

type Props = {
  buildings: HospitalBuilding[];
  selectedBuilding: string;
  onSelectBuilding: (id: string) => void;
};

const positions: Record<string, [number, number]> = {
  A: [-3.35, -2.05],
  B: [3.35, -2.05],
  C: [-3.35, 2.05],
  D: [3.35, 2.05],
};

function CampusBuilding({
  building,
  selected,
  onSelect,
}: {
  building: HospitalBuilding;
  selected: boolean;
  onSelect: () => void;
}) {
  const [x, z] = positions[building.id] ?? [0, 0];
  const floors = building.floors.length;
  const bodyColor = selected ? "#c4e7e9" : "#deebec";

  return (
    <group
      position={[x, 0, z]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[3.55, 0.16, 2.9]} />
        <meshStandardMaterial color={selected ? "#b3dfe2" : "#cfdfdf"} />
      </mesh>
      {Array.from({ length: floors }, (_, index) => {
        const y = 0.34 + index * 0.62;
        return (
          <group key={index}>
            <mesh position={[0, y, 0]} castShadow receiveShadow>
              <boxGeometry args={[3.08, 0.49, 2.44]} />
              <meshStandardMaterial
                color={bodyColor}
                transparent
                opacity={0.86}
                roughness={0.48}
              />
            </mesh>
            <mesh position={[0, y + 0.015, 1.235]}>
              <boxGeometry args={[2.78, 0.27, 0.035]} />
              <meshPhysicalMaterial
                color="#83c2cb"
                transparent
                opacity={0.52}
                roughness={0.18}
                metalness={0.08}
              />
            </mesh>
            <mesh position={[0, y - 0.235, 0]}>
              <boxGeometry args={[3.18, 0.07, 2.55]} />
              <meshStandardMaterial color="#b4d7da" roughness={0.55} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, 0.24 + floors * 0.62, 0]} castShadow>
        <boxGeometry args={[3.38, 0.2, 2.72]} />
        <meshStandardMaterial color="#f7ffff" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.2, 1.27]}>
        <boxGeometry args={[0.72, 0.38, 0.05]} />
        <meshStandardMaterial color="#78b8c0" />
      </mesh>
      <Text
        position={[0, 0.24 + floors * 0.62 + 0.28, 0]}
        fontSize={0.22}
        color={selected ? "#087f90" : "#2b5961"}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.014}
        outlineColor="#ffffff"
      >
        BUILDING {building.id}
      </Text>
      <Text
        position={[0, 0.24 + floors * 0.62 + 0.25, 0]}
        fontSize={0.14}
        color="#426b71"
        anchorX="center"
        anchorY="middle"
      >
        {building.name}
      </Text>
    </group>
  );
}

export default function HospitalCampusModel({
  buildings,
  selectedBuilding,
  onSelectBuilding,
}: Props) {
  return (
    <group>
      <mesh position={[0, -0.16, 0]} receiveShadow>
        <boxGeometry args={[12.7, 0.28, 8.6]} />
        <meshStandardMaterial color="#e7f0ef" roughness={0.88} />
      </mesh>
      <mesh position={[0, -0.005, 0]}>
        <boxGeometry args={[12.35, 0.04, 8.25]} />
        <meshStandardMaterial color="#f5f8f6" roughness={0.8} />
      </mesh>
      {buildings.map((building) => (
        <CampusBuilding
          key={building.id}
          building={building}
          selected={building.id === selectedBuilding}
          onSelect={() => onSelectBuilding(building.id)}
        />
      ))}
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.65, 0.76, 40]} />
        <meshStandardMaterial color="#a8ced0" />
      </mesh>
      <Text
        position={[0, 0.08, 0]}
        fontSize={0.12}
        color="#52767a"
        anchorX="center"
        anchorY="middle"
      >
        HOSPITAL CAMPUS
      </Text>
      <Text
        position={[0, 0.04, 3.9]}
        fontSize={0.12}
        color="#779297"
        anchorX="center"
        anchorY="middle"
      >
        SELECT A BUILDING TO EXPLORE ITS FLOOR
      </Text>
    </group>
  );
}
