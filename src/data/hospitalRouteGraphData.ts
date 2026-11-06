export type RouteNodeKind =
  | "corridor"
  | "junction"
  | "entrance"
  | "elevator"
  | "staircase"
  | "department";

export type RouteNode = {
  id: string;
  kind: RouteNodeKind;
  buildingId: string;
  floor: string;
  label: string;
  departmentId?: number;
  positioningId?: string;
  positioningSource?: "ble" | "wifi";
  mapPosition?: [number, number, number];
  geoPosition?: { latitude: number; longitude: number };
};

export type RouteEdgeKind =
  | "corridor"
  | "elevator"
  | "staircase"
  | "building-transition";

export type RouteEdge = {
  from: string;
  to: string;
  distanceMetres: number;
  kind: RouteEdgeKind;
  accessible: boolean;
  bidirectional: boolean;
  label?: string;
  path?: [number, number, number][];
};

export type HospitalRouteGraph = {
  nodes: RouteNode[];
  edges: RouteEdge[];
};

// Populate only from surveyed, approved hospital wayfinding data. Empty by
// default: the sample 3D floor layout does not describe walkable connectivity.
export const hospitalRouteGraph: HospitalRouteGraph = {
  nodes: [],
  edges: [],
};
