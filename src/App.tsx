import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  hospitalBuildings as buildings,
  hospitalDepartments as departments,
  type HospitalDepartment as Department,
} from "./data/hospitalMapData";
import { hospitalRouteGraph } from "./data/hospitalRouteGraphData";
import {
  defaultDemoRouteStartNodeId,
  demoRouteGraph,
  demoRouteStartNodes,
} from "./data/demoRouteGraphData";
import OutdoorNavigation from "./components/outdoor-navigation/OutdoorNavigation";
import IndoorPositioningPanel from "./components/indoor-navigation/IndoorPositioningPanel";
import PatientJourneyPanel from "./components/indoor-navigation/PatientJourneyPanel";
import { useIndoorPosition } from "./hooks/useIndoorPosition";
import { useAutomaticPosition } from "./hooks/useAutomaticPosition";
import { useIndoorNavigation } from "./hooks/useIndoorNavigation";
import type { IndoorPositionEstimate } from "./services/indoorPositioningService";
import {
  findRouteToNode,
  getConfiguredRouteStartNodes,
} from "./services/hospitalRouteService";
import type { IndoorRoute } from "./services/hospitalRouteService";
import type { MapViewMode } from "./components/hospital-map/HospitalMap3D";
import { useLanguage } from "./hooks/useLanguage";
import { translateNavigationText, translateText } from "./services/translationService";

const HospitalMap3D = lazy(
  () => import("./components/hospital-map/HospitalMap3D"),
);

type Tab =
  | "Dashboard"
  | "Indoor Navigation"
  | "Outdoor Navigation"
  | "Departments"
  | "Facilities";

function buildingName(buildingId: string) {
  return buildings.find((building) => building.id === buildingId)?.name ??
    `Building ${buildingId}`;
}

