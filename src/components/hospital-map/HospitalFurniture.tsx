import type { FurnitureKind } from "../../data/hospitalMapData";

function Bed() {
  return (
    <group position={[-0.12, 0.12, -0.05]}>
      <mesh position={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[0.76, 0.13, 1.22]} />
        <meshStandardMaterial color="#dce8e9" metalness={0.18} roughness={0.38} />
      </mesh>
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[0.71, 0.14, 1.16]} />
        <meshStandardMaterial color="#fbfdfd" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.37, 0.14]} castShadow>
        <boxGeometry args={[0.67, 0.055, 0.76]} />
        <meshStandardMaterial color="#acdce1" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.37, -0.43]} castShadow>
        <boxGeometry args={[0.48, 0.1, 0.22]} />
        <meshStandardMaterial color="#ffffff" roughness={0.42} />
      </mesh>
      {[[-0.3, -0.48], [0.3, -0.48], [-0.3, 0.48], [0.3, 0.48]].map(
        ([x, z]) => (
          <mesh key={`${x}-${z}`} position={[x, 0.07, z]}>
            <cylinderGeometry args={[0.025, 0.035, 0.22, 8]} />
            <meshStandardMaterial color="#81999e" metalness={0.62} roughness={0.3} />
          </mesh>
        ),
      )}
      <mesh position={[0, 0.39, 0.62]}>
        <boxGeometry args={[0.8, 0.07, 0.07]} />
        <meshStandardMaterial color="#7d9ba1" metalness={0.48} roughness={0.3} />
      </mesh>
      <mesh position={[0.39, 0.24, 0.02]}>
        <boxGeometry args={[0.06, 0.32, 0.92]} />
        <meshStandardMaterial color="#8ba7aa" metalness={0.55} roughness={0.32} />
      </mesh>
    </group>
  );
}

function Chair({
  position,
  color = "#7ec2c7",
  office = false,
}: {
  position: [number, number, number];
  color?: string;
  office?: boolean;
}) {
  return (
    <group position={position}>
      <mesh position={[0, office ? 0.3 : 0.18, 0]} castShadow>
        <boxGeometry args={[office ? 0.42 : 0.38, 0.08, office ? 0.4 : 0.36]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, office ? 0.57 : 0.39, -0.15]}>
        <boxGeometry args={[office ? 0.42 : 0.38, office ? 0.44 : 0.36, 0.06]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {office ? (
        <group>
          <mesh position={[0, 0.13, 0]}>
            <cylinderGeometry args={[0.055, 0.055, 0.28, 12]} />
            <meshStandardMaterial color="#8ba1a5" metalness={0.55} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.035, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 0.035, 16]} />
            <meshStandardMaterial color="#82999d" metalness={0.5} roughness={0.4} />
          </mesh>
          {[0, 1, 2, 3, 4].map((spoke) => (
            <group key={spoke} rotation={[0, (spoke * Math.PI * 2) / 5, 0]}>
              <mesh position={[0.16, 0.035, 0]}>
                <boxGeometry args={[0.2, 0.025, 0.035]} />
                <meshStandardMaterial color="#82999d" metalness={0.5} />
              </mesh>
              <mesh position={[0.25, 0.025, 0]}>
                <sphereGeometry args={[0.045, 8, 6]} />
                <meshStandardMaterial color="#5e7479" />
              </mesh>
            </group>
          ))}
          {[-0.25, 0.25].map((x) => (
            <mesh key={x} position={[x, 0.4, 0]}>
              <boxGeometry args={[0.045, 0.05, 0.32]} />
              <meshStandardMaterial color="#849a9e" metalness={0.45} />
            </mesh>
          ))}
        </group>
      ) : (
        [-0.14, 0.14].map((x) =>
          [-0.12, 0.12].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, 0.08, z]}>
              <cylinderGeometry args={[0.018, 0.018, 0.18, 6]} />
              <meshStandardMaterial color="#8ba1a5" metalness={0.45} />
            </mesh>
          )),
        )
      )}
    </group>
  );
}

