import { Line, Text } from "@react-three/drei";
import { useMemo } from "react";
import { DoubleSide, Quaternion, Vector3 } from "three";
import type { IndoorPositionEstimate } from "../../services/indoorPositioningService";
import type { IndoorRoute } from "../../services/hospitalRouteService";

type Props = {
  buildingId: string;
  floor: string;
  route: IndoorRoute | null;
  currentPosition: IndoorPositionEstimate | null;
};

function toFloorMapPoint(
  [x, , z]: [number, number, number],
  elevation = 0.22,
): [number, number, number] {
  return [x, elevation, z];
}

export default function HospitalNavigationPath({
  buildingId,
  floor,
  route,
  currentPosition,
}: Props) {
  const paths = useMemo(() => {
    if (!route) return [];
    return route.edges.flatMap((edge, index) => {
      if (edge.kind !== "corridor") return [];
      const from = route.nodes[index];
      const to = route.nodes[index + 1];
      if (
        !edge.path ||
        edge.path.length < 2 ||
        !from ||
        !to ||
        from.buildingId !== buildingId ||
        to.buildingId !== buildingId ||
        from.floor !== floor ||
        to.floor !== floor
      ) {
        return [];
      }
      const reversed = edge.from !== from.id;
      const path = reversed ? [...edge.path].reverse() : edge.path;
      const points = path.map((point) => toFloorMapPoint(point));
      if (points.length < 2) return [];

      const middle = Math.floor((points.length - 1) / 2);
      const arrowStart = points[middle];
      const arrowEnd = points[middle + 1];
      if (!arrowStart || !arrowEnd) return [{ id: `${from.id}-${to.id}`, points, arrow: null }];
      const direction = new Vector3(
        arrowEnd[0] - arrowStart[0],
        0,
        arrowEnd[2] - arrowStart[2],
      );
      if (direction.lengthSq() < 1e-8) {
        return [{ id: `${from.id}-${to.id}`, points, arrow: null }];
      }
      direction.normalize();
      const quaternion = new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        direction,
      );
      return [{
        id: `${from.id}-${to.id}`,
        points,
        arrow: {
          position: [
            (arrowStart[0] + arrowEnd[0]) / 2,
            0.25,
            (arrowStart[2] + arrowEnd[2]) / 2,
          ] as [number, number, number],
          quaternion: [
            quaternion.x,
            quaternion.y,
            quaternion.z,
            quaternion.w,
          ] as [number, number, number, number],
        },
      }];
    });
  }, [buildingId, floor, route]);

  const transitions = useMemo(() => {
    if (!route) return [];
    return route.edges.flatMap((edge, index) => {
      if (edge.kind === "corridor") return [];
      const from = route.nodes[index];
      const to = route.nodes[index + 1];
      if (!from || !to) return [];
      const node =
        from.buildingId === buildingId && from.floor === floor
          ? from
          : to.buildingId === buildingId && to.floor === floor
            ? to
            : null;
      if (!node?.mapPosition) return [];
      return [{
        id: `${edge.kind}-${from.id}-${to.id}`,
        kind: edge.kind,
        label: edge.label ?? (edge.kind === "elevator"
          ? `LIFT · ${from.floor} ↔ ${to.floor}`
          : edge.kind === "staircase"
            ? `STAIRS · ${from.floor} ↔ ${to.floor}`
            : `BUILDING · ${from.buildingId} ↔ ${to.buildingId}`),
        position: node.mapPosition,
      }];
    });
  }, [buildingId, floor, route]);

  const currentNode = useMemo(() => {
    if (!route) return null;
    if (currentPosition?.nearestBeaconId) {
      return route.nodes.find(
        (node) =>
        (node.positioningId === currentPosition.nearestBeaconId ||
          (currentPosition.source === "gps" &&
            node.id === currentPosition.nearestBeaconId)) &&
        (currentPosition.source === "gps" ||
          node.positioningSource === currentPosition.source) &&
          node.buildingId === buildingId &&
          node.floor === floor,
      ) ?? null;
    }
    return currentPosition?.source === "manual" &&
      route.nodes[0]?.buildingId === buildingId &&
      route.nodes[0].floor === floor
      ? route.nodes[0]
      : null;
  }, [buildingId, currentPosition, floor, route]);
  const startNode = route?.nodes[0];
  const destinationNode = route?.nodes.at(-1);

  return (
    <group>
      {paths.map((path) => (
        <Line
          key={`route-${path.id}`}
          points={path.points}
          color="#168aff"
          lineWidth={5}
          transparent
          opacity={1}
          depthTest={false}
          renderOrder={20}
        />
      ))}
      {paths.flatMap((path) =>
        path.arrow
          ? [(
              <mesh
                key={`route-arrow-${path.id}`}
                position={path.arrow.position}
                quaternion={path.arrow.quaternion}
                renderOrder={21}
              >
                <coneGeometry args={[0.12, 0.28, 3]} />
                <meshBasicMaterial
                  color="#075bb5"
                  depthTest={false}
                  toneMapped={false}
                />
              </mesh>
            )]
          : [],
      )}
      {transitions.map((transition) => (
        <group
          key={transition.id}
          position={toFloorMapPoint(transition.position, 0.34)}
        >
          <mesh rotation={[0, Math.PI / 4, 0]}>
            <octahedronGeometry args={[0.17]} />
            <meshBasicMaterial color="#f0a629" depthTest={false} />
          </mesh>
          <Text
            position={[0, 0.31, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.12}
            color="#7c4a00"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.01}
            outlineColor="white"
          >
            {transition.label}
          </Text>
        </group>
      ))}
      {startNode?.mapPosition &&
        startNode.buildingId === buildingId &&
        startNode.floor === floor && (
          <group position={toFloorMapPoint(startNode.mapPosition, 0.25)}>
            <mesh renderOrder={22}>
              <sphereGeometry args={[0.17, 20, 16]} />
              <meshBasicMaterial color="#12a66a" depthTest={false} />
            </mesh>
            <Text
              position={[0, 0.28, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.11}
              color="#087343"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.01}
              outlineColor="white"
            >
              START · {startNode.label}
            </Text>
          </group>
        )}
      {currentNode?.mapPosition &&
        currentNode.buildingId === buildingId &&
        currentNode.floor === floor && (
          <group position={toFloorMapPoint(currentNode.mapPosition, 0.31)}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, -0.02, 0]}
            >
              <ringGeometry args={[0.18, 0.24, 32]} />
              <meshBasicMaterial
                color="#168aff"
                depthTest={false}
                side={DoubleSide}
              />
            </mesh>
            <mesh position={[0, 0.02, 0]}>
              <sphereGeometry args={[0.09, 16, 12]} />
              <meshBasicMaterial color="#168aff" depthTest={false} />
            </mesh>
          </group>
        )}
      {destinationNode?.mapPosition &&
        destinationNode.buildingId === buildingId &&
        destinationNode.floor === floor &&
        (
          <group
            position={toFloorMapPoint(destinationNode.mapPosition, 0.25)}
          >
            <mesh>
              <sphereGeometry args={[0.14, 16, 12]} />
              <meshBasicMaterial color="#e34d59" depthTest={false} />
            </mesh>
            <Text
              position={[0, 0.24, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.11}
              color="#8c2630"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.01}
              outlineColor="white"
            >
              {destinationNode.label}
            </Text>
          </group>
        )}
    </group>
  );
}
