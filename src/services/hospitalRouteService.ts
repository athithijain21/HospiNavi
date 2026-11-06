import {
  hospitalDepartments,
  type HospitalDepartment,
} from "../data/hospitalMapData";
import {
  hospitalRouteGraph,
  type HospitalRouteGraph,
  type RouteNode,
} from "../data/hospitalRouteGraphData";
import {
  assertValidRouteGraph,
  findNearestRouteToNodeKind,
  findGraphRoute,
  validateRouteGraph,
  type GraphRoute,
} from "./routeGraphService";
import { generateRouteInstructions } from "./routeInstructionService";
import {
  getWorkflowPlan,
  type HospitalWorkflow,
} from "./hospitalWorkflowService";

export type IndoorRoute = GraphRoute & {
  startNodeId: string;
  destinationNodeId: string;
  nodeIds: string[];
  floorSegments: {
    buildingId: string;
    floor: string;
    nodeIds: string[];
  }[];
  transitions: {
    kind: "elevator" | "staircase" | "building-transition";
    fromNodeId: string;
    toNodeId: string;
  }[];
  source: "surveyed" | "demo";
  status: "ready";
  instructions: string[];
  distance: number;
};

export type RouteReadiness = {
  available: boolean;
  reasons: string[];
  route: IndoorRoute | null;
};

export function getIndoorRouteMapError(
  route: GraphRoute,
  graph: HospitalRouteGraph,
): string | null {
  if (route.nodes.length === 0 || route.edges.length !== route.nodes.length - 1) {
    return "The route cannot be displayed because its ordered nodes and connections do not form a complete path.";
  }

  for (const [index, node] of route.nodes.entries()) {
    if (
      !node.mapPosition ||
      node.mapPosition.some((coordinate) => !Number.isFinite(coordinate))
    ) {
      return `The route cannot be displayed because ${node.label} has no valid surveyed map coordinates.`;
    }
    const graphNode = graph.nodes.find((candidate) => candidate.id === node.id);
    if (
      !graphNode ||
      graphNode.buildingId !== node.buildingId ||
      graphNode.floor !== node.floor
    ) {
      return `The route cannot be displayed because node ${node.id} does not match the configured building and floor.`;
    }
    if (index === 0) continue;

    const previous = route.nodes[index - 1];
    const edge = route.edges[index - 1];
    const connected =
      (edge.from === previous.id && edge.to === node.id) ||
      (edge.bidirectional && edge.from === node.id && edge.to === previous.id);
    if (!connected || !graph.edges.includes(edge)) {
      return `The route cannot be displayed because ${previous.label} and ${node.label} are not joined by a configured route edge.`;
    }

    if (edge.kind === "corridor") {
      if (!edge.path || edge.path.length < 2) {
        return `The route cannot be displayed because the corridor connection from ${previous.label} to ${node.label} has no surveyed path geometry.`;
      }
      if (
        edge.path.some((point) =>
          point.some((coordinate) => !Number.isFinite(coordinate)),
        )
      ) {
        return `The corridor connection from ${previous.label} to ${node.label} has invalid map coordinates.`;
      }
      const path = edge.from === previous.id ? edge.path : [...edge.path].reverse();
      const firstPoint = path[0];
      const lastPoint = path.at(-1);
      const previousPosition = previous.mapPosition;
      const nodePosition = node.mapPosition;
      if (
        !firstPoint ||
        !lastPoint ||
        !previousPosition ||
        !nodePosition ||
        Math.hypot(
          previousPosition[0] - firstPoint[0],
          previousPosition[2] - firstPoint[2],
        ) > 0.05 ||
        Math.hypot(
          nodePosition[0] - lastPoint[0],
          nodePosition[2] - lastPoint[2],
        ) > 0.05
      ) {
        return `The corridor path from ${previous.label} to ${node.label} does not meet its configured map nodes.`;
      }
    }
  }
  return null;
}

