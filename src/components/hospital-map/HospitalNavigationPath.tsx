import { Text } from "@react-three/drei";
import { useMemo } from "react";
import type { HospitalDepartment } from "../../data/hospitalMapData";
import { getDepartmentSlot } from "../../data/hospitalMapData";

type Props = {
  buildingId: string;
  floor: string;
  destination: HospitalDepartment | null;
  startBuilding: string;
  startFloor: string;
};

function Arrow({
  position,
  direction,
  reverse = false,
}: {
  position: [number, number, number];
  direction: "x" | "z";
  reverse?: boolean;
}) {
  const rotation: [number, number, number] =
    direction === "x"
      ? [0, 0, reverse ? Math.PI / 2 : -Math.PI / 2]
      : [reverse ? -Math.PI / 2 : Math.PI / 2, 0, 0];
  return (
    <mesh
      position={position}
      rotation={rotation}
      castShadow
    >
      <coneGeometry args={[0.14, 0.3, 5]} />
      <meshStandardMaterial
        color="#238fff"
        emissive="#1264cf"
        emissiveIntensity={0.72}
        roughness={0.28}
      />
    </mesh>
  );
}

export default function HospitalNavigationPath({
  buildingId,
  floor,
  destination,
  startBuilding,
  startFloor,
}: Props) {
  const departmentPosition = destination
    ? getDepartmentSlot(buildingId, floor, destination.id)
    : null;
  const path = useMemo(() => {
    if (!destination || !departmentPosition) return null;
    const [x, z] = departmentPosition;
    const doorwayZ = z > 0 ? 1.25 : -1.25;
    const isCurrentFloor =
      destination.building === startBuilding && destination.floor === startFloor;
    const startX = isCurrentFloor ? -4.15 : -4.4;
    return { x, doorwayZ, startX, isCurrentFloor };
  }, [departmentPosition, destination, startBuilding, startFloor]);

  if (!destination || !path) return null;

  return (
    <group>
      <mesh position={[path.startX, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.3, 32]} />
        <meshBasicMaterial color="#3bd482" transparent opacity={0.82} />
      </mesh>
      <mesh position={[path.startX, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.14, 0.24, 20]} />
        <meshStandardMaterial color="#1aaa60" emissive="#0b703a" emissiveIntensity={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[path.startX, 0.4, 0]}>
        <sphereGeometry args={[0.105, 16, 12]} />
        <meshStandardMaterial color="#55e58b" emissive="#16964f" emissiveIntensity={0.8} />
      </mesh>
      <Text
        position={[path.startX, 0.56, 0.29]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.13}
        color="#12804a"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.012}
        outlineColor="white"
      >
        {path.isCurrentFloor ? "START" : "LIFT / STAIRS"}
      </Text>
      <mesh
        position={[path.x, 0.09, path.doorwayZ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.2, 0.3, 32]} />
        <meshBasicMaterial color="#ff6a62" transparent opacity={0.86} />
      </mesh>
      <mesh position={[path.x, 0.22, path.doorwayZ]} castShadow>
        <cylinderGeometry args={[0.11, 0.14, 0.24, 20]} />
        <meshStandardMaterial color="#d9413c" emissive="#8e211e" emissiveIntensity={0.55} roughness={0.3} />
      </mesh>
      <mesh position={[path.x, 0.4, path.doorwayZ]}>
        <sphereGeometry args={[0.105, 16, 12]} />
        <meshStandardMaterial color="#ff7770" emissive="#bd2b27" emissiveIntensity={0.9} />
      </mesh>
      <Text
        position={[
          path.x,
          0.56,
          path.doorwayZ + Math.sign(path.doorwayZ) * 0.29,
        ]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.13}
        color="#b5312d"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.012}
        outlineColor="white"
      >
        DESTINATION
      </Text>
      <mesh position={[path.x, 0.095, path.doorwayZ / 2]}>
        <boxGeometry args={[0.21, 0.035, Math.abs(path.doorwayZ)]} />
        <meshBasicMaterial color="#229dff" transparent opacity={0.28} />
      </mesh>
      <mesh position={[(path.startX + path.x) / 2, 0.095, 0]}>
        <boxGeometry args={[Math.abs(path.x - path.startX), 0.035, 0.21]} />
        <meshBasicMaterial color="#229dff" transparent opacity={0.28} />
      </mesh>
      <mesh position={[path.x, 0.12, path.doorwayZ / 2]}>
        <boxGeometry args={[0.075, 0.045, Math.abs(path.doorwayZ)]} />
        <meshStandardMaterial color="#168aff" emissive="#0755c5" emissiveIntensity={0.9} roughness={0.24} />
      </mesh>
      <mesh position={[(path.startX + path.x) / 2, 0.12, 0]}>
        <boxGeometry args={[Math.max(0.1, Math.abs(path.x - path.startX)), 0.045, 0.075]} />
        <meshStandardMaterial color="#168aff" emissive="#0755c5" emissiveIntensity={0.9} roughness={0.24} />
      </mesh>
      <Arrow position={[(path.startX + path.x) / 2, 0.24, 0]} direction="x" />
      <Arrow
        position={[path.x, 0.24, path.doorwayZ / 2]}
        direction="z"
        reverse={path.doorwayZ < 0}
      />
    </group>
  );
}
