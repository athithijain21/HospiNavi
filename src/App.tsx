import { lazy, Suspense, useMemo, useState } from "react";
import "./App.css";
import {
  hospitalBuildings as buildings,
  hospitalDepartments as departments,
  type HospitalDepartment as Department,
} from "./data/hospitalMapData";
import type { MapViewMode } from "./components/hospital-map/HospitalMap3D";

const HospitalMap3D = lazy(
  () => import("./components/hospital-map/HospitalMap3D"),
);

type Edge = {
  from: string;
  to: string;
  distance: number;
  forwardInstruction: string;
  reverseInstruction: string;
};

type Tab = "Dashboard" | "Indoor Navigation" | "Departments" | "Facilities";

const corridor = (building: string, floor: string) =>
  `corridor-${building}-${floor}`;
const departmentNode = (id: number) => `department-${id}`;

function createHospitalGraph(): Edge[] {
  const edges: Edge[] = [];

  buildings.forEach((building) => {
    building.floors.forEach((floor, index) => {
      const nextFloor = building.floors[index + 1];
      if (!nextFloor) return;

      edges.push({
        from: corridor(building.id, floor),
        to: corridor(building.id, nextFloor),
        distance: 20,
        forwardInstruction: `Take the lift from ${floor} to ${nextFloor} in the ${building.name}.`,
        reverseInstruction: `Take the lift from ${nextFloor} to ${floor} in the ${building.name}.`,
      });
      edges.push({
        from: corridor(building.id, floor),
        to: corridor(building.id, nextFloor),
        distance: 30,
        forwardInstruction: `Use the stairs from ${floor} to ${nextFloor} in the ${building.name}.`,
        reverseInstruction: `Use the stairs from ${nextFloor} to ${floor} in the ${building.name}.`,
      });
    });
  });

  const connections: [string, string][] = [
    ["A", "B"],
    ["A", "C"],
    ["A", "D"],
    ["B", "C"],
    ["C", "D"],
  ];

  connections.forEach(([from, to]) => {
    const fromBuilding = buildings.find((building) => building.id === from);
    const toBuilding = buildings.find((building) => building.id === to);
    if (!fromBuilding || !toBuilding) return;

    edges.push({
      from: corridor(from, "Ground Floor"),
      to: corridor(to, "Ground Floor"),
      distance: 35,
      forwardInstruction: `Walk from the ${fromBuilding.name} to the ${toBuilding.name} using the connecting walkway.`,
      reverseInstruction: `Walk from the ${toBuilding.name} to the ${fromBuilding.name} using the connecting walkway.`,
    });
  });

  departments.forEach((department) => {
    edges.push({
      from: corridor(department.building, department.floor),
      to: departmentNode(department.id),
      distance: 10,
      forwardInstruction: `Follow the corridor to ${department.name}, Room ${department.room}.`,
      reverseInstruction: `Leave ${department.name}, Room ${department.room}, and return to the corridor.`,
    });
  });

  return edges;
}

function findShortestRoute(
  startBuilding: string,
  startFloor: string,
  destinationId: number,
) {
  const edges = createHospitalGraph();
  const start = corridor(startBuilding, startFloor);
  const end = departmentNode(destinationId);
  const nodes = new Set<string>();

  edges.forEach(({ from, to }) => {
    nodes.add(from);
    nodes.add(to);
  });

  if (!nodes.has(start) || !nodes.has(end)) return null;

  const distances = new Map<string, number>();
  const previous = new Map<string, string>();
  const previousInstruction = new Map<string, string>();
  const unvisited = new Set(nodes);
  nodes.forEach((node) => distances.set(node, Number.POSITIVE_INFINITY));
  distances.set(start, 0);

  while (unvisited.size > 0) {
    let current: string | undefined;
    for (const node of unvisited) {
      if (
        current === undefined ||
        (distances.get(node) ?? Number.POSITIVE_INFINITY) <
          (distances.get(current) ?? Number.POSITIVE_INFINITY)
      ) {
        current = node;
      }
    }

    if (
      current === undefined ||
      (distances.get(current) ?? Number.POSITIVE_INFINITY) ===
        Number.POSITIVE_INFINITY
    ) {
      break;
    }
    if (current === end) break;

    unvisited.delete(current);
    edges.forEach((edge) => {
      const isForward = edge.from === current;
      const neighbor = isForward
        ? edge.to
        : edge.to === current
          ? edge.from
          : undefined;
      if (!neighbor || !unvisited.has(neighbor)) return;

      const distance =
        (distances.get(current) ?? Number.POSITIVE_INFINITY) + edge.distance;
      if (distance < (distances.get(neighbor) ?? Number.POSITIVE_INFINITY)) {
        distances.set(neighbor, distance);
        previous.set(neighbor, current);
        previousInstruction.set(
          neighbor,
          isForward ? edge.forwardInstruction : edge.reverseInstruction,
        );
      }
    });
  }

  const distance = distances.get(end) ?? Number.POSITIVE_INFINITY;
  if (distance === Number.POSITIVE_INFINITY) return null;

  const instructions: string[] = [];
  let current: string | undefined = end;
  while (current && current !== start) {
    const instruction = previousInstruction.get(current);
    current = previous.get(current);
    if (!instruction || !current) return null;
    instructions.unshift(instruction);
  }

  return { instructions, distance };
}