function createIndoorRoute(route: GraphRoute, graph: HospitalRouteGraph): IndoorRoute {
  const mapError = getIndoorRouteMapError(route, graph);
  if (mapError) throw new Error(mapError);

  const floorSegments: IndoorRoute["floorSegments"] = [];
  for (const node of route.nodes) {
    const current = floorSegments.at(-1);
    if (current?.buildingId === node.buildingId && current.floor === node.floor) {
      current.nodeIds.push(node.id);
    } else {
      floorSegments.push({
        buildingId: node.buildingId,
        floor: node.floor,
        nodeIds: [node.id],
      });
    }
  }
  const transitions: IndoorRoute["transitions"] = route.edges.flatMap(
    (edge, index) =>
      edge.kind === "corridor"
        ? []
        : [{
            kind: edge.kind,
            fromNodeId: route.nodes[index]?.id ?? edge.from,
            toNodeId: route.nodes[index + 1]?.id ?? edge.to,
          }],
  );

  return {
    ...route,
    startNodeId: route.nodes[0].id,
    destinationNodeId: route.nodes.at(-1)!.id,
    nodeIds: route.nodes.map((node) => node.id),
    floorSegments,
    transitions,
    source: route.edges.some((edge) => edge.label?.startsWith("SAMPLE-ONLY"))
      ? "demo"
      : "surveyed",
    status: "ready",
    instructions: generateRouteInstructions(route),
    distance: route.distanceMetres,
  };
}

function routeToDepartment(
  startNodeId: string,
  departmentId: number,
  graph: HospitalRouteGraph,
  accessibleOnly = false,
): IndoorRoute | null {
  const destination = graph.nodes.find(
    (node) => node.kind === "department" && node.departmentId === departmentId,
  );
  if (!destination) return null;
  const route = findGraphRoute(startNodeId, destination.id, graph, accessibleOnly);
  return route ? createIndoorRoute(route, graph) : null;
}

export function getConfiguredRouteStartNodes(
  graph: HospitalRouteGraph = hospitalRouteGraph,
): RouteNode[] {
  return graph.nodes;
}

export function getRouteReadiness(
  startBuilding: string,
  startFloor: string,
  destinationId: number,
  startNodeId?: string,
  graph: HospitalRouteGraph = hospitalRouteGraph,
  accessibleOnly = false,
): RouteReadiness {
  const destination = hospitalDepartments.find(
    (department) => department.id === destinationId,
  );
  if (!destination) {
    return {
      available: false,
      reasons: ["The selected destination is not in the configured hospital directory."],
      route: null,
    };
  }

  const errors = validateRouteGraph(graph);
  if (errors.length > 0) {
    return {
      available: false,
      reasons: [
        `The configured route graph is invalid: ${errors[0].message}`,
      ],
      route: null,
    };
  }

  const reasons: string[] = [];
  if (!startNodeId) {
    reasons.push(
      "Confirm a precise starting point. Building and floor selection alone does not establish a route origin.",
    );
  } else {
    const start = graph.nodes.find((node) => node.id === startNodeId);
    if (!start) {
      reasons.push("The confirmed starting point is not a configured route node.");
    } else if (
      start.buildingId !== startBuilding ||
      start.floor !== startFloor
    ) {
      reasons.push(
        "The confirmed starting point does not match the selected building and floor.",
      );
    }
  }

  if (graph.nodes.length === 0 || graph.edges.length === 0) {
    reasons.push(
      "No surveyed indoor route connections are configured. Add verified corridors and transitions before starting a journey.",
    );
    return { available: false, reasons, route: null };
  }

  if (
    !graph.nodes.some(
      (node) => node.kind === "department" && node.departmentId === destinationId,
    )
  ) {
    reasons.push(
      `No surveyed route node is linked to ${destination.name}, Room ${destination.room}.`,
    );
    return { available: false, reasons, route: null };
  }
  if (!startNodeId || reasons.length > 0) {
    return { available: false, reasons, route: null };
  }

  try {
    const route = routeToDepartment(
      startNodeId,
      destinationId,
      graph,
      accessibleOnly,
    );
    if (route) return { available: true, reasons: [], route };
  } catch (routeError) {
    reasons.push(
      routeError instanceof Error
        ? routeError.message
        : "The calculated route is missing valid map geometry.",
    );
    return { available: false, reasons, route: null };
  }

  if (
    accessibleOnly &&
    findGraphRoute(
      startNodeId,
      graph.nodes.find(
        (node) => node.kind === "department" && node.departmentId === destinationId,
      )?.id ?? "",
      graph,
    )
  ) {
    reasons.push(
      "A connected route exists, but no route using only connections marked accessible is available.",
    );
  } else {
    reasons.push(
      `No connected walkable route exists from the confirmed starting point to ${destination.name}.`,
    );
  }
  return { available: false, reasons, route: null };
}

export function findShortestRoute(
  startBuilding: string,
  startFloor: string,
  destinationId: number,
  startNodeId?: string,
  graph: HospitalRouteGraph = hospitalRouteGraph,
  accessibleOnly = false,
) {
  assertValidRouteGraph(graph);
  return getRouteReadiness(
    startBuilding,
    startFloor,
    destinationId,
    startNodeId,
    graph,
    accessibleOnly,
  ).route;
}

