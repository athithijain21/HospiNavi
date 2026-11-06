import type { BLEBeaconConfig } from "../data/bleBeaconData";
import type {
  BeaconReading,
  IndoorPositionEstimate,
} from "./indoorPositioningService";

const READING_MAX_AGE_MS = 12_000;
const MINIMUM_RSSI = -90;

export function estimateFloorFromBeacons(
  readings: BeaconReading[],
  beacons: BLEBeaconConfig[],
): IndoorPositionEstimate | null {
  const now = Date.now();
  const beaconById = new Map(beacons.map((beacon) => [beacon.id, beacon]));
  const latestByBeacon = new Map<string, BeaconReading>();

  readings.forEach((reading) => {
    const previous = latestByBeacon.get(reading.beaconId);
    if (
      now - reading.timestamp <= READING_MAX_AGE_MS &&
      reading.rssi >= MINIMUM_RSSI &&
      (!previous || reading.timestamp > previous.timestamp)
    ) {
      latestByBeacon.set(reading.beaconId, reading);
    }
  });

  const floorScores = new Map<
    string,
    { buildingId: string; floor: string; score: number; count: number }
  >();
  let nearest: { beaconId: string; rssi: number; source: BeaconReading["source"] } | null =
    null;

  latestByBeacon.forEach((reading, beaconId) => {
    const beacon = beaconById.get(beaconId);
    if (!beacon) return;
    if (!nearest || reading.rssi > nearest.rssi) {
      nearest = { beaconId, rssi: reading.rssi, source: reading.source };
    }
    const key = `${beacon.buildingId}:${beacon.floor}`;
    const score = Math.max(0, Math.min(1, (reading.rssi + 100) / 45));
    const current = floorScores.get(key);
    if (current) {
      current.score += score;
      current.count += 1;
    } else {
      floorScores.set(key, {
        buildingId: beacon.buildingId,
        floor: beacon.floor,
        score,
        count: 1,
      });
    }
  });

  const rankedFloors = [...floorScores.values()]
    .map((item) => ({
      ...item,
      score: item.score / item.count + Math.min(item.count - 1, 2) * 0.08,
    }))
    .sort((a, b) => b.score - a.score);
  const best = rankedFloors[0];
  if (!best || !nearest) return null;

  const total = rankedFloors.reduce((sum, item) => sum + item.score, 0);
  const dominance = total > 0 ? best.score / total : 0;
  const signalQuality = Math.max(0, Math.min(1, (nearest.rssi + 100) / 45));
  const evidenceFactor = best.count > 1 ? 1 : 0.82;
  const confidence = Math.max(
    0,
    Math.min(1, (0.65 * dominance + 0.35 * signalQuality) * evidenceFactor),
  );
  const source = nearest.source;

  return {
    buildingId: best.buildingId,
    floor: best.floor,
    confidence,
    source,
    nearestBeaconId: nearest.beaconId,
    rssi: nearest.rssi,
    timestamp: nearestByTimestamp([...latestByBeacon.values()]),
    evidenceCount: latestByBeacon.size,
  };
}

function nearestByTimestamp(readings: BeaconReading[]) {
  return readings.reduce(
    (latest, reading) => Math.max(latest, reading.timestamp),
    0,
  );
}

export function isStrongEnoughToSwitch(
  estimate: IndoorPositionEstimate | null,
  threshold = 0.72,
) {
  return Boolean(estimate && estimate.confidence >= threshold);
}
