import {
  hospitalRouteGraph,
  type HospitalRouteGraph,
  type RouteEdge,
  type RouteNode,
} from "../data/hospitalRouteGraphData";
import {
  hospitalBuildings,
  hospitalDepartments,
} from "../data/hospitalMapData";

export type GraphRoute = {
  nodes: RouteNode[];
  edges: RouteEdge[];
  distanceMetres: number;
};

export type RouteGraphValidationError = {
  message: string;
  edgeIndex?: number;
};

export function validateRouteGraph(graph: HospitalRouteGraph) {
  const errors: RouteGraphValidationError[] = [];
  const nodes = new Map<string, RouteNode>();
  const departmentNodeIds = new Set<number>();
  for (const node of graph.nodes) {
    if (nodes.has(node.id)) {
      errors.push({ message: `Duplicate route node ID: ${node.id}.` });
    }
    const building = hospitalBuildings.find(
      (item) => item.id === node.buildingId,
    );
    if (!building || !building.floors.includes(node.floor)) {
      errors.push({
        message: `Route node ${node.id} references an unknown building or floor.`,
      });
    }
    if (node.kind === "department") {
      const department = hospitalDepartments.find(
        (item) => item.id === node.departmentId,
      );
      if (
        !department ||
        department.building !== node.buildingId ||
        department.floor !== node.floor
      ) {
        errors.push({
          message: `Department route node ${node.id} does not match a configured department location.`,
        });
      }
      if (node.departmentId !== undefined && departmentNodeIds.has(node.departmentId)) {
        errors.push({
          message: `Department ${node.departmentId} has more than one route node.`,
        });
      }
      if (node.departmentId !== undefined) departmentNodeIds.add(node.departmentId);
    }
    if (
      node.mapPosition?.some(
        (coordinate) => !Number.isFinite(coordinate),
      )
    ) {
      errors.push({
        message: `Route node ${node.id} has invalid map geometry.`,
      });
    }
    if (
      node.geoPosition &&
      (!Number.isFinite(node.geoPosition.latitude) ||
        node.geoPosition.latitude < -90 ||
        node.geoPosition.latitude > 90 ||
        !Number.isFinite(node.geoPosition.longitude) ||
        node.geoPosition.longitude < -180 ||
        node.geoPosition.longitude > 180)
    ) {
      errors.push({
        message: `Route node ${node.id} has invalid geographic coordinates.`,
      });
    }
    if (Boolean(node.positioningId) !== Boolean(node.positioningSource)) {
      errors.push({
        message: `Route node ${node.id} must configure both a positioning ID and its BLE/Wi-Fi source.`,
      });
    }
    nodes.set(node.id, node);
  }

  graph.edges.forEach((edge, edgeIndex) => {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) {
      errors.push({
        edgeIndex,
        message: `Route edge ${edge.from} → ${edge.to} references an unknown node.`,
      });
    }
    if (!Number.isFinite(edge.distanceMetres) || edge.distanceMetres <= 0) {
      errors.push({
        edgeIndex,
        message: `Route edge ${edge.from} → ${edge.to} must have a positive measured distance.`,
      });
    }
    if (edge.path?.some((point) => point.some((coordinate) => !Number.isFinite(coordinate)))) {
      errors.push({
        edgeIndex,
        message: `Route edge ${edge.from} → ${edge.to} has invalid map geometry.`,
      });
    }
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (
      from &&
      to &&
      edge.kind !== "elevator" &&
      edge.kind !== "staircase" &&
      from.floor !== to.floor
    ) {
      errors.push({
        edgeIndex,
        message: `Route edge ${edge.from} → ${edge.to} changes floors without an elevator or staircase edge.`,
      });
    }
    if (
      from &&
      to &&
      edge.kind === "building-transition" &&
      from.buildingId === to.buildingId
    ) {
      errors.push({
        edgeIndex,
        message: `Building-transition edge ${edge.from} → ${edge.to} must connect different buildings.`,
      });
    }
    if (
      from &&
      to &&
      edge.kind !== "building-transition" &&
      from.buildingId !== to.buildingId
    ) {
      errors.push({
        edgeIndex,
        message: `Route edge ${edge.from} → ${edge.to} crosses buildings without a building-transition edge.`,
      });
    }
    if (
      from &&
      to &&
      edge.kind === "elevator" &&
      (from.floor === to.floor ||
        from.kind !== "elevator" ||
        to.kind !== "elevator")
    ) {
      errors.push({
        edgeIndex,
        message: `Elevator edge ${edge.from} → ${edge.to} must join elevator nodes on different floors.`,
      });
    }
    if (
      from &&
      to &&
      edge.kind === "staircase" &&
      (from.floor === to.floor ||
        from.kind !== "staircase" ||
        to.kind !== "staircase")
    ) {
      errors.push({
        edgeIndex,
        message: `Staircase edge ${edge.from} → ${edge.to} must join staircase nodes on different floors.`,
      });
    }
    if (
      from &&
      to &&
      edge.kind === "building-transition" &&
      from.floor !== to.floor
    ) {
      errors.push({
        edgeIndex,
        message: `Building-transition edge ${edge.from} → ${edge.to} must use matched floor levels.`,
      });
    }
  });
  return errors;
}

