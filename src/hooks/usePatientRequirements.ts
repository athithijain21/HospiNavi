import { useCallback, useMemo, useState } from "react";
import type { HospitalDepartment } from "../data/hospitalMapData";
import { aiNavigationAssistant, planNavigationStops } from "../services/aiNavigationAssistant";
import type { RequirementAnalysis } from "../services/patientRequirementService";
import { hospitalRouteGraph, type HospitalRouteGraph } from "../data/hospitalRouteGraphData";
import { useLanguage } from "./useLanguage";

type Props = {
  departments: HospitalDepartment[];
  startBuilding: string;
  startFloor: string;
  startNodeId: string;
  accessibleOnly: boolean;
  graph?: HospitalRouteGraph;
};

export function usePatientRequirements({
  departments,
  startBuilding,
  startFloor,
  startNodeId,
  accessibleOnly,
  graph = hospitalRouteGraph,
}: Props) {
  const { language } = useLanguage();
  const [input, setInput] = useState("");
  const [analysis, setAnalysis] = useState<RequirementAnalysis | null>(null);
  const [visitSequence, setVisitSequence] = useState<HospitalDepartment[]>([]);
  const [journeyStops, setJourneyStops] = useState<HospitalDepartment[]>([]);
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [journeyIndex, setJourneyIndex] = useState(-1);
  const [journeyActive, setJourneyActive] = useState(false);

  const planSequence = useCallback(
    (departmentIds: number[]) =>
      planNavigationStops(departmentIds, departments, {
        buildingId: startBuilding,
        floor: startFloor,
        nodeId: startNodeId || undefined,
        accessibleOnly,
      }, graph),
    [accessibleOnly, departments, graph, startBuilding, startFloor, startNodeId],
  );
  const sequencePlan = useMemo(
    () => planSequence(visitSequence.map((department) => department.id)),
    [planSequence, visitSequence],
  );
  const orderedVisitSequence = sequencePlan.routeable
    ? sequencePlan.departments
    : visitSequence;
  const routeAvailable =
    orderedVisitSequence.length > 0 && sequencePlan.routeable;
  const routeReadinessReasons =
    sequencePlan.reasons.length > 0
      ? sequencePlan.reasons
      : routeAvailable
        ? ["A connected route is available for every selected destination."]
        : ["Select at least one configured destination."];

  const analyze = useCallback(
    async (requirement = input) => {
      setInput(requirement);
      setError("");
      setIsAnalyzing(true);
      setJourneyActive(false);
      setJourneyIndex(-1);
      setJourneyStops([]);
      try {
        const result = await aiNavigationAssistant.understand(
          requirement,
          departments,
          {
            buildingId: startBuilding,
            floor: startFloor,
            nodeId: startNodeId || undefined,
            accessibleOnly,
          },
          graph,
          language,
        );
        setAnalysis(result.analysis);
        setVisitSequence(result.sequence.departments);
        if (result.sequence.error) setError(result.sequence.error);
      } catch (analysisError) {
        setError(
          analysisError instanceof Error
            ? analysisError.message
            : "Unable to analyze this requirement.",
        );
      } finally {
        setIsAnalyzing(false);
      }
    },
    [
      accessibleOnly,
      departments,
      graph,
      input,
      language,
      startBuilding,
      startFloor,
      startNodeId,
    ],
  );

  const removeDestination = useCallback(
    (departmentId: number) => {
      const ids = visitSequence
        .filter((department) => department.id !== departmentId)
        .map((department) => department.id);
      const sequence = planSequence(ids);
      setVisitSequence(sequence.departments);
      setError(sequence.error ?? "");
      setAnalysis((current) =>
        current
          ? {
              ...current,
              plan: {
                ...current.plan,
                departmentIds: current.plan.departmentIds.filter(
                  (id) => id !== departmentId,
                ),
              },
            }
          : current,
      );
      setJourneyActive(false);
      setJourneyIndex(-1);
      setJourneyStops([]);
    },
    [planSequence, visitSequence],
  );

  const addDestination = useCallback(
    (departmentId: number) => {
      const currentIds = visitSequence.map((department) => department.id);
      if (currentIds.includes(departmentId)) return;
      const sequence = planSequence([...currentIds, departmentId]);
      setVisitSequence(sequence.departments);
      setError(sequence.error ?? "");
      setAnalysis((current) =>
        current
          ? {
              ...current,
              plan: {
                ...current.plan,
                departmentIds: sequence.departments.map(
                  (department) => department.id,
                ),
              },
            }
          : current,
      );
      setJourneyActive(false);
      setJourneyIndex(-1);
      setJourneyStops([]);
    },
    [planSequence, visitSequence],
  );

  const startJourney = useCallback(() => {
    if (!routeAvailable || orderedVisitSequence.length === 0) return null;
    setJourneyStops(orderedVisitSequence);
    setJourneyIndex(0);
    setJourneyActive(true);
    return orderedVisitSequence[0];
  }, [orderedVisitSequence, routeAvailable]);

  const advanceJourney = useCallback(() => {
    const nextIndex = journeyIndex + 1;
    if (nextIndex >= journeyStops.length) {
      setJourneyActive(false);
      setJourneyIndex(-1);
      return null;
    }
    setJourneyIndex(nextIndex);
    return journeyStops[nextIndex];
  }, [journeyIndex, journeyStops]);

  const stopJourney = useCallback(() => {
    setJourneyActive(false);
    setJourneyIndex(-1);
    setJourneyStops([]);
  }, []);

  return {
    input,
    setInput,
    analysis,
    visitSequence: orderedVisitSequence,
    journeyStops,
    routeAvailable,
    routeReadinessReasons,
    error,
    isAnalyzing,
    journeyIndex,
    journeyActive,
    analyze,
    removeDestination,
    addDestination,
    startJourney,
    advanceJourney,
    stopJourney,
    isAIConfigured: aiNavigationAssistant.isAIConfigured,
  };
}
