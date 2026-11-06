import { divIcon } from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { HospitalBuilding } from "../../data/hospitalMapData";
import {
  hospitalCampusGeofenceRadiusMetres,
  hospitalCampusReference,
  hospitalBuildingCoordinates,
  maximumUsableGPSAccuracyMetres,
  type OutdoorCoordinate,
} from "../../data/hospitalOutdoorData";
import {
  useGeolocationTracking,
  type GPSPosition,
} from "../../hooks/useGeolocationTracking";
import { useLanguage } from "../../hooks/useLanguage";

type Props = {
  buildings: HospitalBuilding[];
  onOpenIndoorNavigation: (buildingId: string) => void;
  sharedLocation?: {
    position: GPSPosition | null;
    isTracking: boolean;
    error: string | null;
    startTracking: () => void;
    stopTracking: () => void;
    geofence: {
      status: "inside" | "outside" | "uncertain";
      distanceMetres: number;
      radiusMetres: number;
    } | null;
    geofenceTransition: "entered" | "exited" | null;
  };
};

type RouteData = {
  coordinates: [number, number][];
  distance: number;
  duration: number;
};

type RouteResult = {
  key: string;
  route: RouteData | null;
  status: "ready" | "error";
  error: string;
};

type RouteResponse = {
  code: string;
  routes?: {
    geometry?: { coordinates: [number, number][] };
    distance: number;
    duration: number;
  }[];
};

const noRouteCoordinates: [number, number][] = [];

const buildingIcon = divIcon({
  className: "outdoor-building-icon",
  html: '<span aria-hidden="true">B</span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const currentLocationIcon = divIcon({
  className: "outdoor-location-icon",
  html: '<span aria-hidden="true"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const campusReferenceIcon = divIcon({
  className: "outdoor-campus-reference-icon",
  html: '<span aria-hidden="true">H</span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function distanceBetween(a: OutdoorCoordinate, b: OutdoorCoordinate) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function distanceToRoute(point: OutdoorCoordinate, route: [number, number][]) {
  let minimum = Number.POSITIVE_INFINITY;
  const latitudeScale = 111_320;
  const longitudeScale = latitudeScale * Math.cos((point.latitude * Math.PI) / 180);

  for (let index = 1; index < route.length; index += 1) {
    const [startLongitude, startLatitude] = route[index - 1];
    const [endLongitude, endLatitude] = route[index];
    const startX = (startLongitude - point.longitude) * longitudeScale;
    const startY = (startLatitude - point.latitude) * latitudeScale;
    const endX = (endLongitude - point.longitude) * longitudeScale;
    const endY = (endLatitude - point.latitude) * latitudeScale;
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const lengthSquared = segmentX ** 2 + segmentY ** 2;
    const projection =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, -(startX * segmentX + startY * segmentY) / lengthSquared),
          );
    minimum = Math.min(
      minimum,
      Math.hypot(startX + projection * segmentX, startY + projection * segmentY),
    );
  }

  return minimum;
}

function MapViewport({
  position,
  buildingCoordinates,
  routeCoordinates,
}: {
  position: GPSPosition | null;
  buildingCoordinates: OutdoorCoordinate[];
  routeCoordinates: [number, number][];
}) {
  const map = useMap();
  const hasFocusedLocation = useRef(false);
  const previousRouteCoordinates = useRef(routeCoordinates);
  useEffect(() => {
    if (position) {
      if (!hasFocusedLocation.current) {
        map.setView([position.latitude, position.longitude], 16);
        hasFocusedLocation.current = true;
      }
    } else if (buildingCoordinates.length > 0) {
      map.fitBounds(
        buildingCoordinates.map(
          (coordinate) => [coordinate.latitude, coordinate.longitude] as [number, number],
        ),
        { padding: [32, 32], maxZoom: 17 },
      );
    }
  }, [buildingCoordinates, map, position]);
  useEffect(() => {
    if (
      routeCoordinates.length > 1 &&
      routeCoordinates !== previousRouteCoordinates.current
    ) {
      map.fitBounds(routeCoordinates, { padding: [40, 40], maxZoom: 17 });
    }
    previousRouteCoordinates.current = routeCoordinates;
  }, [map, routeCoordinates]);
  return null;
}