function Desk({
  color = "#d5e6e7",
  counter = false,
}: {
  color?: string;
  counter?: boolean;
}) {
  return (
    <group>
      <mesh position={[0, counter ? 0.42 : 0.35, 0]} castShadow>
        <boxGeometry args={[counter ? 1.48 : 1.3, 0.1, counter ? 0.58 : 0.45]} />
        <meshStandardMaterial color={color} roughness={0.42} />
      </mesh>
      {counter ? (
        <mesh position={[0, 0.23, 0.08]} castShadow>
          <boxGeometry args={[1.38, 0.3, 0.39]} />
          <meshStandardMaterial color="#80c4c9" roughness={0.48} />
        </mesh>
      ) : (
        <mesh position={[0, 0.18, 0]}>
          <boxGeometry args={[1.15, 0.27, 0.34]} />
          <meshStandardMaterial color="#ffffff" roughness={0.55} />
        </mesh>
      )}
      <mesh position={[0.34, counter ? 0.49 : 0.43, -0.04]}>
        <boxGeometry args={[0.26, 0.1, 0.18]} />
        <meshStandardMaterial color="#345b68" roughness={0.25} />
      </mesh>
      <mesh position={[0.34, counter ? 0.55 : 0.49, -0.04]}>
        <boxGeometry args={[0.2, 0.018, 0.14]} />
        <meshStandardMaterial color="#73b9c3" emissive="#276f78" emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

function BedsideTable() {
  return (
    <group position={[0.88, 0.08, -0.25]}>
      <mesh position={[0, 0.26, 0]} castShadow>
        <boxGeometry args={[0.32, 0.48, 0.34]} />
        <meshStandardMaterial color="#edf5f5" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.36, 0.055, 0.38]} />
        <meshStandardMaterial color="#dce9e9" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.29, 0.176]}>
        <boxGeometry args={[0.22, 0.17, 0.018]} />
        <meshStandardMaterial color="#d5e7e8" />
      </mesh>
      <mesh position={[0.1, 0.29, 0.19]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshStandardMaterial color="#6a8d91" metalness={0.5} />
      </mesh>
      {[-0.11, 0.11].map((x) => (
        <mesh key={x} position={[x, 0.035, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.07, 8]} />
          <meshStandardMaterial color="#83999c" metalness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

function IVStand() {
  return (
    <group position={[0.92, 0.08, 0.45]}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.88, 8]} />
        <meshStandardMaterial color="#82999d" metalness={0.65} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.98, 0]}>
        <boxGeometry args={[0.28, 0.035, 0.035]} />
        <meshStandardMaterial color="#82999d" metalness={0.65} />
      </mesh>
      <mesh position={[0.08, 0.78, 0]}>
        <cylinderGeometry args={[0.065, 0.065, 0.16, 12]} />
        <meshPhysicalMaterial color="#bce8ed" transparent opacity={0.65} roughness={0.18} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.025, 12]} />
        <meshStandardMaterial color="#82999d" metalness={0.55} />
      </mesh>
    </group>
  );
}

function LaboratoryBench() {
  return (
    <group>
      <Desk color="#d3e8e8" />
      {[-0.38, -0.12, 0.14, 0.4].map((x, index) => (
        <group key={x} position={[x, 0.42, 0.04]}>
          <mesh position={[0, 0.1 + (index % 2) * 0.06, 0]}>
            <cylinderGeometry args={[0.055, 0.07, 0.23 + (index % 2) * 0.12, 12]} />
            <meshPhysicalMaterial
              color={index % 2 ? "#65b8d0" : "#b3dfe2"}
              roughness={0.18}
              transmission={0.25}
            />
          </mesh>
          <mesh position={[0, 0.23 + (index % 2) * 0.06, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.025, 12]} />
            <meshStandardMaterial color="#e9f4f4" />
          </mesh>
        </group>
      ))}
      <mesh position={[-0.48, 0.53, -0.12]}>
        <boxGeometry args={[0.22, 0.18, 0.17]} />
        <meshStandardMaterial color="#668e9a" roughness={0.32} />
      </mesh>
      <group position={[-0.48, 0.43, -0.12]}>
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[0.24, 0.025, 0.2]} />
          <meshStandardMaterial color="#c7e0e2" />
        </mesh>
        {[0, 1, 2].map((tube) => (
          <mesh key={tube} position={[-0.06 + tube * 0.06, 0.13, 0]}>
            <cylinderGeometry args={[0.018, 0.022, 0.16, 8]} />
            <meshStandardMaterial color={tube === 1 ? "#83c6a9" : "#df8791"} />
          </mesh>
        ))}
      </group>
      <mesh position={[-0.42, 0.55, -0.13]}>
        <boxGeometry args={[0.28, 0.035, 0.23]} />
        <meshStandardMaterial color="#527984" metalness={0.38} roughness={0.34} />
      </mesh>
    </group>
  );
}

