import { useMemo } from "react";
import type { HospitalDepartment } from "../data/hospitalMapData";
import { getRouteReadiness } from "../services/hospitalRouteService";
import { hospitalRouteGraph, type HospitalRouteGraph } from "../data/hospitalRouteGraphData";

type Props = {
  startBuilding: string;
  startFloor: string;
  startNodeId: string;
  accessibleOnly: boolean;
  destination: HospitalDepartment | null;
  graph?: HospitalRouteGraph;
};

export function useIndoorNavigation({
  startBuilding,
  startFloor,
  startNodeId,
  accessibleOnly,
  destination,
  graph = hospitalRouteGraph,
}: Props) {
  const route = useMemo(
    () => {
      try {
        return {
          route: destination
            ? getRouteReadiness(
                startBuilding,
                startFloor,
                destination.id,
                startNodeId || undefined,
                graph,
                accessibleOnly,
              )
            : null,
          error: null,
        };
      } catch (routeError) {
        return {
          route: null,
          error:
            routeError instanceof Error
              ? routeError.message
              : "Unable to validate the configured indoor route graph.",
        };
      }
    },
    [accessibleOnly, destination, graph, startBuilding, startFloor, startNodeId],
  );
  return {
    route: route.route?.route ?? null,
    error: route.route?.reasons.join(" ") ?? route.error,
    readiness: route.route,
  };
}