function formatDistance(meters: number) {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

export default function OutdoorNavigation({
  buildings,
  onOpenIndoorNavigation,
  sharedLocation,
}: Props) {
  const { language, t } = useLanguage();
  const localLocation = useGeolocationTracking();
  const position = sharedLocation
    ? sharedLocation.position
    : localLocation.position;
  const isTracking = sharedLocation
    ? sharedLocation.isTracking
    : localLocation.isTracking;
  const error = sharedLocation ? sharedLocation.error : localLocation.error;
  const startTracking = sharedLocation
    ? sharedLocation.startTracking
    : localLocation.startTracking;
  const stopTracking = sharedLocation
    ? sharedLocation.stopTracking
    : localLocation.stopTracking;
  const geofence = sharedLocation?.geofence ?? null;
  const geofenceTransition = sharedLocation?.geofenceTransition ?? null;
  const [startBuilding, setStartBuilding] = useState(buildings[0]?.id ?? "");
  const [destinationBuilding, setDestinationBuilding] = useState(
    buildings[1]?.id ?? buildings[0]?.id ?? "",
  );
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [now, setNow] = useState(0);
  const routeRequestId = useRef(0);
  const routeController = useRef<AbortController | null>(null);
  const lastRerouteAt = useRef(0);
  const positionRef = useRef(position);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);
  const coordinates = useMemo(
    () =>
      buildings.flatMap((building) => {
        const coordinate = hospitalBuildingCoordinates[building.id];
        return coordinate ? [{ building, coordinate }] : [];
      }),
    [buildings],
  );
  const coordinateFor = (buildingId: string) =>
    hospitalBuildingCoordinates[buildingId] ?? null;
  const destination = coordinateFor(destinationBuilding);
  const selectedStart = coordinateFor(startBuilding);
  const hasFreshAccuratePosition = Boolean(
    position &&
      Number.isFinite(position.accuracy) &&
      position.accuracy > 0 &&
      position.accuracy <= maximumUsableGPSAccuracyMetres &&
      now >= position.timestamp &&
      now - position.timestamp <= 60_000,
  );
  const hasLiveOrigin = Boolean(
    position && isTracking && hasFreshAccuratePosition,
  );
  const routeOrigin: OutdoorCoordinate | null = hasLiveOrigin && position
    ? { latitude: position.latitude, longitude: position.longitude }
    : selectedStart;
  const locationMarker: GPSPosition | null = position;
  const routeKey = `${startBuilding}:${destinationBuilding}:${hasLiveOrigin ? "gps" : "building"}`;
  const currentRouteResult = routeResult?.key === routeKey ? routeResult : null;
  const route = currentRouteResult?.route ?? null;
  const routeStatus = currentRouteResult?.status ??
    (routeOrigin && destination ? "loading" : "idle");
  const routeError = currentRouteResult?.error ?? "";

  const requestRoute = useCallback(
    async (from: OutdoorCoordinate, to: OutdoorCoordinate, key: string) => {
      routeController.current?.abort();
      const controller = new AbortController();
      routeController.current = controller;
      const requestId = ++routeRequestId.current;
      try {
        const url =
          `https://routing.openstreetmap.de/routed-foot/route/v1/driving/` +
          `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
          "?overview=full&geometries=geojson";
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Routing service returned HTTP ${response.status}.`);
        }
        const result = (await response.json()) as RouteResponse;
        const bestRoute = result.routes?.[0];
        if (result.code !== "Ok" || !bestRoute?.geometry?.coordinates?.length) {
          throw new Error("No walking route is available for these locations.");
        }
        if (requestId !== routeRequestId.current) return;
        setRouteResult({
          key,
          route: {
            coordinates: bestRoute.geometry.coordinates.map(
              ([longitude, latitude]) => [latitude, longitude],
            ),
            distance: bestRoute.distance,
            duration: bestRoute.duration,
          },
          status: "ready",
          error: "",
        });
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        if (requestId !== routeRequestId.current) return;
        setRouteResult({
          key,
          route: null,
          status: "error",
          error: requestError instanceof Error
            ? requestError.message
            : "Unable to calculate a walking route. Please try again.",
        });
      }
    },
    [],
  );

  useEffect(() => {
    const to = hospitalBuildingCoordinates[destinationBuilding] ?? null;
    const livePosition = hasLiveOrigin ? positionRef.current : null;
    const from = livePosition
      ? { latitude: livePosition.latitude, longitude: livePosition.longitude }
      : hospitalBuildingCoordinates[startBuilding] ?? null;
    if (!to || !from) return;
    lastRerouteAt.current = Date.now();
    void requestRoute(from, to, routeKey);
  }, [
    destinationBuilding,
    hasLiveOrigin,
    requestRoute,
    routeKey,
    startBuilding,
  ]);

  useEffect(() => {
    if (
      !isTracking ||
      !position ||
      !hasFreshAccuratePosition ||
      !destination ||
      !route ||
      routeStatus !== "ready"
    ) {
      return;
    }
    const offRouteDistance = distanceToRoute(position, route.coordinates);
    const rerouteThreshold = Math.max(45, Math.min(position.accuracy * 1.5, 120));
    if (
      offRouteDistance > rerouteThreshold &&
      Date.now() - lastRerouteAt.current > 15000
    ) {
      lastRerouteAt.current = Date.now();
      void requestRoute(
        { latitude: position.latitude, longitude: position.longitude },
        destination,
        routeKey,
      );
    }
  }, [
    destination,
    hasFreshAccuratePosition,
    isTracking,
    position,
    requestRoute,
    route,
    routeKey,
    routeStatus,
  ]);

  useEffect(
    () => () => {
      routeController.current?.abort();
    },
    [],
  );

  const mapCenter = locationMarker
    ? [locationMarker.latitude, locationMarker.longitude] as [number, number]
    : coordinates[0]
      ? [coordinates[0].coordinate.latitude, coordinates[0].coordinate.longitude] as [
          number,
          number,
        ]
      : [hospitalCampusReference.latitude, hospitalCampusReference.longitude] as [
          number,
          number,
        ];
  const mapBuildingCoordinates = useMemo(
    () => coordinates.map((item) => item.coordinate),
    [coordinates],
  );
  const mapRouteCoordinates = route?.coordinates ?? noRouteCoordinates;
  const reachedDestination =
    isTracking && position && destination
      ? distanceBetween(position, destination) <=
        Math.max(20, Math.min(position.accuracy, 35))
      : false;
  const configuredBuildingCount = coordinates.length;

  return (
    <div className="outdoor-navigation">
      <section className="card">
        <div className="outdoor-heading">
          <div>
            <h2 className="section-title">{t("Live GPS Tracking", language)}</h2>
            <p className="muted">
              {t("Track your outdoor position between hospital buildings. Your browser will ask for location permission when you start.", language)}
            </p>
          </div>
          <div className="outdoor-tracking-actions">
            {!isTracking ? (
              <button className="primary" onClick={startTracking} type="button">
                {t("Start Tracking", language)}
              </button>
            ) : (
              <button className="secondary" onClick={stopTracking} type="button">
                {t("Stop Tracking", language)}
              </button>
            )}
          </div>
        </div>
        <div className="outdoor-location-status" aria-live="polite">
          <span
            className={`outdoor-status-dot${isTracking ? " is-tracking" : ""}`}
            aria-hidden="true"
          />
          <div>
            <strong>
              {isTracking
                ? position
                  ? hasFreshAccuratePosition
                    ? t("Current GPS location · Tracking", language)
                    : position.accuracy > 50
                      ? t("GPS fix · accuracy too low for campus routing", language)
                      : t("Last GPS fix · waiting for a fresh update", language)
                  : t("Waiting for GPS location…", language)
                : position
                  ? t("Last Known Location", language)
                  : t("Current Location · Not available", language)}
            </strong>
            {position ? (
              <div className="outdoor-coordinates">
                <span>Lat {position.latitude.toFixed(6)}</span>
                <span>Lon {position.longitude.toFixed(6)}</span>
                <span>Accuracy ±{Math.round(position.accuracy)} m</span>
              </div>
            ) : (
              <small>{t("Start tracking to show your coordinates and GPS accuracy.", language)}</small>
            )}
          </div>
        </div>
        <div className="outdoor-geofence-status" role="status" aria-live="polite">
          <strong>{t("Campus proximity · approximate", language)}</strong>
          <span>
            {geofence && isTracking && hasFreshAccuratePosition
              ? geofence.status === "inside"
                ? t("GPS uncertainty is within the configured {{radius}} m proximity circle. This does not confirm physical hospital entry or identify a building.", language, { radius: Math.round(geofence.radiusMetres) })
                : geofence.status === "outside"
                  ? t("Outside the configured proximity circle · {{distance}} m from its reference point.", language, { distance: Math.round(geofence.distanceMetres) })
                  : t("GPS uncertainty overlaps the circle boundary; campus proximity is uncertain.", language)
              : geofence
                ? t("Tracking is stopped or the last fix is stale; the last proximity classification is not a current location.", language)
                : position && isTracking
                ? t("A fresh GPS accuracy fix within ±{{accuracy}} m is required to classify the {{radius}} m proximity circle.", language, { accuracy: maximumUsableGPSAccuracyMetres, radius: hospitalCampusGeofenceRadiusMetres })
                : t("Waiting for a fresh GPS fix; GPS availability alone does not establish campus presence.", language)}
          </span>
          {geofenceTransition && isTracking && hasFreshAccuratePosition && (
            <small>
              {t("Confirmed geofence {{transition}} after consecutive accurate GPS fixes. This is not a hospital-entry confirmation.", language, { transition: geofenceTransition })}
            </small>
          )}
        </div>
        {error && (
          <p className="error outdoor-error" role="alert">
            {t(error, language)}
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="section-title">{t("Outdoor Building Navigation", language)}</h2>
        <p className="muted">
          {t("Use live GPS as your route origin while tracking, or choose a starting building. Walking routes use OpenStreetMap routing data.", language)}
        </p>
        <div className="row outdoor-selectors">
          <div>
            <label htmlFor="outdoor-start-building">{t("START BUILDING", language)}</label>
            <select
              id="outdoor-start-building"
              value={startBuilding}
              onChange={(event) => setStartBuilding(event.target.value)}
            >
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {t(building.name, language)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="outdoor-destination-building">{t("DESTINATION BUILDING", language)}</label>
            <select
              id="outdoor-destination-building"
              value={destinationBuilding}
              onChange={(event) => setDestinationBuilding(event.target.value)}
            >
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {t(building.name, language)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="outdoor-route-summary" aria-live="polite">
          {routeStatus === "loading" && <span>{t("Calculating walking route…", language)}</span>}
          {routeStatus === "ready" && route && (
            <>
              <strong>{formatDistance(route.distance)}</strong>
              <span>{t("Estimated walk", language)} · {formatDuration(route.duration)}</span>
              {position && (
                <small>
                  {t("GPS route updates when you move off the suggested path.", language)}
                </small>
              )}
            </>
          )}
          {routeStatus === "error" && (
            <span className="error" role="alert">
              {t(routeError, language)}
            </span>
          )}
          {routeStatus === "idle" && !destination && destinationBuilding && (
            <span>
              {t("Verified entrance coordinates are needed for the selected destination.", language)}
            </span>
          )}
          {routeStatus === "idle" && !destinationBuilding && (
            <span>{t("Select a destination building to plan a route.", language)}</span>
          )}
          {routeStatus === "idle" && destination && !routeOrigin && (
            <span>
              {position && isTracking && !hasFreshAccuratePosition
                ? t("A fresh GPS fix with accuracy of 50 m or better is required; alternatively, configure verified entrance coordinates.", language)
                : t("Start tracking or configure verified coordinates for the starting building.", language)}
            </span>
          )}
          {routeStatus === "idle" && destination && routeOrigin && (
            <span>{t("Preparing the walking route…", language)}</span>
          )}
        </div>

        {reachedDestination && (
          <div className="outdoor-arrival" role="status">
            <strong>{t("You’ve reached", language)} {t(buildings.find((item) => item.id === destinationBuilding)?.name ?? "", language)}.</strong>
            <span>{t("GPS does not determine your indoor floor.", language)}</span>
            <button
              className="secondary"
              onClick={() => onOpenIndoorNavigation(destinationBuilding)}
              type="button"
            >
              {t("Continue to indoor navigation", language)}
            </button>
          </div>
        )}

        <div className="outdoor-map-shell">
          {mapCenter ? (
            <MapContainer
              center={mapCenter}
              zoom={16}
              className="outdoor-map"
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Circle
                center={[
                  hospitalCampusReference.latitude,
                  hospitalCampusReference.longitude,
                ]}
                radius={hospitalCampusGeofenceRadiusMetres}
                pathOptions={{
                  color: "#b7791f",
                  dashArray: "6 6",
                  fillColor: "#f6ad55",
                  fillOpacity: 0.12,
                }}
              >
                <Popup>
                  <strong>{t("Approximate campus proximity area", language)}</strong>
                  <br />
                  {hospitalCampusGeofenceRadiusMetres} m around the supplied campus reference; not a surveyed property boundary or building entrance.
                </Popup>
              </Circle>
              <Marker
                position={[
                  hospitalCampusReference.latitude,
                  hospitalCampusReference.longitude,
                ]}
                icon={campusReferenceIcon}
              >
                <Popup>
                  <strong>Father Muller Medical College</strong>
                  <br />
                  {t("Supplied campus reference point · not a building entrance.", language)}
                </Popup>
              </Marker>
              <MapViewport
                position={locationMarker}
                buildingCoordinates={mapBuildingCoordinates}
                routeCoordinates={mapRouteCoordinates}
              />
              {coordinates.map(({ building, coordinate }) => (
                <Marker
                  key={building.id}
                  position={[coordinate.latitude, coordinate.longitude]}
                  icon={buildingIcon}
                >
                  <Popup>
                    <strong>{building.name}</strong>
                    <br />
                    {building.id === destinationBuilding
                      ? t("Selected destination", language)
                      : building.id === startBuilding
                        ? t("Selected starting building", language)
                        : t("Hospital building", language)}
                  </Popup>
                </Marker>
              ))}
              {locationMarker && (
                <Marker
                  position={[locationMarker.latitude, locationMarker.longitude]}
                  icon={currentLocationIcon}
                >
                  <Popup>
                    <strong>{t("Your current location", language)}</strong>
                    <br />
                    Accuracy ±{Math.round(locationMarker.accuracy)} m
                  </Popup>
                </Marker>
              )}
              {route && <Polyline positions={route.coordinates} color="#087eae" weight={5} />}
            </MapContainer>
          ) : (
            <div className="outdoor-map-placeholder">
              <span aria-hidden="true">⌖</span>
              <strong>{t("Campus reference map", language)}</strong>
              <small>
              {t("The map is centered on the supplied campus reference. Verified building entrance coordinates are still needed to display building markers and calculate building-to-building routes.", language)}
              </small>
            </div>
          )}
        </div>
        <div className="outdoor-building-list">
          {buildings.map((building) => (
            <div className="outdoor-building-item" key={building.id}>
              <span className="outdoor-building-pin" aria-hidden="true">B</span>
              <div>
                <strong>{building.name}</strong>
                <small>
                  {hospitalBuildingCoordinates[building.id]
                    ? `${hospitalBuildingCoordinates[building.id]?.latitude.toFixed(6)}, ${hospitalBuildingCoordinates[building.id]?.longitude.toFixed(6)}`
                    : t("Entrance coordinates not configured", language)}
                </small>
              </div>
              {building.id === destinationBuilding && (
                <span className="outdoor-destination-label">{t("Destination", language)}</span>
              )}
            </div>
          ))}
        </div>
        {configuredBuildingCount < buildings.length && (
          <p className="outdoor-config-note">
            {t("Add verified entrance latitude/longitude values in", language)}{" "}
            <code>src/data/hospitalOutdoorData.ts</code> to enable all building
            markers and routes. No placeholder coordinates are used.
          </p>
        )}
      </section>

      <section className="card outdoor-transition">
        <div>
          <h2 className="section-title">{t("Continue Indoors", language)}</h2>
          <p className="muted">
            {t("GPS is for outdoor positioning only. Select the floor manually for accurate indoor wayfinding; BLE or Wi-Fi positioning can be integrated separately later.", language)}
          </p>
        </div>
        <button
          className="secondary"
          onClick={() => onOpenIndoorNavigation(destinationBuilding)}
          type="button"
        >
          {t("Open 3D indoor map →", language)}
        </button>
      </section>
    </div>
  );
}
