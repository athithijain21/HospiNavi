import type { HospitalBuilding } from "./hospitalMapData";

export type BLEBeaconConfig = {
  id: string;
  uuid: string;
  major: number;
  minor: number;
  buildingId: string;
  floor: string;
};

// Add installed, surveyed iBeacon identifiers here. Demo beacons are generated
// separately and are never treated as real hardware readings.
export const bleBeaconDatabase: BLEBeaconConfig[] = [];

export function getBeaconConfigurationErrors(
  beacons: BLEBeaconConfig[],
  buildings: HospitalBuilding[],
) {
  return beacons.flatMap((beacon) => {
    const errors: string[] = [];
    const building = buildings.find((item) => item.id === beacon.buildingId);
    if (!building) errors.push(`Beacon ${beacon.id} references an unknown building.`);
    else if (!building.floors.includes(beacon.floor)) {
      errors.push(`Beacon ${beacon.id} references an unknown floor.`);
    }
    if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(beacon.uuid)) {
      errors.push(`Beacon ${beacon.id} has an invalid UUID.`);
    }
    if (!Number.isInteger(beacon.major) || beacon.major < 0 || beacon.major > 65535) {
      errors.push(`Beacon ${beacon.id} has an invalid major value.`);
    }
    if (!Number.isInteger(beacon.minor) || beacon.minor < 0 || beacon.minor > 65535) {
      errors.push(`Beacon ${beacon.id} has an invalid minor value.`);
    }
    return errors;
  });
}
