import type { HospitalDepartment } from "../data/hospitalMapData";
import {
  getRouteReadiness,
  optimizeVisitSequence,
} from "./hospitalRouteService";
import { patientRequirementService } from "./patientRequirementService";
import { getWorkflowPlan } from "./hospitalWorkflowService";
import { hospitalRouteGraph, type HospitalRouteGraph } from "../data/hospitalRouteGraphData";

export type NavigationOrigin = {
  buildingId: string;
  floor: string;
  nodeId?: string;
  accessibleOnly?: boolean;
};
export type AssistantLanguage = "en" | "kn";

export function planNavigationStops(
  departmentIds: number[],
  departments: HospitalDepartment[],
  origin: NavigationOrigin,
  graph: HospitalRouteGraph = hospitalRouteGraph,
) {
  const fallbackStops = departmentIds
    .map((id) => departments.find((department) => department.id === id))
    .filter((department): department is HospitalDepartment => Boolean(department));
  try {
    const workflowPlan = getWorkflowPlan(departmentIds, departments);
    const suggestedStops = workflowPlan.departmentIds
      .map((id) => departments.find((department) => department.id === id))
      .filter((department): department is HospitalDepartment => Boolean(department));
    const optimized = optimizeVisitSequence(
      departmentIds,
      origin.buildingId,
      origin.floor,
      departments,
      undefined,
      origin.nodeId,
      graph,
      origin.accessibleOnly,
    );
    const routeable =
      optimized.unrouteableIds.length === 0 &&
      optimized.departments.length === suggestedStops.length;
    const reasons = optimized.unrouteableReasons.flatMap((result) =>
      result.reasons.map((reason) => {
        const department = departments.find(
          (item) => item.id === result.departmentId,
        );
        return department ? `${department.name}: ${reason}` : reason;
      }),
    );
    if (departmentIds.length === 0) {
      reasons.push("Select at least one configured destination.");
    }
    if (departmentIds.length > 0 && optimized.unrouteableIds.length === 0 && !routeable) {
      const firstDestination = suggestedStops[0];
      if (firstDestination) {
        const readiness = getRouteReadiness(
          origin.buildingId,
          origin.floor,
          firstDestination.id,
          origin.nodeId,
          graph,
          origin.accessibleOnly,
        );
        reasons.push(...readiness.reasons);
      }
    }
    return {
      departments: routeable ? optimized.departments : suggestedStops,
      routeable,
      unrouteableIds: optimized.unrouteableIds,
      reasons: [...new Set(reasons)],
      error: null,
    };
  } catch (planningError) {
    return {
      departments: fallbackStops,
      routeable: false,
      unrouteableIds: departmentIds,
      reasons: [...new Set([
        planningError instanceof Error
          ? planningError.message
          : "Unable to validate the configured indoor route graph.",
      ])],
      error:
        planningError instanceof Error
          ? planningError.message
          : "Unable to validate the configured indoor route graph.",
    };
  }
}

export const aiNavigationAssistant = {
  isAIConfigured: patientRequirementService.isAIConfigured,

  async understand(
    input: string,
    departments: HospitalDepartment[],
    origin: NavigationOrigin,
    graph: HospitalRouteGraph = hospitalRouteGraph,
    language: AssistantLanguage = "en",
  ) {
      const analysis = await patientRequirementService.analyze(input, departments, language);
    return {
      analysis,
      sequence: planNavigationStops(
        analysis.plan.departmentIds,
        departments,
        origin,
        graph,
      ),
    };
  },
};