export function assertValidRouteGraph(graph: HospitalRouteGraph) {
  const errors = validateRouteGraph(graph);
  if (errors.length > 0) {
    throw new Error(
      `The configured indoor route graph is invalid: ${errors
        .map((error) => error.message)
        .join(" ")}`,
    );
  }
}

export function findGraphRoute(
  startNodeId: string,
  destinationNodeId: string,
  graph: HospitalRouteGraph = hospitalRouteGraph,
  accessibleOnly = false,
): GraphRoute | null {
  assertValidRouteGraph(graph);
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  if (!nodeById.has(startNodeId) || !nodeById.has(destinationNodeId)) return null;

  const distances = new Map(graph.nodes.map((node) => [node.id, Infinity]));
  const previous = new Map<string, { nodeId: string; edge: RouteEdge }>();
  const remaining = new Set(nodeById.keys());
  distances.set(startNodeId, 0);

  while (remaining.size > 0) {
    let currentId: string | null = null;
    for (const nodeId of remaining) {
      if (
        currentId === null ||
        (distances.get(nodeId) ?? Infinity) < (distances.get(currentId) ?? Infinity)
      ) {
        currentId = nodeId;
      }
    }
    if (currentId === null || distances.get(currentId) === Infinity) break;
    if (currentId === destinationNodeId) break;
    remaining.delete(currentId);

    graph.edges.forEach((edge) => {
      if (accessibleOnly && !edge.accessible) return;
      const neighborId =
        edge.from === currentId
          ? edge.to
          : edge.to === currentId && edge.bidirectional
            ? edge.from
            : null;
      if (!neighborId || !remaining.has(neighborId)) return;
      const nextDistance =
        (distances.get(currentId) ?? Infinity) + edge.distanceMetres;
      if (nextDistance < (distances.get(neighborId) ?? Infinity)) {
        distances.set(neighborId, nextDistance);
        previous.set(neighborId, { nodeId: currentId, edge });
      }
    });
  }

  const distanceMetres = distances.get(destinationNodeId) ?? Infinity;
  if (!Number.isFinite(distanceMetres)) return null;
  const nodes: RouteNode[] = [];
  const edges: RouteEdge[] = [];
  let currentId = destinationNodeId;
  while (currentId !== startNodeId) {
    const currentNode = nodeById.get(currentId);
    const step = previous.get(currentId);
    if (!currentNode || !step) return null;
    nodes.unshift(currentNode);
    edges.unshift(step.edge);
    currentId = step.nodeId;
  }
  const start = nodeById.get(startNodeId);
  if (!start) return null;
  nodes.unshift(start);
  return { nodes, edges, distanceMetres };
}

export function findNearestRouteToNodeKind(
  startNodeId: string,
  kind: RouteNode["kind"],
  graph: HospitalRouteGraph = hospitalRouteGraph,
  accessibleOnly = false,
) {
  const destinations = graph.nodes.filter((node) => node.kind === kind);
  let nearest: { node: RouteNode; route: GraphRoute } | null = null;
  for (const node of destinations) {
    const route = findGraphRoute(startNodeId, node.id, graph, accessibleOnly);
    if (route && (!nearest || route.distanceMetres < nearest.route.distanceMetres)) {
      nearest = { node, route };
    }
  }
  return nearest;
}

export function getConfiguredRouteGraph(graph = hospitalRouteGraph) {
  return graph;
}