function buildingName(buildingId: string) {
  return buildings.find((building) => building.id === buildingId)?.name ??
    `Building ${buildingId}`;
}

function matchesSearch(department: Department, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    department.name,
    department.category,
    department.room,
    department.floor,
    buildingName(department.building),
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

const navigationTabs: Tab[] = [
  "Dashboard",
  "Indoor Navigation",
  "Departments",
  "Facilities",
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("Dashboard");
  const [building, setBuilding] = useState("A");
  const [floor, setFloor] = useState("Ground Floor");
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>("building");
  const [startBuilding, setStartBuilding] = useState("A");
  const [startFloor, setStartFloor] = useState("Ground Floor");
  const [search, setSearch] = useState("");
  const [destination, setDestination] = useState<Department | null>(null);
  const [gpsPosition, setGpsPosition] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");

  const currentBuilding =
    buildings.find((item) => item.id === building) ?? buildings[0];
  const startingBuilding =
    buildings.find((item) => item.id === startBuilding) ?? buildings[0];
  const filteredDepartments = departments.filter(
    (item) => item.category !== "Facility" && matchesSearch(item, search),
  );
  const filteredFacilities = departments.filter(
    (item) => item.category === "Facility" && matchesSearch(item, search),
  );
  const route = useMemo(
    () =>
      destination
        ? findShortestRoute(startBuilding, startFloor, destination.id)
        : null,
    [destination, startBuilding, startFloor],
  );

  const detectMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setGpsError("Geolocation is not supported by this browser.");
      return;
    }

    setGpsLoading(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setGpsLoading(false);
      },
      (error) => {
        setGpsLoading(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsError("Please allow location access in your browser settings.");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setGpsError("Your location is currently unavailable. Please try again.");
        } else {
          setGpsError("Location request timed out. Please try again.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const startNavigation = (department: Department) => {
    setDestination(department);
    setBuilding(department.building);
    setFloor(department.floor);
    setMapViewMode("floor");
    setActiveTab("Indoor Navigation");
  };

  const stopNavigation = () => setDestination(null);

  const changeStartBuilding = (id: string) => {
    const nextBuilding = buildings.find((item) => item.id === id);
    if (!nextBuilding) return;
    setStartBuilding(id);
    setStartFloor(nextBuilding.floors[0]);
  };

  const changeMapBuilding = (id: string) => {
    const nextBuilding = buildings.find((item) => item.id === id);
    if (!nextBuilding) return;
    setBuilding(id);
    setFloor(nextBuilding.floors[0]);
    if (destination && destination.building !== id) setDestination(null);
  };

  const renderDirectoryEntry = (department: Department) => (
    <div className="department" key={department.id}>
      <div className="department-info">
        <span className="department-icon" aria-hidden="true">
          {department.icon}
        </span>
        <div>
          <strong>{department.name}</strong>
          <small>
            {buildingName(department.building)} · {department.floor} · Room{" "}
            {department.room}
          </small>
        </div>
      </div>
      <button
        className="primary"
        onClick={() => startNavigation(department)}
        type="button"
      >
        Navigate →
      </button>
    </div>
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          ✚ HospiNav
          <small>SMART HOSPITAL GUIDE</small>
        </div>

        <div className="menu-title">MAIN MENU</div>
        <nav className="menu" aria-label="Main navigation">
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
                {item === "Departments" && "▤"}
                {item === "Facilities" && "♧"}
              </span>
              {item}
            </button>
          ))}
        </nav>

        <div className="help">
          <strong>Need Assistance?</strong>
          <p>Find your way around the hospital easily.</p>
          <button
            className="primary"
            onClick={() => setActiveTab("Indoor Navigation")}
            type="button"
          >
            Open Navigation →
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{activeTab}</h1>
            <small>HospiNav / {activeTab}</small>
          </div>
          <span className="online">
            <span aria-hidden="true">●</span> System Online
          </span>
        </header>

        <div className="content">
          {activeTab === "Dashboard" && (
            <>
              <section className="welcome">
                <div>
                  <small>WELCOME TO HOSPINAV</small>
                  <h2>Find your way around the hospital.</h2>
                  <p>
                    Search departments, explore facilities, and get directions
                    between hospital blocks.
                  </p>
                  <button
                    className="welcome-button"
                    onClick={() => setActiveTab("Indoor Navigation")}
                    type="button"
                  >
                    Start navigating →
                  </button>
                </div>
                <span className="welcome-icon" aria-hidden="true">
                  ✚
                </span>
              </section>

              <section className="bottom-grid" aria-label="Hospital overview">
                <div className="card stat-card">
                  <span>Total Buildings</span>
                  <strong>{buildings.length}</strong>
                  <small>Hospital blocks</small>
                </div>
                <div className="card stat-card">
                  <span>Departments</span>
                  <strong>
                    {departments.filter((item) => item.category !== "Facility")
                      .length}
                  </strong>
                  <small>Across all buildings</small>
                </div>
                <div className="card stat-card">
                  <span>Facilities</span>
                  <strong>
                    {departments.filter((item) => item.category === "Facility")
                      .length}
                  </strong>
                  <small>Available to visitors</small>
                </div>
                <div className="card stat-card">
                  <span>Hospital Floors</span>
                  <strong>
                    {buildings.reduce(
                      (total, item) => total + item.floors.length,
                      0,
                    )}
                  </strong>
                  <small>Across four buildings</small>
                </div>
              </section>

              <section className="card">
                <h2 className="section-title">Quick access</h2>
                <div className="quick-access">
                  <button
                    onClick={() => setActiveTab("Departments")}
                    type="button"
                  >
                    Browse departments
                  </button>
                  <button
                    onClick={() => setActiveTab("Facilities")}
                    type="button"
                  >
                    Find a facility
                  </button>
                  <button
                    onClick={() => setActiveTab("Indoor Navigation")}
                    type="button"
                  >
                    Explore floor map
                  </button>
                </div>
              </section>
            </>
          )}

          {activeTab === "Departments" && (
            <section className="card">
              <h2 className="section-title">Hospital Departments</h2>
              <label className="sr-only" htmlFor="department-search">
                Search departments
              </label>
              <input
                id="department-search"
                className="search"
                placeholder="Search departments, buildings, floors, or rooms..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {filteredDepartments.length > 0 ? (
                filteredDepartments.map(renderDirectoryEntry)
              ) : (
                <p className="empty">No departments match your search.</p>
              )}
            </section>
          )}

          {activeTab === "Facilities" && (
            <section className="card">
              <h2 className="section-title">Hospital Facilities</h2>
              <label className="sr-only" htmlFor="facility-search">
                Search facilities
              </label>
              <input
                id="facility-search"
                className="search"
                placeholder="Search facilities, buildings, floors, or rooms..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {filteredFacilities.length > 0 ? (
                filteredFacilities.map(renderDirectoryEntry)
              ) : (
                <p className="empty">No facilities match your search.</p>
              )}
            </section>
          )}

          {activeTab === "Indoor Navigation" && (
            <>
              <section className="card">
                <h2 className="section-title">Indoor Navigation</h2>
                <p className="muted">
                  Choose your starting point and destination to view
                  wayfinding instructions.
                </p>
                <div className="gps-box">
                  <div>
                    <strong>📍 Your Current Location</strong>
                    {gpsPosition ? (
                      <>
                        <p>Latitude: {gpsPosition.latitude.toFixed(6)}</p>
                        <p>Longitude: {gpsPosition.longitude.toFixed(6)}</p>
                      </>
                    ) : (
                      <p>Location not detected</p>
                    )}
                    <p className="gps-note">
                      GPS provides outdoor coordinates only; it cannot identify
                      your indoor building or floor.
                    </p>
                    {gpsError && (
                      <p className="error" role="alert">
                        {gpsError}
                      </p>
                    )}
                  </div>
                  <button
                    className="primary"
                    onClick={detectMyLocation}
                    disabled={gpsLoading}
                    type="button"
                  >
                    {gpsLoading ? "Detecting..." : "Detect My Location"}
                  </button>
                </div>
              </section>

              <section className="card">
                <h2 className="section-title">Select Starting Location</h2>
                <div className="row">
                  <div>
                    <label htmlFor="start-building">START BUILDING</label>
                    <select
                      id="start-building"
                      value={startBuilding}
                      onChange={(event) =>
                        changeStartBuilding(event.target.value)
                      }
                    >
                      {buildings.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="start-floor">START FLOOR</label>
                    <select
                      id="start-floor"
                      value={startFloor}
                      onChange={(event) => setStartFloor(event.target.value)}
                    >
                      {startingBuilding.floors.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className="card">
                <h2 className="section-title">Find a Destination</h2>
                <label className="sr-only" htmlFor="destination-search">
                  Search departments and facilities
                </label>
                <input
                  id="destination-search"
                  className="search"
                  placeholder="Search departments and facilities..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {departments.filter((item) => matchesSearch(item, search))
                  .length > 0 ? (
                  departments
                    .filter((item) => matchesSearch(item, search))
                    .map(renderDirectoryEntry)
                ) : (
                  <p className="empty">
                    No departments or facilities match your search.
                  </p>
                )}
              </section>

              <section className="card">
                <h2 className="section-title">Interactive 3D Hospital Map</h2>
                <div className="row">
                  <div>
                    <label htmlFor="map-building">SELECT BUILDING</label>
                    <select
                      id="map-building"
                      value={building}
                      onChange={(event) =>
                        changeMapBuilding(event.target.value)
                      }
                    >
                      {buildings.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="map-floor">SELECT FLOOR</label>
                    <select
                      id="map-floor"
                      value={floor}
                      onChange={(event) => setFloor(event.target.value)}
                    >
                      {currentBuilding.floors.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Suspense
                  fallback={
                    <div className="map3d-loading" role="status">
                      Preparing interactive 3D map…
                    </div>
                  }
                >
                  <HospitalMap3D
                    buildings={buildings}
                    departments={departments}
                    selectedBuilding={building}
                    selectedFloor={floor}
                    startBuilding={startBuilding}
                    startFloor={startFloor}
                    destination={destination}
                    viewMode={mapViewMode}
                    onBuildingChange={changeMapBuilding}
                    onFloorChange={(nextFloor) => {
                      setFloor(nextFloor);
                      if (destination && destination.floor !== nextFloor) {
                        setDestination(null);
                      }
                    }}
                    onSelectDestination={startNavigation}
                    onViewModeChange={setMapViewMode}
                  />
                </Suspense>
              </section>

              {destination && (
                <section className="card">
                  <div className="destination-details">
                    <div>
                      <p className="eyebrow">SELECTED DESTINATION</p>
                      <h2>{destination.name}</h2>
                      <p>
                        {buildingName(destination.building)} · {destination.floor}{" "}
                        · Room {destination.room}
                      </p>
                    </div>
                    <button
                      className="secondary"
                      onClick={stopNavigation}
                      type="button"
                    >
                      Clear destination
                    </button>
                  </div>
                  <h2 className="section-title">🧭 Navigation Directions</h2>
                  {route ? (
                    <>
                      <div className="route">
                        <div className="route-step">
                          <strong>📍 Starting Location</strong>
                          <p>
                            {buildingName(startBuilding)} · {startFloor}
                          </p>
                        </div>
                        {route.instructions.map((step, index) => (
                          <div className="route-step" key={`${index}-${step}`}>
                            <strong>Step {index + 1}</strong>
                            <p>{step}</p>
                          </div>
                        ))}
                        <div className="route-step">
                          <strong>🎯 Destination</strong>
                          <p>
                            {destination.name} · {buildingName(destination.building)}{" "}
                            · {destination.floor} · Room {destination.room}
                          </p>
                        </div>
                      </div>
                      <div className="route-summary">
                        <strong>Estimated Route Distance</strong>
                        <h3>{route.distance} metres</h3>
                        <small>
                          Demonstration estimate, not a measured real-world
                          distance.
                        </small>
                      </div>
                    </>
                  ) : (
                    <p className="error" role="alert">
                      No route is available from the selected starting
                      location.
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
