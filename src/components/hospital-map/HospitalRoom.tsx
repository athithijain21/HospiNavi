import { Text } from "@react-three/drei";
import { useState } from "react";
import type { FloorSpace } from "../../data/hospitalMapData";
import HospitalFurniture from "./HospitalFurniture";

type Props = {
  space: FloorSpace;
  selected: boolean;
  onSelect: () => void;
  onHover: (space: FloorSpace | null) => void;
};

const ROOM_WIDTH = 2.8;
const ROOM_DEPTH = 1.8;
const WALL_THICKNESS = 0.09;
const DOOR_WIDTH = 0.68;

export default function HospitalRoom({ space, selected, onSelect, onHover }: Props) {
  const [hovered, setHovered] = useState(false);
  const color = selected ? "#ffe2df" : hovered ? "#e1f4f4" : "#f7fbfb";
  const wallColor = selected ? "#f5d2cf" : "#f1f5f4";
  const wallMaterial = (
    <meshStandardMaterial
      color={wallColor}
      roughness={0.72}
    />
  );
  const glassMaterial = (
    <meshPhysicalMaterial
      color="#a8d7dc"
      transparent
      opacity={0.42}
      roughness={0.18}
      metalness={0.08}
      clearcoat={0.9}
      clearcoatRoughness={0.12}
    />
  );
  const sideWall = (x: number) => (
    <group key={`side-${x}`}>
      <mesh position={[x, 0.31, 0]} castShadow receiveShadow>
        <boxGeometry args={[WALL_THICKNESS, 0.62, ROOM_DEPTH]} />
        {wallMaterial}
      </mesh>
      {[-0.65, 0.65].map((z) => (
        <mesh key={z} position={[x, 0.82, z]} castShadow>
          <boxGeometry args={[WALL_THICKNESS, 0.38, 0.5]} />
          {wallMaterial}
        </mesh>
      ))}
      <mesh position={[x, 0.82, 0]}>
        <boxGeometry args={[WALL_THICKNESS * 0.42, 0.32, 0.78]} />
        {glassMaterial}
      </mesh>
      {[0.63, 1.01].map((y) => (
        <mesh key={y} position={[x, y, 0]}>
          <boxGeometry args={[WALL_THICKNESS * 1.2, 0.035, 0.88]} />
          <meshStandardMaterial color="#d5e5e5" metalness={0.2} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
  const backWall = (
    <group position={[0, 0, -ROOM_DEPTH / 2]}>
      <mesh position={[0, 0.31, 0]} castShadow receiveShadow>
        <boxGeometry args={[ROOM_WIDTH, 0.62, WALL_THICKNESS]} />
        {wallMaterial}
      </mesh>
      {[-0.86, 0.86].map((x) => (
        <mesh key={x} position={[x, 0.82, 0]} castShadow>
          <boxGeometry args={[1.06, 0.38, WALL_THICKNESS]} />
          {wallMaterial}
        </mesh>
      ))}
      <mesh position={[0, 0.82, 0]}>
        <boxGeometry args={[0.62, 0.32, WALL_THICKNESS * 0.42]} />
        {glassMaterial}
      </mesh>
      {[0.63, 1.01].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[0.68, 0.035, WALL_THICKNESS * 1.2]} />
          <meshStandardMaterial color="#d5e5e5" metalness={0.2} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
  const frontSegments = (ROOM_WIDTH - DOOR_WIDTH) / 2;
  const frontZ = ROOM_DEPTH / 2;

  return (
    <group
      position={[space.x, 0.02, space.z]}
      rotation={[0, space.z > 0 ? Math.PI : 0, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        onHover(space);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(null);
        document.body.style.cursor = "auto";
      }}
    >
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <boxGeometry args={[ROOM_WIDTH, 0.06, ROOM_DEPTH]} />
        <meshPhysicalMaterial color={color} roughness={0.62} clearcoat={0.12} />
      </mesh>
      {sideWall(-ROOM_WIDTH / 2)}
      {sideWall(ROOM_WIDTH / 2)}
      {backWall}
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[side * (DOOR_WIDTH / 2 + frontSegments / 2), 0, frontZ]}
        >
          <mesh position={[0, 0.32, 0]} castShadow>
            <boxGeometry args={[frontSegments, 0.64, WALL_THICKNESS]} />
            {wallMaterial}
          </mesh>
          <mesh position={[0, 0.83, 0]}>
            <boxGeometry args={[frontSegments, 0.34, WALL_THICKNESS * 0.4]} />
            {glassMaterial}
          </mesh>
          <mesh position={[0, 1.02, 0]}>
            <boxGeometry args={[frontSegments, 0.045, WALL_THICKNESS * 1.2]} />
            <meshStandardMaterial color="#d5e5e5" metalness={0.2} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={`door-frame-${side}`} position={[side * DOOR_WIDTH / 2, 0.52, frontZ]}>
          <boxGeometry args={[0.065, 1.04, 0.12]} />
          <meshStandardMaterial color="#d8e6e7" metalness={0.12} roughness={0.46} />
        </mesh>
      ))}
      <mesh position={[0, 1.04, frontZ]}>
        <boxGeometry args={[DOOR_WIDTH + 0.06, 0.06, 0.12]} />
        <meshStandardMaterial color="#d8e6e7" metalness={0.12} roughness={0.46} />
      </mesh>
      <group
        position={[-DOOR_WIDTH / 2 + 0.035, 0.04, frontZ - 0.025]}
        rotation={[0, -0.62, 0]}
      >
        <mesh position={[DOOR_WIDTH / 2, 0.46, 0]} castShadow>
          <boxGeometry args={[DOOR_WIDTH - 0.06, 0.88, 0.045]} />
          <meshStandardMaterial color="#dce9e9" roughness={0.46} />
        </mesh>
        <mesh position={[DOOR_WIDTH - 0.12, 0.46, 0.03]}>
          <boxGeometry args={[0.025, 0.13, 0.035]} />
          <meshStandardMaterial color="#91a9ac" metalness={0.65} roughness={0.25} />
        </mesh>
      </group>
      <mesh position={[0, 0.061, 0.03]} receiveShadow>
        <boxGeometry args={[2.48, 0.025, 1.48]} />
        <meshPhysicalMaterial color="#f0f5f4" roughness={0.58} clearcoat={0.08} />
      </mesh>
      {[-0.52, 0.52].map((x) => (
        <mesh key={`tile-x-${x}`} position={[x, 0.075, 0.03]}>
          <boxGeometry args={[0.009, 0.006, 1.45]} />
          <meshStandardMaterial color="#dbe7e7" roughness={0.8} />
        </mesh>
      ))}
      {[-0.45, 0, 0.45].map((z) => (
        <mesh key={`tile-z-${z}`} position={[0, 0.075, z]}>
          <boxGeometry args={[2.46, 0.006, 0.009]} />
          <meshStandardMaterial color="#dbe7e7" roughness={0.8} />
        </mesh>
      ))}
      <group position={[0, 0.07, -0.04]}>
        <HospitalFurniture kind={space.furniture} />
      </group>
      <group
        position={[0, 1.2, frontZ - 0.035]}
        rotation={[0, space.z > 0 ? Math.PI : 0, 0]}
      >
        <mesh position={[0, 0.09, 0]}>
          <boxGeometry args={[1.25, 0.34, 0.045]} />
          <meshStandardMaterial color={selected ? "#fff0ee" : "#f9ffff"} roughness={0.38} />
        </mesh>
        <Text
          position={[0, 0.15, 0.03]}
          fontSize={0.16}
          color={selected ? "#b33f3a" : "#315c64"}
          anchorX="center"
          anchorY="middle"
          maxWidth={1.2}
        >
          {space.label}
        </Text>
        <Text
          position={[0, 0.02, 0.03]}
          fontSize={0.12}
          color="#52747a"
          anchorX="center"
          anchorY="middle"
        >
          {space.roomNumber}
        </Text>
      </group>
      {selected && (
        <mesh position={[0, 0.079, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.02, 1.12, 32]} />
          <meshBasicMaterial
            color="#ef625c"
            transparent
            opacity={0.9}
            side={2}
          />
        </mesh>
      )}
    </group>
  );
}
