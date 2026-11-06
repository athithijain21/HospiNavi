import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { HospitalBuilding } from "../data/hospitalMapData";
import { bleBeaconDatabase } from "../data/bleBeaconData";
import {
  hospitalBuildingGeofences,
  maximumUsableGPSAccuracyMetres,
} from "../data/hospitalOutdoorData";
import type { useIndoorPosition } from "./useIndoorPosition";
import { useGeolocationTracking } from "./useGeolocationTracking";
import {
  getNativeBLEScannerAdapter,
} from "../services/blePositioningService";
import {
  createHospitalGeofenceTracker,
  gpsPositioningService,
} from "../services/gpsPositioningService";
import { positionMapMatchingService } from "../services/positionMapMatchingService";
import type { IndoorPositionEstimate } from "../services/indoorPositioningService";
import { hospitalRouteGraph } from "../data/hospitalRouteGraphData";

type Props = {
  buildings: HospitalBuilding[];
  indoorPosition: IndoorPositionEstimate | null;
  indoorPositioning: ReturnType<typeof useIndoorPosition>;
};

export function useAutomaticPosition({
  buildings,
  indoorPosition,
  indoorPositioning,
}: Props) {
  const gps = useGeolocationTracking(true);
  const [now, setNow] = useState(0);
  const [geofenceTracker] = useState(createHospitalGeofenceTracker);
  const geofenceSnapshot = useSyncExternalStore(
    geofenceTracker.subscribe,
    geofenceTracker.getSnapshot,
    geofenceTracker.getSnapshot,
  );
  const nativeAdapter = useMemo(
    () => getNativeBLEScannerAdapter(bleBeaconDatabase),
    [],
  );
  const configuredGeofences = hospitalBuildingGeofences;
  const startBLE = indoorPositioning.startBLE;

  useEffect(() => {
    if (!nativeAdapter || bleBeaconDatabase.length === 0) return;
    void startBLE(nativeAdapter);
  }, [nativeAdapter, startBLE]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    geofenceTracker.update(gps.position, configuredGeofences);
  }, [configuredGeofences, geofenceTracker, gps.position]);

  const geofence = geofenceSnapshot.match;
  const indoorMatch = useMemo(
    () =>
      positionMapMatchingService.matchIndoorPositionToRouteNode(
        indoorPosition,
        hospitalRouteGraph,
        0.72,
        now,
      ),
    [indoorPosition, now],
  );
  const gpsMatch = useMemo(
    () =>
      indoorMatch
        ? null
        : positionMapMatchingService.matchGPSPositionToRouteNode(
            gps.position,
            hospitalRouteGraph,
            gpsPositioningService.maximumIndoorMatchAccuracyMetres,
            30,
            now,
          ),
    [gps.position, indoorMatch, now],
  );
  const matchedPosition = indoorMatch ?? gpsMatch;
  const gpsFixIsFresh = Boolean(
    gps.position &&
      now >= gps.position.timestamp &&
      now - gps.position.timestamp <= 60_000,
  );
  const detectedBuilding = matchedPosition
    ? buildings.find((building) => building.id === matchedPosition.node.buildingId)
    : geofence?.buildingId
      ? buildings.find((building) => building.id === geofence.buildingId)
      : undefined;
  let status: string;
  if (matchedPosition?.source === "ble" || matchedPosition?.source === "wifi") {
    status = `Indoor location detected · Building ${matchedPosition.node.buildingId} · ${matchedPosition.node.floor}`;
  } else if (matchedPosition?.source === "gps") {
    status = `Outdoor GPS matched to ${matchedPosition.node.label} · Building ${matchedPosition.node.buildingId}`;
  } else if (gps.isTracking && !gps.position) {
    status = "Detecting your location…";
  } else if (gps.isTracking && gps.position && !gpsFixIsFresh) {
    status = "Waiting for a fresh GPS location fix";
  } else if (gps.position && !gps.isTracking) {
    status = gps.error
      ? "GPS tracking stopped · showing the last known fix"
      : "GPS tracking stopped · last fix is not a live location";
  } else if (
    gps.position &&
    !geofence &&
    gps.position.accuracy > maximumUsableGPSAccuracyMetres
  ) {
    status = `GPS available · accuracy ±${Math.round(gps.position.accuracy)} m is too low to classify campus proximity`;
  } else if (geofence?.status === "inside") {
    status = `GPS places you within the approximate ${geofence.name} (${Math.round(geofence.radiusMetres)} m radius); this does not confirm physical entry or a building`;
  } else if (geofence?.status === "outside") {
    status = `GPS places you outside the approximate ${geofence.name} (${Math.round(geofence.distanceMetres)} m from its reference point)`;
  } else if (geofence?.status === "uncertain") {
    status = `GPS accuracy overlaps the approximate campus boundary; entry is unconfirmed (±${Math.round(gps.position?.accuracy ?? 0)} m)`;
  } else if (gps.position && configuredGeofences.length === 0) {
    status = "GPS available · no hospital proximity area is configured";
  } else if (gps.position) {
    status = "GPS available · waiting for a fresh, accurate fix to classify campus proximity";
  } else if (indoorPositioning.status === "scanning") {
    status = "Detecting indoor location…";
  } else if (indoorPositioning.status === "low-confidence") {
    status = "Waiting for a reliable indoor location";
  } else if (indoorPositioning.error) {
    status = "Indoor positioning unavailable";
  } else {
    status = "Waiting for a reliable location";
  }

  return {
    gpsPosition: gps.position,
    gpsTracking: gps.isTracking,
    gpsError: gps.error ?? "",
    retryGPS: gps.startTracking,
    stopGPS: gps.stopTracking,
    geofence,
    geofenceTransition: geofenceSnapshot.transition,
    indoorMatch,
    gpsMatch,
    matchedPosition,
    detectedBuilding,
    status,
    confidenceLabel: matchedPosition
      ? matchedPosition.confidence >= 0.85
        ? "High"
        : matchedPosition.confidence >=
            (matchedPosition.source === "gps" ? 0.65 : 0.72)
          ? "Medium"
          : "Low"
      : "Low",
    hasAutomaticIndoorAdapter: nativeAdapter !== null,
    hasConfiguredGeofences: configuredGeofences.length > 0,
  };
}