function PharmacyShelves() {
  return (
    <group>
      {[-0.48, 0, 0.48].map((x) => (
        <group key={x} position={[x, 0, -0.24]}>
          <mesh position={[0, 0.38, 0]}>
            <boxGeometry args={[0.34, 0.68, 0.12]} />
            <meshStandardMaterial color="#edf7f7" roughness={0.6} />
          </mesh>
          {[0.2, 0.4, 0.6].map((y, index) => (
            <mesh key={y} position={[0, y, 0.08]}>
              <boxGeometry args={[0.32, 0.035, 0.035]} />
              <meshStandardMaterial color={index === 1 ? "#5fbac0" : "#afdae0"} />
            </mesh>
          ))}
          {[0, 1, 2].map((pill) => (
            <mesh key={pill} position={[-0.09 + pill * 0.09, 0.29, 0.1]}>
              <cylinderGeometry args={[0.025, 0.025, 0.08, 8]} />
              <meshStandardMaterial color={pill === 1 ? "#75c3a9" : "#80b9dc"} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 0.35, 0.38]} castShadow>
        <boxGeometry args={[1.28, 0.1, 0.34]} />
        <meshStandardMaterial color="#c7e4e6" />
      </mesh>
    </group>
  );
}

function WashroomFixtures() {
  return (
    <group>
      <mesh position={[-0.3, 0.18, -0.24]}>
        <cylinderGeometry args={[0.18, 0.2, 0.3, 16]} />
        <meshStandardMaterial color="#f8ffff" roughness={0.28} />
      </mesh>
      <mesh position={[-0.3, 0.34, -0.24]}>
        <torusGeometry args={[0.11, 0.035, 8, 24]} />
        <meshStandardMaterial color="#d6e8e9" />
      </mesh>
      <mesh position={[0.37, 0.48, -0.32]}>
        <boxGeometry args={[0.52, 0.08, 0.34]} />
        <meshStandardMaterial color="#f8ffff" roughness={0.25} />
      </mesh>
      <mesh position={[0.37, 0.38, -0.32]}>
        <cylinderGeometry args={[0.07, 0.08, 0.14, 12]} />
        <meshStandardMaterial color="#d6e8e9" />
      </mesh>
      <mesh position={[0.37, 0.55, -0.48]}>
        <cylinderGeometry args={[0.018, 0.018, 0.18, 8]} />
        <meshStandardMaterial color="#8caeb2" metalness={0.6} />
      </mesh>
    </group>
  );
}

function ImagingEquipment() {
  return (
    <group>
      <mesh position={[0.05, 0.39, -0.1]} castShadow>
        <cylinderGeometry args={[0.46, 0.46, 0.3, 32]} />
        <meshStandardMaterial color="#f6fbfb" roughness={0.28} />
      </mesh>
      <mesh position={[0.05, 0.39, -0.1]}>
        <cylinderGeometry args={[0.3, 0.3, 0.32, 32]} />
        <meshStandardMaterial color="#acd9de" roughness={0.3} />
      </mesh>
      <mesh position={[0.05, 0.14, 0.55]}>
        <boxGeometry args={[0.55, 0.08, 0.95]} />
        <meshStandardMaterial color="#f8ffff" />
      </mesh>
      <mesh position={[0.05, 0.22, 0.56]}>
        <boxGeometry args={[0.38, 0.08, 0.67]} />
        <meshStandardMaterial color="#c1e4e7" />
      </mesh>
    </group>
  );
}

export default function HospitalFurniture({ kind }: { kind: FurnitureKind }) {
  switch (kind) {
    case "bed":
      return (
        <group>
          <Bed />
          <BedsideTable />
          <IVStand />
        </group>
      );
    case "reception":
      return (
        <group>
          <Desk color="#72bac0" counter />
          <Chair position={[0, 0, -0.5]} color="#83b9be" office />
        </group>
      );
    case "consultation":
      return (
        <group>
          <Desk />
          <Chair position={[-0.42, 0, -0.48]} color="#7eafb7" office />
          <Chair position={[0.42, 0, 0.48]} color="#aacdd0" />
          <mesh position={[0.46, 0.54, -0.14]}>
            <boxGeometry args={[0.24, 0.18, 0.04]} />
            <meshStandardMaterial color="#b8d9dc" />
          </mesh>
        </group>
      );
    case "laboratory":
      return <LaboratoryBench />;
    case "pharmacy":
      return <PharmacyShelves />;
    case "waiting":
      return (
        <group>
          <Chair position={[-0.48, 0, -0.25]} />
          <Chair position={[0, 0, -0.25]} />
          <Chair position={[0.48, 0, -0.25]} />
          <Chair position={[-0.48, 0, 0.38]} color="#8fbfc4" />
          <Chair position={[0, 0, 0.38]} color="#8fbfc4" />
          <Chair position={[0.48, 0, 0.38]} color="#8fbfc4" />
        </group>
      );
    case "imaging":
      return <ImagingEquipment />;
    case "washroom":
      return <WashroomFixtures />;
    case "office":
      return (
        <group>
          <Desk />
          <Chair position={[0, 0, -0.48]} office />
          <mesh position={[-0.48, 0.4, -0.3]}>
            <boxGeometry args={[0.2, 0.24, 0.2]} />
            <meshStandardMaterial color="#b9dcdf" />
          </mesh>
        </group>
      );
  }
}
