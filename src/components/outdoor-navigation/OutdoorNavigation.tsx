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
  hospitalDestination,
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
  steps: RouteStep[];
  origin: OutdoorCoordinate;
  destination: OutdoorCoordinate;
};

type RouteStep = {
  name?: string;
  distance: number;
  duration: number;
  maneuver?: {
    instruction?: string;
    type?: string;
    modifier?: string;
  };
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
    legs?: { steps?: RouteStep[] }[];
  }[];
};

const routingProvider = "OSRM · router.project-osrm.org · driving";

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

const hospitalDestinationIcon = divIcon({
  className: "outdoor-hospital-icon",
  html: '<span aria-hidden="true">H</span>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
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
  recenterRequest,
}: {
  position: GPSPosition | null;
  buildingCoordinates: OutdoorCoordinate[];
  routeCoordinates: [number, number][];
  recenterRequest: number;
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
  useEffect(() => {
    if (recenterRequest > 0 && position) {
      map.setView([position.latitude, position.longitude], Math.max(map.getZoom(), 16));
    }
  }, [map, position, recenterRequest]);
  return null;
}

function MapActions({
  position,
  routeCoordinates,
  onRecenter,
}: {
  position: GPSPosition | null;
  routeCoordinates: [number, number][];
  onRecenter: () => void;
}) {
  const map = useMap();
  const { language, t } = useLanguage();
  return (
    <div className="outdoor-map-actions" aria-label={t("Map controls", language)}>
      <button type="button" onClick={() => map.zoomIn()} aria-label={t("Zoom in", language)}>+</button>
      <button type="button" onClick={() => map.zoomOut()} aria-label={t("Zoom out", language)}>−</button>
      <button
        type="button"
        onClick={() => {
          onRecenter();
          if (position) map.setView([position.latitude, position.longitude], 16);
          else if (routeCoordinates.length > 1) map.fitBounds(routeCoordinates, { padding: [40, 40] });
        }}
      >
        {t("Recenter Map", language)}
      </button>
    </div>
  );
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

function getStepInstruction(
  step: RouteStep,
  translate: (key: string) => string,
) {
  const type = step.maneuver?.type;
  const modifier = step.maneuver?.modifier;
  const road = step.name;
  if (type === "depart") {
    return road
      ? `${translate("Start on")} ${road}`
      : modifier
        ? `${translate("Start by heading")} ${modifier}`
        : translate("Start driving toward the hospital");
  }
  if (type === "arrive") return translate("Arrive at Father Muller Medical College Hospital");
  const action =
    type === "turn"
      ? `${translate("Turn")} ${modifier ?? ""}`.trim()
      : type === "continue"
        ? translate("Continue")
        : type === "roundabout"
          ? translate("Enter the roundabout")
          : type
            ? type.replaceAll("-", " ")
            : translate("Continue");
  return road ? `${action} ${translate("onto")} ${road}` : action;
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
  const [destinationBuilding, setDestinationBuilding] = useState(
    buildings[0]?.id ?? "",
  );
  const [navigationActive, setNavigationActive] = useState(false);
  const [recenterRequest, setRecenterRequest] = useState(0);
  const [tileError, setTileError] = useState(false);
  const [routeRetryToken, setRouteRetryToken] = useState(0);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [now, setNow] = useState(() => Date.now());
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
  const destination = hospitalDestination.coordinate;
  const hasFreshAccuratePosition = Boolean(
    position &&
      Number.isFinite(position.accuracy) &&
      position.accuracy > 0 &&
      position.accuracy <= maximumUsableGPSAccuracyMetres &&
      now >= position.timestamp &&
      now - position.timestamp <= 60_000,
  );
  const hasLiveOrigin = Boolean(
    position &&
      isTracking &&
    now >= position.timestamp &&
    now - position.timestamp <= 60_000,
  );
  const routeOrigin: OutdoorCoordinate | null = hasLiveOrigin && position
    ? { latitude: position.latitude, longitude: position.longitude }
    : null;
  const locationMarker: GPSPosition | null = position;
  const routeKey = `${navigationActive ? "active" : "inactive"}:${hasLiveOrigin ? "gps" : "none"}`;
  const currentRouteResult = routeResult?.key === routeKey ? routeResult : null;
  const route = currentRouteResult?.route ?? null;
  const routeStatus = currentRouteResult?.status ??
    (navigationActive && routeOrigin && destination ? "loading" : "idle");
  const routeError = currentRouteResult?.error ?? "";

  const requestRoute = useCallback(
    async (from: OutdoorCoordinate, to: OutdoorCoordinate, key: string) => {
      routeController.current?.abort();
      const controller = new AbortController();
      routeController.current = controller;
      const requestId = ++routeRequestId.current;
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
          "?overview=full&geometries=geojson&steps=true";
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error("Outdoor route service is unavailable. Please try again or open Google Maps.");
        }
        const result = (await response.json()) as RouteResponse;
        const bestRoute = result.routes?.[0];
        if (result.code !== "Ok" || !bestRoute?.geometry?.coordinates?.length) {
          throw new Error("No road route is available from your current location to the hospital.");
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
            steps: bestRoute.legs?.flatMap((leg) => leg.steps ?? []) ?? [],
            origin: from,
            destination: to,
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
            : "Unable to calculate an outdoor road route. Please try again.",
        });
      }
    },
    [],
  );

  useEffect(() => {
    const to = hospitalDestination.coordinate;
    const livePosition = hasLiveOrigin ? positionRef.current : null;
    const from = livePosition
      ? { latitude: livePosition.latitude, longitude: livePosition.longitude }
      : null;
    if (!navigationActive || !from) return;
    lastRerouteAt.current = Date.now();
    void requestRoute(from, to, routeKey);
  }, [
    destinationBuilding,
    hasLiveOrigin,
    navigationActive,
    requestRoute,
    routeKey,
    routeRetryToken,
  ]);

  useEffect(() => {
    if (
      !isTracking ||
      !position ||
      !hasFreshAccuratePosition ||
      !destination ||
      !route ||
      routeStatus !== "ready" ||
      !navigationActive
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
    navigationActive,
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

  const nextStep = route?.steps.find(
    (step) => step.distance > 0 && step.maneuver?.type !== "arrive",
  );
  const nextInstruction = nextStep
    ? getStepInstruction(nextStep, (key) => t(key, language))
    : null;
  const googleOrigin = route?.origin ?? routeOrigin;
  const googleMapsUrl = googleOrigin
    ? `https://www.google.com/maps/dir/?api=1&origin=${googleOrigin.latitude},${googleOrigin.longitude}&destination=${hospitalDestination.coordinate.latitude},${hospitalDestination.coordinate.longitude}&travelmode=driving`
    : null;

  const startNavigation = () => {
    setNavigationActive(true);
    startTracking();
  };

  const stopNavigation = () => {
    setNavigationActive(false);
    setRouteResult(null);
    stopTracking();
  };

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
            <button className="primary" onClick={startTracking} type="button">
              {t("Find My Location", language)}
            </button>
            {isTracking && (
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
          {t("Navigate from your current GPS location to Father Muller Medical College Hospital using OpenStreetMap road data.", language)}
        </p>
        <div className="outdoor-destination-card">
          <strong>{t(hospitalDestination.name, language)}</strong>
          <span>{t(hospitalDestination.address, language)}</span>
        </div>
        <div className="row outdoor-selectors">
          <div>
            <label htmlFor="outdoor-destination-building">{t("Building to visit after arrival", language)}</label>
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
            <small className="field-help">
              {t("First follow the road route to the hospital. Then choose the building for indoor directions.", language)}
            </small>
          </div>
          <div className="outdoor-tracking-actions">
            <button className="primary" type="button" onClick={startNavigation}>
              {t("Navigate to Hospital", language)}
            </button>
            <button className="secondary" type="button" onClick={() => setRecenterRequest((value) => value + 1)}>
              {t("Recenter Map", language)}
            </button>
            {navigationActive && (
              <button className="secondary" type="button" onClick={stopNavigation}>
                {t("Stop Navigation", language)}
              </button>
            )}
            {googleMapsUrl ? (
              <a
                className="secondary"
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t("Open in Google Maps", language)}
              </a>
            ) : (
              <button className="secondary" type="button" disabled>
                {t("Open in Google Maps", language)}
              </button>
            )}
          </div>
        </div>

        <div className="outdoor-route-summary" aria-live="polite">
          {routeStatus === "loading" && <span>{t("Calculating driving route…", language)}</span>}
          {routeStatus === "ready" && route && (
            <>
              <strong>{formatDistance(route.distance)}</strong>
              <span>{t("Estimated driving time", language)} · {formatDuration(route.duration)}</span>
              {nextInstruction && (
                <small><strong>{t("Next direction", language)}:</strong> {nextInstruction}</small>
              )}
              {position && (
                <small>
                  {t("GPS route updates when you move off the suggested path.", language)}
                </small>
              )}
            </>
          )}
          {routeStatus === "error" && (
            <div className="outdoor-route-error">
              <span className="error" role="alert">{t(routeError, language)}</span>
              <button
                className="secondary"
                type="button"
                onClick={() => setRouteRetryToken((value) => value + 1)}
              >
                {t("Retry road route", language)}
              </button>
            </div>
          )}
          {routeStatus === "idle" && destination && !routeOrigin && (
            <span>
              {position && isTracking && !hasFreshAccuratePosition
                ? t("A fresh GPS fix with accuracy of 50 m or better is required; alternatively, configure verified entrance coordinates.", language)
                : t("Find your location to plan a road route to the hospital.", language)}
            </span>
          )}
          {routeStatus === "idle" && destination && routeOrigin && (
            <span>{t("Preparing the driving route…", language)}</span>
          )}
        </div>
        <details className="outdoor-debug">
          <summary>{t("Routing details", language)}</summary>
          <dl>
            <dt>{t("Starting latitude", language)}</dt>
            <dd>{route?.origin.latitude ?? routeOrigin?.latitude ?? "—"}</dd>
            <dt>{t("Starting longitude", language)}</dt>
            <dd>{route?.origin.longitude ?? routeOrigin?.longitude ?? "—"}</dd>
            <dt>{t("Destination latitude", language)}</dt>
            <dd>{hospitalDestination.coordinate.latitude}</dd>
            <dt>{t("Destination longitude", language)}</dt>
            <dd>{hospitalDestination.coordinate.longitude}</dd>
            <dt>{t("Routing API", language)}</dt>
            <dd>{routingProvider}</dd>
            <dt>{t("Road distance", language)}</dt>
            <dd>{route ? formatDistance(route.distance) : "—"}</dd>
            <dt>{t("Estimated duration", language)}</dt>
            <dd>{route ? formatDuration(route.duration) : "—"}</dd>
            <dt>{t("Routing error", language)}</dt>
            <dd>{routeError || t("None", language)}</dd>
          </dl>
        </details>

        {reachedDestination && (
          <div className="outdoor-arrival" role="status">
            <strong>{t("You’ve reached", language)} {t(hospitalDestination.name, language)}.</strong>
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
                eventHandlers={{
                  load: () => setTileError(false),
                  tileerror: () => setTileError(true),
                }}
              />
              {tileError && (
                <div className="outdoor-map-error" role="alert">
                  {t("OpenStreetMap map tiles are unavailable. Check your internet connection and try again.", language)}
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => setTileError(false)}
                  >
                    {t("Retry map", language)}
                  </button>
                </div>
              )}
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
                  hospitalDestination.coordinate.latitude,
                  hospitalDestination.coordinate.longitude,
                ]}
                icon={hospitalDestinationIcon}
              >
                <Popup>
                  <strong>{t(hospitalDestination.name, language)}</strong>
                  <br />
                  {t(hospitalDestination.address, language)}
                </Popup>
              </Marker>
              <MapViewport
                position={locationMarker}
                buildingCoordinates={mapBuildingCoordinates}
                routeCoordinates={mapRouteCoordinates}
                recenterRequest={recenterRequest}
              />
              <MapActions
                position={locationMarker}
                routeCoordinates={mapRouteCoordinates}
                onRecenter={() => setRecenterRequest((value) => value + 1)}
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
