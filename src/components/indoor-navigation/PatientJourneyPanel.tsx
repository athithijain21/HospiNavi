import { useEffect, useMemo, useRef, useState } from "react";
import type { HospitalDepartment } from "../../data/hospitalMapData";
import type { IndoorPositionEstimate } from "../../services/indoorPositioningService";
import type { IndoorRoute } from "../../services/hospitalRouteService";
import type { HospitalRouteGraph, RouteNode } from "../../data/hospitalRouteGraphData";
import { hospitalRouteGraph } from "../../data/hospitalRouteGraphData";
import { hospitalWorkflows } from "../../services/hospitalWorkflowService";
import { usePatientRequirements } from "../../hooks/usePatientRequirements";
import { useVoiceNavigation } from "../../hooks/useVoiceNavigation";
import { useLanguage } from "../../hooks/useLanguage";
import { translateNavigationText } from "../../services/translationService";
import {
  findNearestLiftRoute,
  findRouteToFloorViaLift,
  findShortestRoute,
} from "../../services/hospitalRouteService";

type Props = {
  departments: HospitalDepartment[];
  startBuilding: string;
  startFloor: string;
  startNodeId: string;
  accessibleOnly: boolean;
  currentPosition: IndoorPositionEstimate | null;
  destination: HospitalDepartment | null;
  route: IndoorRoute | null;
  routeGraph?: HospitalRouteGraph;
  demoRouteStartNodes?: RouteNode[];
  demoRouteStartNodeId?: string;
  isDemoRouteMode?: boolean;
  onEnableDemoRouteMode?: () => void;
  onDisableDemoRouteMode?: () => void;
  onChangeDemoRouteStart?: (nodeId: string) => void;
  specialRouteTarget: string | null;
  onSelectDestination: (
    department: HospitalDepartment,
    start?: { building: string; floor: string; nodeId?: string },
  ) => void;
  onSelectSpecialRoute: (
    route: IndoorRoute,
    targetLabel: string,
    targetNodeId: string,
  ) => void;
  onStopNavigation: () => void;
};

const voiceStatusLabels = {
  idle: "Voice ready",
  listening: "Listening…",
  processing: "Processing…",
  speaking: "Speaking directions…",
  paused: "Voice guidance paused",
  unsupported: "Voice recognition unsupported · text input available",
  error: "Voice error",
};

