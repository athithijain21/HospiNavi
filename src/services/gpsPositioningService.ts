import {
  hospitalBuildingGeofences,
  maximumUsableGPSAccuracyMetres,
  type HospitalGeofence,
  type OutdoorCoordinate,
} from "../data/hospitalOutdoorData";

export type GPSFix = OutdoorCoordinate & {
  accuracy: number;
  timestamp: number;
};

export type GeofenceMatch = {
  geofenceId: string;
  name: string;
  buildingId?: string;
  distanceMetres: number;
  radiusMetres: number;
  confidence: number;
  status: "inside" | "outside" | "uncertain";
};

export function distanceMetres(left: OutdoorCoordinate, right: OutdoorCoordinate) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(left.latitude)) *
      Math.cos(radians(right.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function matchHospitalGeofence(
  fix: GPSFix,
  geofences: HospitalGeofence[] = hospitalBuildingGeofences,
  maximumAccuracyMetres = maximumUsableGPSAccuracyMetres,
  now = Date.now(),
): GeofenceMatch | null {
  if (
    !Number.isFinite(fix.latitude) ||
    fix.latitude < -90 ||
    fix.latitude > 90 ||
    !Number.isFinite(fix.longitude) ||
    fix.longitude < -180 ||
    fix.longitude > 180 ||
    !Number.isFinite(fix.timestamp) ||
    now < fix.timestamp ||
    now - fix.timestamp > 60_000 ||
    !Number.isFinite(fix.accuracy) ||
    fix.accuracy <= 0 ||
    fix.accuracy > maximumAccuracyMetres
  ) {
    return null;
  }
  const nearest = geofences
    .filter(
      (geofence) =>
        Number.isFinite(geofence.radiusMetres) &&
        geofence.radiusMetres > 0 &&
        Number.isFinite(geofence.center.latitude) &&
        geofence.center.latitude >= -90 &&
        geofence.center.latitude <= 90 &&
        Number.isFinite(geofence.center.longitude) &&
        geofence.center.longitude >= -180 &&
        geofence.center.longitude <= 180,
    )
    .map((geofence) => ({
      geofenceId: geofence.id,
      name: geofence.name,
      buildingId: geofence.buildingId,
      distanceMetres: distanceMetres(fix, geofence.center),
      radiusMetres: geofence.radiusMetres,
      accuracy: fix.accuracy,
    }))
    .sort((left, right) => left.distanceMetres - right.distanceMetres)[0];
  if (!nearest) return null;
  const status =
    nearest.distanceMetres + nearest.accuracy <= nearest.radiusMetres
      ? "inside"
      : nearest.distanceMetres - nearest.accuracy > nearest.radiusMetres
        ? "outside"
        : "uncertain";
  return {
    geofenceId: nearest.geofenceId,
    name: nearest.name,
    buildingId: nearest.buildingId,
    distanceMetres: nearest.distanceMetres,
    radiusMetres: nearest.radiusMetres,
    confidence: Math.max(
      0,
      Math.min(
        1,
        Math.abs(nearest.radiusMetres - nearest.distanceMetres) /
          nearest.accuracy,
      ),
    ),
    status,
  };
}

export type GeofenceTransition = "entered" | "exited";

export type HospitalGeofenceSnapshot = {
  match: GeofenceMatch | null;
  transition: GeofenceTransition | null;
  revision: number;
};

export function createHospitalGeofenceTracker() {
  let snapshot: HospitalGeofenceSnapshot = {
    match: null,
    transition: null,
    revision: 0,
  };
  let confirmedStatus: GeofenceMatch["status"] | null = null;
  let candidateStatus: GeofenceMatch["status"] | null = null;
  let candidateCount = 0;
  let lastProcessedTimestamp = 0;
  let lastReliableTimestamp = 0;
  const listeners = new Set<() => void>();

  const publish = (
    match: GeofenceMatch | null,
    transition: GeofenceTransition | null,
  ) => {
    snapshot = { match, transition, revision: snapshot.revision + 1 };
    listeners.forEach((listener) => listener());
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(
      fix: GPSFix | null,
      geofences: HospitalGeofence[] = hospitalBuildingGeofences,
      now = Date.now(),
    ) {
      if (fix && fix.timestamp <= lastProcessedTimestamp) return;
      if (fix) lastProcessedTimestamp = fix.timestamp;
      if (
        fix &&
        lastReliableTimestamp > 0 &&
        fix.timestamp - lastReliableTimestamp > 60_000
      ) {
        confirmedStatus = null;
        candidateStatus = null;
        candidateCount = 0;
      }
      const match = fix
        ? matchHospitalGeofence(
            fix,
            geofences,
            maximumUsableGPSAccuracyMetres,
            now,
          )
        : null;
      if (!match || match.status === "uncertain") {
        candidateStatus = null;
        candidateCount = 0;
        if (!match) lastReliableTimestamp = 0;
        if (snapshot.match !== null || snapshot.transition !== null) {
          publish(match, null);
        }
        return;
      }

      if (candidateStatus === match.status) {
        candidateCount += 1;
      } else {
        candidateStatus = match.status;
        candidateCount = 1;
      }
      if (candidateCount < 2) {
        if (snapshot.match !== match || snapshot.transition !== null) {
          publish(match, null);
        }
        return;
      }

      const transition =
        confirmedStatus === "outside" && match.status === "inside"
          ? "entered"
          : confirmedStatus === "inside" && match.status === "outside"
            ? "exited"
            : null;
      confirmedStatus = match.status;
      lastReliableTimestamp = fix?.timestamp ?? 0;
      publish(match, transition);
    },
  };
}

export const gpsPositioningService = {
  matchHospitalGeofence,
  createHospitalGeofenceTracker,
  maximumIndoorMatchAccuracyMetres: 25,
};
