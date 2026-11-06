import type {
  HospitalRouteGraph,
  RouteNode,
} from "../data/hospitalRouteGraphData";
import { hospitalRouteGraph } from "../data/hospitalRouteGraphData";
import type { IndoorPositionEstimate } from "./indoorPositioningService";
import type { GPSFix } from "./gpsPositioningService";

export type MatchedRoutePosition = {
  node: RouteNode;
  source: "ble" | "wifi" | "gps";
  confidence: number;
  distanceMetres: number | null;
};

const walkableKinds = new Set<RouteNode["kind"]>([
  "corridor",
  "junction",
  "entrance",
  "elevator",
  "staircase",
]);

function geographicDistanceMetres(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(left.latitude)) *
      Math.cos(radians(right.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function matchIndoorPositionToRouteNode(
  estimate: IndoorPositionEstimate | null,
  graph: HospitalRouteGraph = hospitalRouteGraph,
  confidenceThreshold = 0.72,
  now = Date.now(),
): MatchedRoutePosition | null {
  if (
    !estimate ||
    (estimate.source !== "ble" && estimate.source !== "wifi") ||
    now - estimate.timestamp > 15_000 ||
    estimate.confidence < confidenceThreshold ||
    !estimate.nearestBeaconId
  ) {
    return null;
  }
  const node = graph.nodes.find(
    (candidate) =>
      walkableKinds.has(candidate.kind) &&
      candidate.positioningId === estimate.nearestBeaconId &&
      candidate.positioningSource === estimate.source &&
      candidate.buildingId === estimate.buildingId &&
      candidate.floor === estimate.floor,
  );
  return node
    ? {
        node,
        source: estimate.source,
        confidence: estimate.confidence,
        distanceMetres: null,
      }
    : null;
}

export function matchGPSPositionToRouteNode(
  fix: GPSFix | null,
  graph: HospitalRouteGraph = hospitalRouteGraph,
  maximumAccuracyMetres = 25,
  maximumSnapDistanceMetres = 30,
  now = Date.now(),
): MatchedRoutePosition | null {
  if (
    !fix ||
    now - fix.timestamp > 60_000 ||
    !Number.isFinite(fix.accuracy) ||
    fix.accuracy <= 0 ||
    fix.accuracy > maximumAccuracyMetres
  ) {
    return null;
  }
  const nearest = graph.nodes
    .flatMap((node) => {
      if (
        node.kind !== "entrance" ||
        !node.geoPosition ||
        !Number.isFinite(node.geoPosition.latitude) ||
        node.geoPosition.latitude < -90 ||
        node.geoPosition.latitude > 90 ||
        !Number.isFinite(node.geoPosition.longitude) ||
        node.geoPosition.longitude < -180 ||
        node.geoPosition.longitude > 180
      ) {
        return [];
      }
      return [{
        node,
        distanceMetres: geographicDistanceMetres(fix, node.geoPosition),
      }];
    })
    .sort((left, right) => left.distanceMetres - right.distanceMetres)[0];
  if (
    !nearest ||
    nearest.distanceMetres > Math.min(maximumSnapDistanceMetres, fix.accuracy)
  ) {
    return null;
  }
  const confidence = Math.max(
    0,
    Math.min(
      1,
      1 -
        (fix.accuracy / maximumAccuracyMetres) * 0.3 -
        (nearest.distanceMetres / maximumSnapDistanceMetres) * 0.3,
    ),
  );
  if (confidence < 0.65) return null;
  return {
    node: nearest.node,
    source: "gps",
    confidence,
    distanceMetres: nearest.distanceMetres,
  };
}

export const positionMapMatchingService = {
  matchIndoorPositionToRouteNode,
  matchGPSPositionToRouteNode,
};