export default function PatientJourneyPanel({
  departments,
  startBuilding,
  startFloor,
  startNodeId,
  accessibleOnly,
  currentPosition,
  destination,
  route,
  routeGraph = hospitalRouteGraph,
  demoRouteStartNodes = [],
  demoRouteStartNodeId = "",
  isDemoRouteMode = false,
  onEnableDemoRouteMode,
  onDisableDemoRouteMode,
  onChangeDemoRouteStart,
  specialRouteTarget,
  onSelectDestination,
  onSelectSpecialRoute,
  onStopNavigation,
}: Props) {
  const { language, setLanguage, t } = useLanguage();
  const [voiceDestinationId, setVoiceDestinationId] = useState<number | null>(null);
  const [additionalDestinationId, setAdditionalDestinationId] = useState("");
  const [navigationActive, setNavigationActive] = useState(false);
  const [voiceClarification, setVoiceClarification] = useState("");
  const voiceLanguage = language === "kn" ? "kn-IN" : "en-IN";
  const lastAnnouncedPosition = useRef("");
  const pendingFloorAnnouncement = useRef("");
  const lastSpokenInstruction = useRef("");
  const pauseVoiceGuidance = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
    }
  };
  const resumeVoiceGuidance = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
    }
  };
  const requirements = usePatientRequirements({
    departments,
    startBuilding,
    startFloor,
    startNodeId,
    accessibleOnly,
    graph: routeGraph,
  });
  const voice = useVoiceNavigation({
    departments,
    onNavigate: (department) => {
      requirements.stopJourney();
      setVoiceDestinationId(department.id);
      const hasRoute =
        findShortestRoute(
          startBuilding,
          startFloor,
          department.id,
          startNodeId || undefined,
          routeGraph,
          accessibleOnly,
        ) !== null;
      onSelectDestination(
        department,
        startNodeId
          ? { building: startBuilding, floor: startFloor, nodeId: startNodeId }
          : undefined,
      );
      setNavigationActive(hasRoute);
      return hasRoute;
    },
    onRequirement: (text) => requirements.analyze(text),
    onStopNavigation: () => {
      requirements.stopJourney();
      setVoiceDestinationId(null);
      setNavigationActive(false);
      onStopNavigation();
    },
    onPauseNavigation: pauseVoiceGuidance,
    onResumeNavigation: resumeVoiceGuidance,
    getPosition: () =>
      currentPosition
        ? {
            buildingId: currentPosition.buildingId,
            floor: currentPosition.floor,
            source: currentPosition.source,
          }
        : null,
    getDirections: () => route?.instructions ?? [],
    getNearestLiftDirections: () => {
      if (!startNodeId) return [];
      return findNearestLiftRoute(startNodeId, accessibleOnly, routeGraph)?.route.instructions ?? [];
    },
    getNearestLiftRoute: () => {
      if (!startNodeId) return null;
      const nearest = findNearestLiftRoute(startNodeId, accessibleOnly, routeGraph);
      return nearest
        ? { route: nearest.route, targetLabel: nearest.node.label }
        : null;
    },
    getFloorRoute: (targetFloor) => {
      if (!startNodeId) return null;
      const target = findRouteToFloorViaLift(
        startNodeId,
        targetFloor,
        accessibleOnly,
        routeGraph,
      );
      return target
        ? { route: target.route, targetLabel: target.node.label }
        : null;
    },
    onSelectRoute: (selectedRoute, targetLabel, targetNodeId) => {
      setVoiceDestinationId(null);
      setNavigationActive(true);
      onSelectSpecialRoute(selectedRoute, targetLabel, targetNodeId);
    },
    onClarification: setVoiceClarification,
    onRecognizedText: requirements.setInput,
    language: voiceLanguage,
  });
  const activeStop =
    requirements.journeyActive && requirements.journeyIndex >= 0
      ? requirements.journeyStops[requirements.journeyIndex]
      : null;
  const activeJourneySequence = requirements.journeyActive
    ? requirements.journeyStops
    : requirements.visitSequence;
  const activeJourneyStop = requirements.journeyActive
    ? activeStop
    : voiceDestinationId === destination?.id
      ? destination
      : null;
  const activeJourneyStopId = activeJourneyStop?.id ?? null;
  const speak = voice.speak;

  const routeNodeIndex = route?.nodes.findIndex(
    (node) =>
      currentPosition?.source === "gps"
        ? node.id === currentPosition.nearestBeaconId
        : Boolean(
            currentPosition &&
              node.positioningId === currentPosition.nearestBeaconId &&
              node.positioningSource === currentPosition.source,
          ),
  ) ?? -1;
  const activeInstructionIndex =
    routeNodeIndex >= 0
      ? Math.min(routeNodeIndex, (route?.instructions.length ?? 1) - 1)
      : 0;
  const finalRouteNode = route?.nodes.at(-1);
  const arrivalConfirmed = Boolean(
    destination &&
      finalRouteNode?.positioningId &&
      finalRouteNode.positioningSource &&
      currentPosition?.source === finalRouteNode.positioningSource &&
      currentPosition.nearestBeaconId === finalRouteNode.positioningId &&
      currentPosition.confidence >= 0.72,
  );
  const routeInstruction = route?.instructions[activeInstructionIndex];
  const activeInstruction =
    routeInstruction?.startsWith("You have arrived") && !arrivalConfirmed
      ? "The route starts at the destination node, but physical arrival is not confirmed by indoor positioning."
      : routeInstruction;
  const navigationGuidanceActive =
    navigationActive ||
    (activeJourneyStopId !== null &&
      destination?.id === activeJourneyStopId);
  useEffect(() => {
    if (
      !currentPosition ||
      (currentPosition.source !== "ble" && currentPosition.source !== "wifi")
    ) {
      return;
    }
    const key = `${currentPosition.buildingId}:${currentPosition.floor}`;
    if (lastAnnouncedPosition.current && lastAnnouncedPosition.current !== key) {
      const announcement =
        `Indoor position confirmed: building ${currentPosition.buildingId}, ${currentPosition.floor}.`;
      if (navigationGuidanceActive) {
        pendingFloorAnnouncement.current = announcement;
      } else {
        speak(announcement);
      }
    }
    lastAnnouncedPosition.current = key;
  }, [currentPosition, navigationGuidanceActive, speak]);

  useEffect(() => {
    if (!navigationGuidanceActive || !activeInstruction) return;
    const instructionKey = [
      destination?.id ?? specialRouteTarget ?? "",
      route?.nodes[0]?.id ?? "",
      activeInstructionIndex,
      activeInstruction,
    ].join(":");
    if (lastSpokenInstruction.current === instructionKey) return;
    lastSpokenInstruction.current = instructionKey;
    const floorAnnouncement = pendingFloorAnnouncement.current;
    pendingFloorAnnouncement.current = "";
    speak(
      floorAnnouncement
        ? `${floorAnnouncement} ${activeInstruction}`
        : activeInstruction,
    );
  }, [
    activeInstruction,
    activeInstructionIndex,
    destination?.id,
    navigationGuidanceActive,
    route,
    specialRouteTarget,
    speak,
  ]);

  const canStart = requirements.visitSequence.length > 0;
  const canStartWithRoutes = canStart && requirements.routeAvailable;
  const analyzedDepartments = useMemo(
    () => new Set(requirements.visitSequence.map((department) => department.id)),
    [requirements.visitSequence],
  );

  const startJourney = () => {
    const first = requirements.startJourney();
    if (first) {
      setNavigationActive(true);
      onSelectDestination(first, {
        building: startBuilding,
        floor: startFloor,
        nodeId: startNodeId,
      });
    }
  };

  const advanceJourney = () => {
    const previousStop = activeStop;
    const next = requirements.advanceJourney();
    if (next) {
      onSelectDestination(
        next,
        previousStop
          ? {
              building: previousStop.building,
              floor: previousStop.floor,
              nodeId: route?.nodes.at(-1)?.id,
            }
          : undefined,
      );
    }
    else {
      setVoiceDestinationId(null);
      onStopNavigation();
    }
  };

  const stopJourney = () => {
    requirements.stopJourney();
    setVoiceDestinationId(null);
    setNavigationActive(false);
    onStopNavigation();
  };

  return (
    <section className="card patient-journey">
      <div className="patient-journey-heading">
        <div>
          <h2 className="section-title">{t("Patient Requirements & Voice Navigation", language)}</h2>
          <p className="muted">
            {t("Describe the services you need. Suggestions are limited to configured hospital departments and facilities, and are not medical advice.", language)}
          </p>
          <p className="patient-privacy-note">
            {t("Avoid entering personal identifiers or sensitive medical details. When configured, your requirement text is sent to the hospital AI backend.", language)}
          </p>
        </div>
        <span className="voice-status" role="status">
          {t(voiceStatusLabels[voice.status], language)}
        </span>
      </div>
      <div className={isDemoRouteMode ? "demo-route-banner is-active" : "demo-route-banner"}>
        <div>
          <strong>{t(isDemoRouteMode ? "DEMO MODE · SIMULATED ROUTES" : "REAL HOSPITAL MODE", language)}</strong>
          <p>
            {isDemoRouteMode
              ? t("The sample graph, start point, distances, and transitions are simulated examples, not surveyed hospital routes.", language)
              : t("Only surveyed, configured routes and confirmed route origins can enable a real journey. The current hospital route graph is not yet surveyed or configured.", language)}
          </p>
          <p>
            {t("Department records are the local configured directory, not a live hospital database feed or independently verified hospital catalog.", language)}
          </p>
        </div>
        {isDemoRouteMode ? (
          <div className="demo-route-controls">
            <label htmlFor="demo-route-start">{t("STARTING POINT", language)}</label>
            <select
              id="demo-route-start"
              value={demoRouteStartNodeId}
              onChange={(event) => onChangeDemoRouteStart?.(event.target.value)}
            >
              {demoRouteStartNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.kind === "entrance"
                    ? t("Main Entrance", language)
                    : t(node.label.replace(/^Sample\s+/i, ""), language)}{" "}
                  · {t("Building", language)} {node.buildingId} · {t(node.floor, language)}
                </option>
              ))}
            </select>
            <button className="secondary" onClick={onDisableDemoRouteMode} type="button">
              {t("Switch to Real Hospital Mode", language)}
            </button>
          </div>
        ) : (
          <button className="secondary" onClick={onEnableDemoRouteMode} type="button">
            {t("Enter Demo Mode", language)}
          </button>
        )}
      </div>

      <label htmlFor="patient-requirement">{t("WHAT SERVICES DO YOU NEED?", language)}</label>
      <div className="patient-input-language">
        <label htmlFor="patient-language">{t("VOICE LANGUAGE", language)}</label>
        <select
          id="patient-language"
          value={voiceLanguage}
          onChange={(event) => setLanguage(event.target.value === "kn-IN" ? "kn" : "en")}
        >
          <option value="en-IN">{t("English", language)}</option>
          <option value="kn-IN">{t("ಕನ್ನಡ", language)}</option>
        </select>
        <small>
          {t("Voice availability depends on your browser. Typed English and Kannada requests are matched against the configured hospital directory.", language)}
        </small>
      </div>
      <textarea
        id="patient-requirement"
        className="patient-requirement-input"
        value={requirements.input}
        onChange={(event) => requirements.setInput(event.target.value)}
        placeholder={t("For example: I need a general consultation and a blood test.", language)}
        rows={3}
      />
      <div className="patient-input-actions">
        <button
          className="primary"
          onClick={() => void requirements.analyze()}
          disabled={requirements.isAnalyzing || !requirements.input.trim()}
          type="button"
        >
          {requirements.isAnalyzing ? t("Understanding…", language) : t("Understand requirement", language)}
        </button>
        <button
          className="secondary voice-microphone"
          onClick={
            voice.status === "listening" ? voice.stopListening : voice.startListening
          }
          type="button"
          aria-label={
            voice.status === "listening"
              ? t("Stop voice recognition", language)
              : t("Speak a requirement or navigation command", language)
          }
          title={t("Speak a requirement or navigation command", language)}
        >
          {voice.status === "listening" ? t("■ Stop listening", language) : t("🎙 Speak", language)}
        </button>
        <button
          className="secondary"
          onClick={() => void voice.processText(requirements.input)}
          disabled={!requirements.input.trim() || voice.status === "processing"}
          type="button"
        >
          {t("Process as command", language)}
        </button>
      </div>
      {(voice.transcript || voice.error) && (
        <div className={voice.error ? "voice-feedback error" : "voice-feedback"}>
          {voice.transcript && (
            <span>
              <strong>{t("Recognized:", language)}</strong> {voice.transcript}
            </span>
          )}
          {voiceClarification && (
            <p className="patient-clarification" role="status">
              {t(voiceClarification, language)}
            </p>
          )}
          {voice.error && <span role="alert">{t(voice.error, language)}</span>}
        </div>
      )}

      {(destination || specialRouteTarget) && route && (
        <div className="indoor-guidance" aria-live="polite">
          <div className="indoor-guidance-heading">
            <div>
              <strong>
                {t("Indoor guidance ·", language)}{" "}
                {destination ? t(destination.name, language) : specialRouteTarget}
              </strong>
              <small>
                {currentPosition
                  ? `${t(currentPosition.source === "manual" ? "Selected" : currentPosition.source === "demo" ? "SIMULATED POSITION" : "Position confirmed", language)} · ${t("Building", language)} ${currentPosition.buildingId} · ${t(currentPosition.floor, language)} · ${Math.round(currentPosition.confidence * 100)}% ${t("confidence", language)}`
                  : isDemoRouteMode && route.nodes[0]
                    ? `${t("Simulated starting point", language)} · ${t("Building", language)} ${route.nodes[0].buildingId} · ${t(route.nodes[0].floor, language)}`
                    : t("No indoor position; confirm a configured starting point to begin.", language)}
              </small>
            </div>
            <span>
              {route.distance.toFixed(1)} m ·{" "}
              {t(isDemoRouteMode
                ? "simulated example distance"
                : "configured surveyed distance", language)}
            </span>
          </div>
          <p className="indoor-guidance-step">
            {navigationActive
              ? translateNavigationText(activeInstruction ?? "Follow the highlighted configured route.", language)
              : t("Route calculated. Start navigation when you are ready.", language)}
          </p>
          {routeNodeIndex >= 0 && (
            <small>
              Position checkpoint {routeNodeIndex + 1} of {route.nodes.length}
            </small>
          )}
          {arrivalConfirmed && (
            <p className="route-readiness route-readiness-available" role="status">
              {t("Arrival confirmed by the configured indoor positioning checkpoint.", language)}
            </p>
          )}
          <div className="patient-journey-actions">
            {!navigationActive ? (
              <button
                className="primary"
                onClick={() => setNavigationActive(true)}
                type="button"
              >
                {t("Start Navigation", language)}
              </button>
            ) : (
              <button
                className="secondary"
                onClick={() => {
                  setNavigationActive(false);
                  onStopNavigation();
                }}
                type="button"
              >
                {t("Stop Navigation", language)}
              </button>
            )}
            {navigationActive && (
              <>
                <button className="secondary" onClick={voice.pause} type="button">
                  {t("Pause voice", language)}
                </button>
                <button className="secondary" onClick={voice.resume} type="button">
                  {t("Resume voice", language)}
                </button>
              </>
            )}
            <button
              className="secondary"
              onClick={() => voice.speakDirections(route.instructions.map((step) => translateNavigationText(step, language)))}
              type="button"
            >
              {t("Repeat directions", language)}
            </button>
          </div>
        </div>
      )}

      {requirements.analysis && (
        <div className="patient-analysis">
          <p className="patient-analysis-source">
            {requirements.analysis.source === "ai-backend"
              ? t("AI backend suggestion", language)
              : t("Rule-based suggestion", language)}
            {" · "}
            {t("Intent:", language)} {t(requirements.analysis.plan.intent, language)} ·{" "}
            {t(requirements.analysis.plan.rationale, language)}
          </p>
          <p className="patient-workflow-note">
            {hospitalWorkflows.length > 0
              ? requirements.analysis.plan.workflowNote
              : t("Workflow configuration missing: hospital-approved visit prerequisites are not configured. The listed stops are not medically ordered.", language)}
          </p>
          {requirements.analysis.backendMessage && (
            <p className="muted">
              {t("AI service unavailable; used the local rule-based fallback", language)} (
              {t(requirements.analysis.backendMessage, language)}).
            </p>
          )}
          {requirements.analysis.plan.clarification && (
            <p className="patient-clarification" role="status">
              {t(requirements.analysis.plan.clarification, language)}
            </p>
          )}
          {requirements.analysis.plan.requirements.length > 0 && (
            <div className="structured-requirements">
              <h3>{t("Identified requirements", language)}</h3>
              <ul>
                {requirements.analysis.plan.requirements.map((requirement, index) => (
                  <li
                    key={`${requirement.requestedText}-${requirement.departmentId ?? "unknown"}-${index}`}
                  >
                    <span>
                      <strong>{requirement.departmentName ? t(requirement.departmentName, language) : requirement.requestedText}</strong>
                      <small>
                        {t(requirement.status.replace("-", " "), language)} ·{" "}
                        {t(requirement.intent, language)} ·{" "}
                        {Math.round(requirement.confidence * 100)}% {t("match confidence", language)}
                        {requirement.matchedTerms.length > 0
                          ? ` · ${t("matched", language)} ${requirement.matchedTerms.map((term) => t(term, language)).join(", ")}`
                          : ""}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
              <details>
                <summary>{t("Structured JSON", language)}</summary>
                <pre>{JSON.stringify(requirements.analysis.plan, null, 2)}</pre>
              </details>
            </div>
          )}
          {requirements.visitSequence.length > 0 && (
            <div
              className={
                requirements.routeAvailable
                  ? "route-readiness route-readiness-available"
                  : "route-readiness"
              }
              role="status"
              aria-live="polite"
            >
              <strong>
                {requirements.routeAvailable
                  ? isDemoRouteMode
                    ? t("Demo route available · simulated", language)
                    : t("Route available · surveyed configuration", language)
                  : t("Route not ready", language)}
              </strong>
              <ul>
                {requirements.routeReadinessReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          <h3>
            {requirements.routeAvailable
              ? isDemoRouteMode
                ? t("Demo visit sequence · simulated route ordering", language)
                : t("Recommended visit sequence · shortest available verified route", language)
              : hospitalWorkflows.length > 0
                ? t("Suggested visit sequence · configured workflow order", language)
                : t("Requested visit sequence · no configured workflow rules", language)}
          </h3>
          <div className="patient-add-stop">
            <label htmlFor="patient-add-stop">{t("ADD A CONFIGURED DESTINATION", language)}</label>
            <select
              id="patient-add-stop"
              value={additionalDestinationId}
              onChange={(event) => setAdditionalDestinationId(event.target.value)}
            >
              <option value="">{t("Choose a department or facility", language)}</option>
              {departments
                .filter(
                  (department) => !analyzedDepartments.has(department.id),
                )
                .map((department) => (
                  <option key={department.id} value={department.id}>
                    {t(department.name, language)} · {department.building} · {t(department.floor, language)}
                  </option>
                ))}
            </select>
            <button
              className="secondary"
              disabled={!additionalDestinationId}
              onClick={() => {
                requirements.addDestination(Number(additionalDestinationId));
                setAdditionalDestinationId("");
              }}
              type="button"
            >
              {t("Add stop", language)}
            </button>
          </div>
          {requirements.visitSequence.length > 0 ? (
            <ol className="patient-visit-sequence">
              {requirements.visitSequence.map((department, index) => (
                <li key={department.id}>
                  <span className="patient-sequence-number">{index + 1}</span>
                  <div>
                    <strong>{t(department.name, language)}</strong>
                    <small>
                      {t("Building", language)} {department.building} · {t(department.floor, language)} · {t("Room", language)}{" "}
                      {department.room}
                    </small>
                  </div>
                  <button
                    className="secondary patient-remove"
                    onClick={() => requirements.removeDestination(department.id)}
                    type="button"
                    aria-label={`${t("Remove", language)} ${t(department.name, language)} ${t("from journey", language)}`}
                  >
                    {t("Remove", language)}
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty">
              {t("No destinations matched. Select a configured department or facility to build a suggested visit sequence.", language)}
            </p>
          )}
          <div className="patient-journey-actions">
            {!requirements.journeyActive ? (
              <button
                className="primary"
                onClick={startJourney}
                disabled={!canStartWithRoutes}
                aria-describedby={
                  canStartWithRoutes ? undefined : "journey-readiness-help"
                }
                type="button"
              >
                {t("Start Journey", language)}
              </button>
            ) : (
              <>
                <span>
                  {t("Stop {{current}} of {{total}}", language, { current: requirements.journeyIndex + 1, total: activeJourneySequence.length })}
                    {activeStop ? ` · ${t(activeStop.name, language)}` : ""}
                </span>
                <button className="primary" onClick={advanceJourney} type="button">
                  {requirements.journeyIndex + 1 < activeJourneySequence.length
                    ? t("Next stop", language)
                    : t("Finish journey", language)}
                </button>
                <button className="secondary" onClick={stopJourney} type="button">
                  {t("Stop Journey", language)}
                </button>
              </>
            )}
            {route?.instructions.length ? (
              <button
                className="secondary"
                onClick={() => voice.speakDirections(route.instructions.map((step) => translateNavigationText(step, language)))}
                type="button"
              >
                {t("Speak directions", language)}
              </button>
            ) : null}
          </div>
          {!requirements.journeyActive && !canStartWithRoutes && (
            <p
              className="journey-readiness-help"
              id="journey-readiness-help"
              role="note"
            >
              {t("Journey start is disabled until a confirmed start node and surveyed, connected routes to every selected destination are configured. The map’s visual-only marker cannot be used as a route origin.", language)}
            </p>
          )}
        </div>
      )}
      {requirements.error && (
        <p className="error patient-requirement-error" role="alert">
          {t(requirements.error, language)}
        </p>
      )}
      <p className="patient-safety-note">
        {t("HospiNav provides navigation only. It does not diagnose symptoms or determine which medical services are clinically appropriate.", language)}
      </p>
      {!voice.supported && (
        <p className="patient-voice-fallback">
          {t("Speech recognition is unsupported here. Use the text input above.", language)}
        </p>
      )}
      {analyzedDepartments.size === 0 && requirements.analysis && (
        <p className="patient-voice-hint">
          {t("Voice commands include “Where am I?”, “Which floor am I on?”, “Find the nearest lift”, “Repeat the directions”, and “Stop navigation”.", language)}
        </p>
      )}
    </section>
  );
}