export function findNearestLiftRoute(
  startNodeId: string,
  accessibleOnly = false,
  graph: HospitalRouteGraph = hospitalRouteGraph,
) {
  assertValidRouteGraph(graph);
  const nearest = findNearestRouteToNodeKind(
    startNodeId,
    "elevator",
    graph,
    accessibleOnly,
  );
  if (!nearest) return null;
  const route = createIndoorRoute(nearest.route, graph);
  return { node: nearest.node, route };
}

export function findRouteToNode(
  startNodeId: string,
  destinationNodeId: string,
  accessibleOnly = false,
  graph: HospitalRouteGraph = hospitalRouteGraph,
) {
  assertValidRouteGraph(graph);
  const graphRoute = findGraphRoute(
    startNodeId,
    destinationNodeId,
    graph,
    accessibleOnly,
  );
  if (!graphRoute) return null;
  return createIndoorRoute(graphRoute, graph);
}

export function findRouteToFloorViaLift(
  startNodeId: string,
  floor: string,
  accessibleOnly = false,
  graph: HospitalRouteGraph = hospitalRouteGraph,
) {
  assertValidRouteGraph(graph);
  const destinations = graph.nodes.filter(
    (node) => node.kind === "elevator" && node.floor === floor,
  );
  let nearest: { node: RouteNode; route: GraphRoute } | null = null;
  for (const node of destinations) {
    const route = findGraphRoute(startNodeId, node.id, graph, accessibleOnly);
    if (route && (!nearest || route.distanceMetres < nearest.route.distanceMetres)) {
      nearest = { node, route };
    }
  }
  if (!nearest) return null;
  const route = createIndoorRoute(nearest.route, graph);
  return { node: nearest.node, route };
}

export function optimizeVisitSequence(
  departmentIds: number[],
  startBuilding: string,
  startFloor: string,
  departments: HospitalDepartment[] = hospitalDepartments,
  workflows?: HospitalWorkflow[],
  startNodeId?: string,
  graph: HospitalRouteGraph = hospitalRouteGraph,
  accessibleOnly = false,
) {
  assertValidRouteGraph(graph);
  const workflowPlan = getWorkflowPlan(departmentIds, departments, workflows);
  const pending = new Set(workflowPlan.departmentIds);
  const visited: HospitalDepartment[] = [];
  const segments: { department: HospitalDepartment; distance: number; route: IndoorRoute }[] = [];
  const visitedIds = new Set<number>();
  const start = graph.nodes.find((node) => node.id === startNodeId);
  let currentNodeId =
    start?.buildingId === startBuilding && start.floor === startFloor
      ? start.id
      : null;

  while (pending.size > 0 && currentNodeId) {
    const next = [...pending]
      .filter((id) =>
        [...(workflowPlan.dependencies.get(id) ?? [])].every((dependency) =>
          visitedIds.has(dependency),
        ),
      )
      .map((id) => {
        const department = departments.find((item) => item.id === id);
        const currentNode = graph.nodes.find((node) => node.id === currentNodeId);
        const readiness = getRouteReadiness(
          currentNode?.buildingId ?? startBuilding,
          currentNode?.floor ?? startFloor,
          id,
          currentNodeId ?? undefined,
          graph,
          accessibleOnly,
        );
        const route = readiness.route;
        return department && route ? { department, route } : null;
      })
      .filter(
        (candidate): candidate is { department: HospitalDepartment; route: IndoorRoute } =>
          candidate !== null,
      )
      .sort((a, b) => a.route.distance - b.route.distance)[0];
    if (!next) break;
    visited.push(next.department);
    segments.push({
      department: next.department,
      distance: next.route.distance,
      route: next.route,
    });
    pending.delete(next.department.id);
    visitedIds.add(next.department.id);
    currentNodeId = next.route.nodes.at(-1)?.id ?? null;
  }

  const currentNode = graph.nodes.find((node) => node.id === currentNodeId);
  const unrouteableReasons = [...pending].map((id) => {
    const readiness = getRouteReadiness(
      currentNode?.buildingId ?? startBuilding,
      currentNode?.floor ?? startFloor,
      id,
      currentNode?.id,
      graph,
      accessibleOnly,
    );
    return { departmentId: id, reasons: readiness.reasons };
  });
  return {
    departments: visited,
    segments,
    unrouteableIds: [...pending],
    unrouteableReasons,
  };
}