function matchesSearch(department: Department, query: string, language: "en" | "kn" = "en") {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    department.name,
    translateText(department.name, language),
    department.category,
    department.room,
    department.floor,
    translateText(department.floor, language),
    buildingName(department.building),
    translateText(buildingName(department.building), language),
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

const navigationTabs: Tab[] = [
  "Dashboard",
  "Indoor Navigation",
  "Outdoor Navigation",
  "Departments",
  "Facilities",
];

export default function App() {
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>("Dashboard");
  const [building, setBuilding] = useState("A");
  const [floor, setFloor] = useState("Ground Floor");
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>("building");
  const [followDetectedPosition, setFollowDetectedPosition] = useState(true);
  const [demoRouteMode, setDemoRouteMode] = useState(false);
  const [demoRouteOriginId, setDemoRouteOriginId] = useState(
    defaultDemoRouteStartNodeId,
  );
  const [demoJourneyOriginId, setDemoJourneyOriginId] = useState(
    defaultDemoRouteStartNodeId,
  );
  const [placingVisualStart, setPlacingVisualStart] = useState(false);
  const [visualStartPoint, setVisualStartPoint] = useState<{
    buildingId: string;
    floor: string;
    position: [number, number];
  } | null>(null);
  const [startBuilding, setStartBuilding] = useState("A");
  const [startFloor, setStartFloor] = useState("Ground Floor");
  const [startNodeId, setStartNodeId] = useState("");
  const [journeyOriginOverride, setJourneyOriginOverride] = useState("");
  const [pendingStartNodeId, setPendingStartNodeId] = useState<string | null>(
    null,
  );
  const [accessibleRoute, setAccessibleRoute] = useState(false);
  const [search, setSearch] = useState("");
  const [destination, setDestination] = useState<Department | null>(null);
  const [specialRoute, setSpecialRoute] = useState<{
    targetNodeId: string;
    targetLabel: string;
  } | null>(null);
  const indoorPositioning = useIndoorPosition({
    buildings,
    onPositionChange: (estimate: IndoorPositionEstimate) => {
      setBuilding(estimate.buildingId);
      setFloor(estimate.floor);
      setStartBuilding(estimate.buildingId);
      setStartFloor(estimate.floor);
      setStartNodeId("");
      setJourneyOriginOverride("");
      setPendingStartNodeId(null);
      setMapViewMode("floor");
    },
  });
  const automaticPosition = useAutomaticPosition({
    buildings,
    indoorPosition: indoorPositioning.currentPosition,
    indoorPositioning,
  });
  const gpsPosition = automaticPosition.gpsPosition;
  const gpsLoading =
    automaticPosition.gpsTracking && automaticPosition.gpsPosition === null;
  const gpsError = automaticPosition.gpsError;
  const stopIndoorPositioning = indoorPositioning.stop;
  useEffect(() => {
    if (activeTab !== "Indoor Navigation") return;
    return () => stopIndoorPositioning();
  }, [activeTab, stopIndoorPositioning]);
  const positioningEstimate = indoorPositioning.currentPosition;
  const routeGraph = demoRouteMode ? demoRouteGraph : hospitalRouteGraph;
  const selectedDemoOrigin = demoRouteGraph.nodes.find(
    (node) => node.id === demoRouteOriginId,
  );
  const detectedRouteStart = automaticPosition.matchedPosition?.node;
  const automaticallyMatchedStartId =
    automaticPosition.matchedPosition?.node.id ?? "";
  const confirmedStartNode = routeGraph.nodes.find(
    (node) => node.id === startNodeId,
  );
  const confirmedStartMatchesSelection =
    confirmedStartNode?.buildingId === startBuilding &&
    confirmedStartNode.floor === startFloor;
  const automaticIndoorEstimate =
    positioningEstimate?.source === "ble" ||
    positioningEstimate?.source === "wifi";
  const automaticOrigin = Boolean(automaticallyMatchedStartId);
  const manualOriginConfirmed =
    positioningEstimate?.source === "manual" &&
    confirmedStartMatchesSelection &&
    Boolean(startNodeId);
  const routeStartNodeId = demoRouteMode
    ? demoJourneyOriginId
    : automaticOrigin
    ? automaticallyMatchedStartId
    : automaticIndoorEstimate ||
        positioningEstimate?.source === "demo" ||
        (automaticPosition.gpsTracking && gpsPosition !== null && !manualOriginConfirmed)
      ? ""
      : journeyOriginOverride === startNodeId && startNodeId
        ? startNodeId
        : manualOriginConfirmed
          ? startNodeId
          : "";
  const pendingRouteNodeId =
    pendingStartNodeId ??
    automaticallyMatchedStartId;
  const autoMatchedBuildingId =
    automaticPosition.matchedPosition?.node.buildingId;
  const autoMatchedFloor = automaticPosition.matchedPosition?.node.floor;

  const activeBuildingId = followDetectedPosition
    ? demoRouteMode
      ? selectedDemoOrigin?.buildingId ?? building
      : autoMatchedBuildingId ?? building
    : building;
  const activeFloor = followDetectedPosition
    ? demoRouteMode
      ? selectedDemoOrigin?.floor ?? floor
      : autoMatchedFloor ?? floor
    : floor;
  const activeStartBuildingId = demoRouteMode
    ? (routeGraph.nodes.find((node) => node.id === demoJourneyOriginId)?.buildingId ??
      startBuilding)
    : autoMatchedBuildingId ?? startBuilding;
  const activeStartFloor = demoRouteMode
    ? (routeGraph.nodes.find((node) => node.id === demoJourneyOriginId)?.floor ??
      startFloor)
    : autoMatchedFloor ?? startFloor;
  const currentBuilding =
    buildings.find((item) => item.id === activeBuildingId) ?? buildings[0];
  const startingBuilding =
    buildings.find((item) => item.id === activeStartBuildingId) ?? buildings[0];
  const filteredDepartments = departments.filter(
    (item) => item.category !== "Facility" && matchesSearch(item, search, language),
  );
  const filteredFacilities = departments.filter(
    (item) => item.category === "Facility" && matchesSearch(item, search, language),
  );
  const routeStartNode =
    routeGraph.nodes.find((node) => node.id === routeStartNodeId) ?? null;
  const routeStartBuilding = routeStartNode?.buildingId ?? activeStartBuildingId;
  const routeStartFloor = routeStartNode?.floor ?? activeStartFloor;
  const mapPositionEstimate: IndoorPositionEstimate | null =
    demoRouteMode
      ? null
      : automaticPosition.matchedPosition?.source === "gps" && gpsPosition
      ? {
          buildingId: automaticPosition.matchedPosition.node.buildingId,
          floor: automaticPosition.matchedPosition.node.floor,
          confidence: automaticPosition.matchedPosition.confidence,
          source: "gps",
          nearestBeaconId: automaticPosition.matchedPosition.node.id,
          rssi: null,
          timestamp: gpsPosition.timestamp,
          evidenceCount: 1,
        }
      : positioningEstimate;
  const { route, error: routeError } = useIndoorNavigation({
    startBuilding: routeStartBuilding,
    startFloor: routeStartFloor,
    startNodeId: routeStartNodeId,
    accessibleOnly: accessibleRoute,
    destination,
    graph: routeGraph,
  });
  const specialRouteResult = useMemo(() => {
    if (!specialRoute) return { route: null, error: null };
    if (!routeStartNodeId) {
      return {
        route: null,
        error: "No confirmed live route origin is currently available for this route.",
      };
    }
    try {
      const currentRoute = findRouteToNode(
        routeStartNodeId,
        specialRoute.targetNodeId,
        accessibleRoute,
        routeGraph,
      );
      return {
        route: currentRoute,
        error: currentRoute
          ? null
          : `No connected walkable route is available to ${specialRoute.targetLabel} from the confirmed position.`,
      };
    } catch (routeError) {
      return {
        route: null,
        error:
          routeError instanceof Error
            ? routeError.message
            : "Unable to validate this configured route.",
      };
    }
  }, [accessibleRoute, routeGraph, routeStartNodeId, specialRoute]);
  const displayedRoute = specialRoute ? specialRouteResult.route : route;
  const activeMapViewMode = displayedRoute
    ? "floor"
    : demoRouteMode || (followDetectedPosition && automaticOrigin)
      ? "floor"
      : mapViewMode;

  const startNavigation = (
    department: Department,
    start?: { building: string; floor: string; nodeId?: string },
  ) => {
    setSpecialRoute(null);
    setDestination(department);
    const requestedStartNode = start?.nodeId
      ? routeGraph.nodes.find((node) => node.id === start.nodeId)
      : routeStartNode;
    const mapStartBuilding = requestedStartNode?.buildingId ??
      start?.building ??
      department.building;
    const mapStartFloor = requestedStartNode?.floor ??
      start?.floor ??
      department.floor;
    if (start) {
      if (demoRouteMode && start.nodeId) {
        setDemoJourneyOriginId(start.nodeId);
      }
      setBuilding(mapStartBuilding);
      setFloor(mapStartFloor);
      setStartBuilding(start.building);
      setStartFloor(start.floor);
      setStartNodeId(start.nodeId ?? "");
      setJourneyOriginOverride(start.nodeId ?? "");
    } else {
      setBuilding(mapStartBuilding);
      setFloor(mapStartFloor);
      setJourneyOriginOverride("");
    }
    setMapViewMode("floor");
    setActiveTab("Indoor Navigation");
  };

  const selectSpecialRoute = (
    _selectedRoute: IndoorRoute,
    targetLabel: string,
    targetNodeId: string,
  ) => {
    setDestination(null);
    setSpecialRoute({ targetNodeId, targetLabel });
    const origin = routeGraph.nodes.find(
      (node) => node.id === routeStartNodeId,
    );
    if (origin) {
      setBuilding(origin.buildingId);
      setFloor(origin.floor);
      setMapViewMode("floor");
    }
    setActiveTab("Indoor Navigation");
  };

  const stopNavigation = () => {
    setDestination(null);
    setSpecialRoute(null);
  };

  const enableDemoRouteMode = () => {
    const origin = selectedDemoOrigin ?? demoRouteStartNodes[0];
    if (!origin) return;
    setDemoRouteMode(true);
    setDemoJourneyOriginId(origin.id);
    setStartBuilding(origin.buildingId);
    setStartFloor(origin.floor);
    setStartNodeId(origin.id);
    setJourneyOriginOverride("");
    setBuilding(origin.buildingId);
    setFloor(origin.floor);
    setMapViewMode("floor");
    setFollowDetectedPosition(false);
  };

  const changeDemoRouteOrigin = (nodeId: string) => {
    const origin = demoRouteStartNodes.find((node) => node.id === nodeId);
    if (!origin) return;
    setDemoRouteOriginId(origin.id);
    setDemoJourneyOriginId(origin.id);
    setStartBuilding(origin.buildingId);
    setStartFloor(origin.floor);
    setStartNodeId(origin.id);
    setBuilding(origin.buildingId);
    setFloor(origin.floor);
    setMapViewMode("floor");
  };

  const disableDemoRouteMode = () => {
    setDemoRouteMode(false);
    indoorPositioning.clearSimulatedPosition();
    setStartNodeId("");
    setJourneyOriginOverride("");
    setDestination(null);
    setSpecialRoute(null);
  };

  const changeStartBuilding = (id: string) => {
    const nextBuilding = buildings.find((item) => item.id === id);
    if (!nextBuilding) return;
    setFollowDetectedPosition(false);
    setStartBuilding(id);
    setStartFloor(nextBuilding.floors[0]);
    setStartNodeId("");
    setJourneyOriginOverride("");
    setPendingStartNodeId("");
    setBuilding(id);
    setFloor(nextBuilding.floors[0]);
    setMapViewMode("floor");
    indoorPositioning.setManualPosition(id, nextBuilding.floors[0]);
  };

  const changeMapBuilding = (id: string) => {
    const nextBuilding = buildings.find((item) => item.id === id);
    if (!nextBuilding) return;
    setFollowDetectedPosition(false);
    setBuilding(id);
    setFloor(nextBuilding.floors[0]);
    setMapViewMode("floor");
  };

  const changeMapFloor = (nextFloor: string) => {
    setFollowDetectedPosition(false);
    setFloor(nextFloor);
    setBuilding(activeBuildingId);
    setMapViewMode("floor");
  };

  const changeStartFloor = (nextFloor: string) => {
    setFollowDetectedPosition(false);
    setStartFloor(nextFloor);
    setBuilding(activeStartBuildingId);
    setStartBuilding(activeStartBuildingId);
    setFloor(nextFloor);
    setStartNodeId("");
    setJourneyOriginOverride("");
    setPendingStartNodeId("");
    setMapViewMode("floor");
    indoorPositioning.setManualPosition(startBuilding, nextFloor);
  };

  const changeStartNode = (nodeId: string) => {
    setPendingStartNodeId(nodeId);
  };

  const confirmStartNode = () => {
    const node = getConfiguredRouteStartNodes(routeGraph).find(
      (item) => item.id === pendingRouteNodeId,
    );
    if (!node) return;
    setStartNodeId(node.id);
    setJourneyOriginOverride("");
    setStartBuilding(node.buildingId);
    setStartFloor(node.floor);
    setBuilding(node.buildingId);
    setFloor(node.floor);
    setMapViewMode("floor");
    indoorPositioning.setManualPosition(node.buildingId, node.floor);
  };

  const renderDirectoryEntry = (department: Department) => (
    <div className="department" key={department.id}>
      <div className="department-info">
        <span className="department-icon" aria-hidden="true">
          {department.icon}
        </span>
        <div>
          <strong>{t(department.name, language)}</strong>
          <small>
            {t(buildingName(department.building), language)} · {t(department.floor, language)} · {t("Room", language)}{" "}
            {department.room}
          </small>
        </div>
      </div>
      <button
        className="primary"
        onClick={() => startNavigation(department)}
        type="button"
      >
        {t("Navigate →", language)}
      </button>
    </div>
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          ✚ HospiNav
          <small>{t("SMART HOSPITAL GUIDE", language)}</small>
        </div>

        <div className="menu-title">{t("MAIN MENU", language)}</div>
        <nav className="menu" aria-label={t("Main navigation", language)}>
          {navigationTabs.map((item) => (
            <button
              key={item}
              className={activeTab === item ? "active" : ""}
              onClick={() => setActiveTab(item)}
              aria-current={activeTab === item ? "page" : undefined}
              type="button"
            >
              <span aria-hidden="true">
                {item === "Dashboard" && "▦"}
                {item === "Indoor Navigation" && "⌖"}
                {item === "Outdoor Navigation" && "◎"}
                {item === "Departments" && "▤"}
                {item === "Facilities" && "♧"}
              </span>
              {t(item, language)}
            </button>
          ))}
        </nav>

        <div className="help">
          <strong>{t("Need Assistance?", language)}</strong>
          <p>{t("Find your way around the hospital easily.", language)}</p>
          <button
            className="primary"
            onClick={() => setActiveTab("Indoor Navigation")}
            type="button"
          >
            {t("Open Navigation →", language)}
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{t(activeTab, language)}</h1>
            <small>HospiNav / {t(activeTab, language)}</small>
          </div>
          <div className="topbar-actions">
            <label className="language-selector">
              <span>{t("Language", language)}</span>
              <select
                aria-label={t("Language", language)}
                value={language}
                onChange={(event) => setLanguage(event.target.value === "kn" ? "kn" : "en")}
              >
                <option value="en">{t("English", language)}</option>
                <option value="kn">{t("ಕನ್ನಡ", language)}</option>
              </select>
            </label>
            <span className="online">
              <span aria-hidden="true">●</span> {t("System Online", language)}
            </span>
          </div>
        </header>

        <div className="content">
          {activeTab === "Dashboard" && (
            <>
              <section className="welcome">
                <div>
                  <small>{t("WELCOME TO HOSPINAV", language)}</small>
                  <h2>{t("Find your way around the hospital.", language)}</h2>
                  <p>
                    {t("Search departments, explore facilities, and get directions between hospital blocks.", language)}
                  </p>
                  <button
                    className="welcome-button"
                    onClick={() => setActiveTab("Indoor Navigation")}
                    type="button"
                  >
                    {t("Start navigating →", language)}
                  </button>
                </div>
                <span className="welcome-icon" aria-hidden="true">
                  ✚
                </span>
              </section>

              <section className="card gps-box" aria-live="polite">
                <div>
                  <strong>{t("Automatic location", language)}</strong>
                  <p>{t(automaticPosition.status, language)}</p>
                  {automaticPosition.matchedPosition && (
                    <p>
                      {t("Approximate route point:", language)}{" "}
                      {t(automaticPosition.matchedPosition.node.label, language)} ·{" "}
                      {t(buildingName(
                        automaticPosition.matchedPosition.node.buildingId,
                      ), language)}{" "}
                      · {t(automaticPosition.matchedPosition.node.floor, language)}
                    </p>
                  )}
                  {gpsPosition && (
                    <p>
                      GPS: {gpsPosition.latitude.toFixed(5)},{" "}
                      {gpsPosition.longitude.toFixed(5)} · ±
                      {Math.round(gpsPosition.accuracy)} m
                    </p>
                  )}
                  {gpsError && <p className="error">{t(gpsError, language)}</p>}
                </div>
                <div className="row">
                  <button
                    className="secondary"
                    onClick={automaticPosition.retryGPS}
                    disabled={gpsLoading}
                    type="button"
                  >
                    {gpsLoading ? t("Detecting...", language) : t("Retry location", language)}
                  </button>
                  {automaticPosition.gpsTracking && (
                    <button
                      className="secondary"
                      onClick={automaticPosition.stopGPS}
                      type="button"
                    >
                      {t("Stop tracking", language)}
                    </button>
                  )}
                </div>
              </section>

              <section className="bottom-grid" aria-label={t("Hospital overview", language)}>
                <div className="card stat-card">
                  <span>{t("Total Buildings", language)}</span>
                  <strong>{buildings.length}</strong>
                  <small>{t("Hospital blocks", language)}</small>
                </div>
                <div className="card stat-card">
                  <span>{t("Departments", language)}</span>
                  <strong>
                    {departments.filter((item) => item.category !== "Facility")
                      .length}
                  </strong>
                  <small>{t("Across all buildings", language)}</small>
                </div>
                <div className="card stat-card">
                  <span>{t("Facilities", language)}</span>
                  <strong>
                    {departments.filter((item) => item.category === "Facility")
                      .length}
                  </strong>
                  <small>{t("Available to visitors", language)}</small>
                </div>
                <div className="card stat-card">
                  <span>{t("Hospital Floors", language)}</span>
                  <strong>
                    {buildings.reduce(
                      (total, item) => total + item.floors.length,
                      0,
                    )}
                  </strong>
                  <small>{t("Across four buildings", language)}</small>
                </div>
              </section>

              <section className="card">
                <h2 className="section-title">{t("Quick access", language)}</h2>
                <div className="quick-access">
                  <button
                    onClick={() => setActiveTab("Departments")}
                    type="button"
                  >
                    {t("Browse departments", language)}
                  </button>
                  <button
                    onClick={() => setActiveTab("Facilities")}
                    type="button"
                  >
                    {t("Find a facility", language)}
                  </button>
                  <button
                    onClick={() => setActiveTab("Indoor Navigation")}
                    type="button"
                  >
                    {t("Explore floor map", language)}
                  </button>
                  <button
                    onClick={() => setActiveTab("Outdoor Navigation")}
                    type="button"
                  >
                    {t("Live outdoor navigation", language)}
                  </button>
                </div>
              </section>
            </>
          )}

          {activeTab === "Departments" && (
            <section className="card">
              <h2 className="section-title">{t("Hospital Departments", language)}</h2>
              <label className="sr-only" htmlFor="department-search">
                {t("Search departments", language)}
              </label>
              <input
                id="department-search"
                className="search"
                placeholder={t("Search departments, buildings, floors, or rooms...", language)}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {filteredDepartments.length > 0 ? (
                filteredDepartments.map(renderDirectoryEntry)
              ) : (
                <p className="empty">{t("No departments match your search.", language)}</p>
              )}
            </section>
          )}

          {activeTab === "Facilities" && (
            <section className="card">
              <h2 className="section-title">{t("Hospital Facilities", language)}</h2>
              <label className="sr-only" htmlFor="facility-search">
                {t("Search facilities", language)}
              </label>
              <input
                id="facility-search"
                className="search"
                placeholder={t("Search facilities, buildings, floors, or rooms...", language)}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {filteredFacilities.length > 0 ? (
                filteredFacilities.map(renderDirectoryEntry)
              ) : (
                <p className="empty">{t("No facilities match your search.", language)}</p>
              )}
            </section>
          )}

          {activeTab === "Outdoor Navigation" && (
            <OutdoorNavigation
              buildings={buildings}
              sharedLocation={{
                position: gpsPosition,
                isTracking: automaticPosition.gpsTracking,
                error: gpsError || null,
                startTracking: automaticPosition.retryGPS,
                stopTracking: automaticPosition.stopGPS,
                geofence: automaticPosition.geofence
                  ? {
                      status: automaticPosition.geofence.status,
                      distanceMetres: automaticPosition.geofence.distanceMetres,
                      radiusMetres: automaticPosition.geofence.radiusMetres,
                    }
                  : null,
                geofenceTransition: automaticPosition.geofenceTransition,
              }}
              onOpenIndoorNavigation={(buildingId) => {
                changeMapBuilding(buildingId);
                setMapViewMode("building");
                setActiveTab("Indoor Navigation");
              }}
            />
          )}

          {activeTab === "Indoor Navigation" && (
            <>
              <PatientJourneyPanel
                departments={departments}
                routeGraph={routeGraph}
                isDemoRouteMode={demoRouteMode}
                demoRouteStartNodes={demoRouteStartNodes}
                demoRouteStartNodeId={demoRouteOriginId}
                onEnableDemoRouteMode={enableDemoRouteMode}
                onDisableDemoRouteMode={disableDemoRouteMode}
                onChangeDemoRouteStart={changeDemoRouteOrigin}
                startBuilding={routeStartBuilding}
                startFloor={routeStartFloor}
                startNodeId={routeStartNodeId}
                accessibleOnly={accessibleRoute}
                currentPosition={mapPositionEstimate}
                destination={destination}
                route={displayedRoute}
                specialRouteTarget={specialRoute?.targetLabel ?? null}
                onSelectDestination={startNavigation}
                onSelectSpecialRoute={selectSpecialRoute}
                onStopNavigation={stopNavigation}
              />

              <IndoorPositioningPanel
                positioning={indoorPositioning}
                gpsPosition={gpsPosition}
                gpsLoading={gpsLoading}
                gpsError={gpsError}
                automaticStatus={automaticPosition.status}
                onRetryGPS={automaticPosition.retryGPS}
                isDemoMode={demoRouteMode}
              />

              <section className="card">
                <h2 className="section-title">{t("Indoor Navigation", language)}</h2>
                <p className="muted">
                  {t("Choose your starting point and destination to view wayfinding instructions.", language)}
                </p>
                <div className="gps-box">
                  <div>
                    <strong>📍 {t("Your Current Location", language)}</strong>
                    <p className="route-start-confirmation" role="status">
                      {t(automaticPosition.status, language)}
                    </p>
                    {gpsPosition ? (
                      <>
                          <p>{t("Latitude:", language)} {gpsPosition.latitude.toFixed(6)}</p>
                          <p>{t("Longitude:", language)} {gpsPosition.longitude.toFixed(6)}</p>
                          <p>{t("GPS accuracy:", language)} ±{Math.round(gpsPosition.accuracy)} m</p>
                      </>
                    ) : (
                      <p>{t("Waiting for a GPS fix", language)}</p>
                    )}
                    <p className="gps-note">
                      {t("GPS provides outdoor coordinates only; it cannot identify your indoor building or floor.", language)}
                    </p>
                    {gpsError && (
                      <p className="error" role="alert">
                        {t(gpsError, language)}
                      </p>
                    )}
                  </div>
                  <button
                    className="primary"
                    onClick={automaticPosition.retryGPS}
                    disabled={gpsLoading}
                    type="button"
                  >
                    {gpsLoading ? t("Detecting...", language) : t("Retry GPS detection", language)}
                  </button>
                  {automaticPosition.gpsTracking && (
                    <button
                      className="secondary"
                      onClick={automaticPosition.stopGPS}
                      type="button"
                    >
                      {t("Stop GPS tracking", language)}
                    </button>
                  )}
                </div>
              </section>

              <section className="card">
                <h2 className="section-title">
                  {t(demoRouteMode ? "Starting Point" : "Confirm Starting Location", language)}
                </h2>
                {demoRouteMode && (
                  <p className="demo-route-map-note" role="status">
                    {t("Starting location:", language)}{" "}
                    {routeStartNode?.kind === "entrance"
                      ? t("Main Entrance", language)
                      : t(routeStartNode?.label.replace(/^Sample\s+/i, "") ?? "", language)}{" "}
                    · {t("Building", language)} {routeStartBuilding} ·{" "}
                    {t(buildingName(routeStartBuilding), language)} · {t(routeStartFloor, language)}.
                  </p>
                )}
                <p className="muted" hidden={demoRouteMode}>
                  {automaticOrigin && detectedRouteStart
                    ? `Automatically matched ${buildingName(detectedRouteStart.buildingId)} · ${detectedRouteStart.floor} · ${detectedRouteStart.label} using ${automaticPosition.matchedPosition?.source.toUpperCase()} positioning (${automaticPosition.confidenceLabel.toLowerCase()} confidence).`
                    : automaticIndoorEstimate
                      ? `${automaticPosition.status}. No configured route node matches this reading, so choose a verified point manually.`
                      : positioningEstimate?.source === "demo"
                        ? "This position is simulated and cannot be used as a real route origin. Select and confirm a configured point manually."
                        : positioningEstimate?.source === "manual"
                          ? `Manual selection · ${buildingName(startBuilding)} · ${startFloor}. Confirm an exact configured route point to calculate a route.`
                          : t(
                              "No indoor location detected. Select a building and floor, then confirm an exact configured route point.",
                              language,
                            )}
                </p>
                <p
                  className="route-start-confirmation"
                  role="status"
                  hidden={demoRouteMode}
                >
                  {routeStartNode && automaticOrigin
                    ? `Automatic starting point: ${buildingName(routeStartNode.buildingId)} · ${routeStartNode.floor} · ${routeStartNode.label}`
                    : confirmedStartNode &&
                        confirmedStartMatchesSelection &&
                        routeStartNodeId
                      ? `Confirmed start: ${buildingName(confirmedStartNode.buildingId)} · ${confirmedStartNode.floor} · ${confirmedStartNode.label}`
                      : t("No exact starting point confirmed", language)}
                </p>
                <div className="row" hidden={demoRouteMode}>
                  <div>
                    <label htmlFor="start-building">{t("START BUILDING", language)}</label>
                    <select
                      id="start-building"
                      value={activeStartBuildingId}
                      disabled={automaticOrigin}
                      onChange={(event) =>
                        changeStartBuilding(event.target.value)
                      }
                    >
                      {buildings.map((item) => (
                        <option key={item.id} value={item.id}>
                          {t(item.name, language)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="start-floor">{t("START FLOOR", language)}</label>
                    <select
                      id="start-floor"
                      value={activeStartFloor}
                      disabled={automaticOrigin}
                      onChange={(event) => changeStartFloor(event.target.value)}
                    >
                      {startingBuilding.floors.map((item) => (
                        <option key={item} value={item}>
                          {t(item, language)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="start-node">{t("CONFIRMED STARTING POINT", language)}</label>
                    <select
                      id="start-node"
                      value={pendingRouteNodeId}
                      disabled={automaticOrigin}
                      onChange={(event) => changeStartNode(event.target.value)}
                    >
                      <option value="">{t("Select a configured point", language)}</option>
                      {getConfiguredRouteStartNodes()
                        .filter(
                          (node) =>
                            node.buildingId === startBuilding &&
                            node.floor === startFloor,
                        )
                        .map((node) => (
                          <option key={node.id} value={node.id}>
                            {t(node.label, language)}
                          </option>
                        ))}
                    </select>
                    <small className="muted">
                      {t("A floor selection alone is not a precise route origin.", language)}
                    </small>
                  </div>
                </div>
                <button
                  className="primary"
                  onClick={confirmStartNode}
                  hidden={demoRouteMode}
                  disabled={
                    automaticOrigin ||
                    !getConfiguredRouteStartNodes().some(
                      (node) => node.id === pendingRouteNodeId,
                    )
                  }
                  type="button"
                >
                  {automaticOrigin ? t("Starting point detected", language) : t("Confirm starting point", language)}
                </button>
                <label className="accessible-route-toggle">
                  <input
                    type="checkbox"
                    checked={accessibleRoute}
                    onChange={(event) => setAccessibleRoute(event.target.checked)}
                  />
                  {t("Accessible route (use configured accessible connections only)", language)}
                </label>
              </section>

              <section className="card">
                <h2 className="section-title">{t("Find a Destination", language)}</h2>
                <label className="sr-only" htmlFor="destination-search">
                  {t("Search departments and facilities", language)}
                </label>
                <input
                  id="destination-search"
                  className="search"
                  placeholder={t("Search departments and facilities...", language)}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {departments.filter((item) => matchesSearch(item, search, language))
                  .length > 0 ? (
                  departments
                    .filter((item) => matchesSearch(item, search, language))
                    .map(renderDirectoryEntry)
                ) : (
                  <p className="empty">
                    {t("No departments or facilities match your search.", language)}
                  </p>
                )}
              </section>

              <section className="card">
                <h2 className="section-title">{t("Interactive 3D Hospital Map", language)}</h2>
                {demoRouteMode && (
                  <p className="demo-route-map-note" role="note">
                    {t("SAMPLE ROUTE: highlighted paths and distances are simulated examples, not surveyed hospital navigation.", language)}
                  </p>
                )}
                <p className="muted">
                  {t("The floor plan is illustrative. You can place a visual marker for reference; it is not a surveyed location and cannot be used to calculate a route.", language)}
                </p>
                <div className="row map-start-point-actions">
                  <button
                    className={placingVisualStart ? "secondary" : "primary"}
                    onClick={() => {
                      setFollowDetectedPosition(false);
                      setBuilding(activeBuildingId);
                      setFloor(activeFloor);
                      setMapViewMode("floor");
                      setPlacingVisualStart((placing) => !placing);
                    }}
                    type="button"
                  >
                    {placingVisualStart
                      ? t("Cancel placing start point", language)
                      : t("Place start point on map", language)}
                  </button>
                  {visualStartPoint && (
                    <button
                      className="secondary"
                      onClick={() => setVisualStartPoint(null)}
                      type="button"
                    >
                      {t("Clear map marker", language)}
                    </button>
                  )}
                  <span className="muted" role="status">
                    {placingVisualStart
                      ? `${t("Click an open area on", language)} ${t(buildingName(activeBuildingId), language)} · ${t(activeFloor, language)}.`
                      : visualStartPoint
                        ? `${t("Visual marker:", language)} ${t(buildingName(visualStartPoint.buildingId), language)} · ${t(visualStartPoint.floor, language)}.`
                        : t("No visual start point placed.", language)}
                  </span>
                </div>
                <div className="row">
                  <div>
                    <label htmlFor="map-building">{t("SELECT BUILDING", language)}</label>
                    <select
                      id="map-building"
                      value={activeBuildingId}
                      onChange={(event) =>
                        changeMapBuilding(event.target.value)
                      }
                    >
                      {buildings.map((item) => (
                        <option key={item.id} value={item.id}>
                          {t(item.name, language)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="map-floor">{t("SELECT FLOOR", language)}</label>
                    <select
                      id="map-floor"
                      value={activeFloor}
                      onChange={(event) => changeMapFloor(event.target.value)}
                    >
                      {currentBuilding.floors.map((item) => (
                        <option key={item} value={item}>
                          {t(item, language)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Suspense
                  fallback={
                    <div className="map3d-loading" role="status">
                      {t("Preparing interactive 3D map…", language)}
                    </div>
                  }
                >
                  <HospitalMap3D
                    buildings={buildings}
                    departments={departments}
                    selectedBuilding={activeBuildingId}
                    selectedFloor={activeFloor}
                    destination={destination}
                    viewMode={activeMapViewMode}
                    onBuildingChange={changeMapBuilding}
                    onFloorChange={changeMapFloor}
                    onSelectDestination={startNavigation}
                    onViewModeChange={(mode) => {
                      setFollowDetectedPosition(false);
                      setMapViewMode(
                        displayedRoute && mode === "building" ? "floor" : mode,
                      );
                    }}
                    currentPosition={mapPositionEstimate}
                    route={displayedRoute}
                    visualStartPoint={visualStartPoint}
                    placingVisualStart={placingVisualStart}
                    onPlaceVisualStart={(position) => {
                      setVisualStartPoint({
                        buildingId: activeBuildingId,
                        floor: activeFloor,
                        position,
                      });
                      setPlacingVisualStart(false);
                    }}
                  />
                </Suspense>
              </section>

              {destination && (
                <section className="card">
                  <div className="destination-details">
                    <div>
                      <p className="eyebrow">{t("SELECTED DESTINATION", language)}</p>
                      <h2>{t(destination.name, language)}</h2>
                      <p>
                        {t(buildingName(destination.building), language)} · {t(destination.floor, language)}{" "}
                        · {t("Room", language)} {destination.room}
                      </p>
                    </div>
                    <button
                      className="secondary"
                      onClick={stopNavigation}
                      type="button"
                    >
                      {t("Clear destination", language)}
                    </button>
                  </div>
                  <h2 className="section-title">{t("🧭 Navigation Directions", language)}</h2>
                  {route ? (
                    <>
                      <div className="route">
                        <div className="route-step">
                          <strong>{t("📍 Starting Location", language)}</strong>
                          <p>
                            {t(buildingName(startBuilding), language)} · {t(startFloor, language)}
                          </p>
                        </div>
                        {route.instructions.map((step, index) => (
                          <div className="route-step" key={`${index}-${step}`}>
                            <strong>{t("Step", language)} {index + 1}</strong>
                            <p>{translateNavigationText(step, language)}</p>
                          </div>
                        ))}
                        <div className="route-step">
                          <strong>{t("🎯 Destination", language)}</strong>
                          <p>
                            {t(destination.name, language)} · {t(buildingName(destination.building), language)}{" "}
                            · {t(destination.floor, language)} · {t("Room", language)} {destination.room}
                          </p>
                        </div>
                      </div>
                      <div className="route-summary">
                        <strong>{t("Estimated Route Distance", language)}</strong>
                        <h3>{route.distance} {t("metres", language)}</h3>
                        <small>
                          {route.source === "demo"
                            ? t("Illustrative distance from simulated route segments.", language)
                            : t("Calculated from configured surveyed route segments.", language)}
                        </small>
                      </div>
                    </>
                  ) : (
                    <p className="error" role="alert">
                      {specialRouteResult.error ?? routeError ??
                        t("No verified route is available. Configure surveyed corridor, floor-transition, and building connections, then select or confirm an exact starting point.", language)}
                    </p>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
