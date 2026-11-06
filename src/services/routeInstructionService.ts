import type { GraphRoute } from "./routeGraphService";

function planarTurn(
  previous: [number, number, number],
  current: [number, number, number],
  next: [number, number, number],
) {
  const incomingX = current[0] - previous[0];
  const incomingZ = current[2] - previous[2];
  const outgoingX = next[0] - current[0];
  const outgoingZ = next[2] - current[2];
  const cross = incomingX * outgoingZ - incomingZ * outgoingX;
  const dot = incomingX * outgoingX + incomingZ * outgoingZ;
  if (Math.hypot(incomingX, incomingZ) === 0 || Math.hypot(outgoingX, outgoingZ) === 0) {
    return null;
  }
  if (Math.abs(cross) < 1e-6 && dot > 0) return "Continue straight";
  if (Math.abs(cross) < 1e-6) return "Turn around";
  return cross < 0 ? "Turn left" : "Turn right";
}

export function generateRouteInstructions(route: GraphRoute) {
  const instructions: string[] = [];
  const isSampleRoute = route.edges.some((edge) =>
    edge.label?.startsWith("SAMPLE-ONLY"),
  );
  route.edges.forEach((edge, index) => {
    const from = route.nodes[index];
    const to = route.nodes[index + 1];
    if (!from || !to) return;
    const label = edge.label ? ` via ${edge.label}` : "";
    const reversed = edge.from !== from.id;
    if (edge.kind === "elevator") {
      instructions.push(
        `${isSampleRoute ? "SAMPLE ROUTE: Take the simulated elevator" : "Take the elevator"} from ${from.floor} to ${to.floor} in building ${to.buildingId}${label}.`,
      );
      return;
    }
    if (edge.kind === "staircase") {
      instructions.push(
        `${isSampleRoute ? "SAMPLE ROUTE: Use the simulated stairs" : "Use the stairs"} from ${from.floor} to ${to.floor} in building ${to.buildingId}${label}.`,
      );
      return;
    }
    if (edge.kind === "building-transition") {
      instructions.push(
        `${isSampleRoute ? "SAMPLE ROUTE: Follow the simulated campus connection" : "Follow the configured building connection"} from ${from.buildingId} to ${to.buildingId}${label}.`,
      );
      return;
    }
    if (isSampleRoute) {
      instructions.push(
        `SAMPLE ROUTE: Follow the illustrative map path from ${from.label} to ${to.label}${label}.`,
      );
      return;
    }

    const storedGeometry = edge.path;
    const geometry = storedGeometry
      ? reversed
        ? [...storedGeometry].reverse()
        : storedGeometry
      : undefined;
    const start = from.mapPosition ?? geometry?.[0];
    const end = to.mapPosition ?? geometry?.[geometry.length - 1];
    if (start && end) {
      const points = [start, ...(geometry?.slice(1, -1) ?? []), end];
      const turns: string[] = [];
      const previousNode = route.nodes[index - 1];
      const previousEdge = route.edges[index - 1];
      if (
        previousNode?.mapPosition &&
        previousEdge?.kind === "corridor" &&
        previousNode.buildingId === from.buildingId &&
        previousNode.floor === from.floor
      ) {
        const turn = planarTurn(previousNode.mapPosition, start, points[1]);
        if (turn) turns.push(turn.toLowerCase());
      }
      for (let pointIndex = 1; pointIndex < points.length - 1; pointIndex += 1) {
        const turn = planarTurn(
          points[pointIndex - 1],
          points[pointIndex],
          points[pointIndex + 1],
        );
        if (turn) turns.push(turn.toLowerCase());
      }
      instructions.push(
        geometry && geometry.length >= 3
          ? turns.length > 0
            ? `${turns.join(" and ")} along the surveyed corridor${label}.`
            : `Continue along the surveyed corridor${label}.`
          : turns.length > 0
            ? `${turns.join(" and ")} into the configured corridor connection${label}.`
            : `Follow the configured corridor connection from ${from.label} to ${to.label}${label}.`,
      );
      return;
    }
    instructions.push(
      `Follow the configured corridor connection from ${from.label} to ${to.label}${label}.`,
    );
  });

  const destination = route.nodes.at(-1);
  if (destination) {
    instructions.push(
      `${isSampleRoute ? "SAMPLE ROUTE: Simulated destination reached" : "You have arrived at"} ${destination.label}.`,
    );
  }
  return instructions;
}
