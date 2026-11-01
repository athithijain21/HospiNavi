import { Text } from "@react-three/drei";

export default function HospitalCorridor() {
  return (
    <group>
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[10.5, 0.06, 2.5]} />
        <meshStandardMaterial color="#e2ecec" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.035, 0]} receiveShadow>
        <boxGeometry args={[10.1, 0.015, 1.54]} />
        <meshPhysicalMaterial color="#f4f6f5" roughness={0.62} clearcoat={0.1} />
      </mesh>
      {Array.from({ length: 10 }, (_, index) => (
        <mesh key={`floor-joint-${index}`} position={[-4.5 + index, 0.045, 0]}>
          <boxGeometry args={[0.012, 0.006, 1.52]} />
          <meshStandardMaterial color="#dce4e3" roughness={0.82} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={`teal-inlay-${side}`} position={[0, 0.048, side * 0.76]}>
          <boxGeometry args={[10.1, 0.012, 0.045]} />
          <meshStandardMaterial color="#b4dfe0" roughness={0.48} />
        </mesh>
      ))}
      {[-4.7, 4.7].map((x) => (
        <mesh key={x} position={[x, 0.12, 0]}>
          <boxGeometry args={[0.76, 0.2, 1.8]} />
          <meshStandardMaterial color="#c5e1e3" roughness={0.5} />
        </mesh>
      ))}
      {[-4.7, 4.7].map((x) => (
        <mesh key={`lift-door-${x}`} position={[x, 0.58, 0]}>
          <boxGeometry args={[0.65, 0.78, 1.06]} />
          <meshStandardMaterial
            color="#effafa"
            metalness={0.28}
            roughness={0.3}
          />
        </mesh>
      ))}
      {[-4.7, 4.7].map((x) => (
        <group key={`lift-label-${x}`}>
          <mesh position={[x, 1.02, 0]}>
            <boxGeometry args={[0.23, 0.12, 0.04]} />
            <meshStandardMaterial color="#2a8e9a" emissive="#1c6670" />
          </mesh>
          <Text
            position={[x, 1.03, 0.04]}
            fontSize={0.07}
            color="white"
            anchorX="center"
            anchorY="middle"
          >
            LIFT
          </Text>
        </group>
      ))}
      <group position={[-3.55, 0.15, -0.55]}>
        {[0, 1, 2, 3].map((step) => (
          <mesh key={step} position={[0, step * 0.12, -0.62 + step * 0.3]}>
            <boxGeometry args={[0.74, 0.12, 0.36]} />
            <meshStandardMaterial color="#c9dfe0" roughness={0.65} />
          </mesh>
        ))}
        <Text
          position={[0, 0.72, 0.05]}
          fontSize={0.1}
          color="#315c64"
          anchorX="center"
          anchorY="middle"
        >
          STAIRS
        </Text>
      </group>
      {[-1, 1].map((side) => (
        <mesh key={`edge-trim-${side}`} position={[0, 0.055, side * 1.21]}>
          <boxGeometry args={[10.35, 0.035, 0.045]} />
          <meshStandardMaterial color="#d1e1e1" metalness={0.18} roughness={0.5} />
        </mesh>
      ))}
      <Text
        position={[0, 0.1, 0.05]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.16}
        color="#94afb2"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.12}
      >
        MAIN CORRIDOR
      </Text>
    </group>
  );
}
