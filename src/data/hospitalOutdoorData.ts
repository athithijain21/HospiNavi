export type OutdoorCoordinate = {
  latitude: number;
  longitude: number;
};

export type HospitalGeofence = {
  id: string;
  name: string;
  center: OutdoorCoordinate;
  radiusMetres: number;
  buildingId?: string;
};

export const hospitalCampusReference: OutdoorCoordinate = {
  latitude: 12.8660778,
  longitude: 74.8623117,
};

// Proximity circle around the supplied campus reference, not a surveyed property boundary.
export const hospitalCampusGeofenceRadiusMetres = 250;
export const maximumUsableGPSAccuracyMetres = 50;

export const hospitalBuildingGeofences: HospitalGeofence[] = [
  {
    id: "father-muller-campus-proximity",
    name: "Father Muller Medical College campus proximity area",
    center: hospitalCampusReference,
    radiusMetres: hospitalCampusGeofenceRadiusMetres,
  },
];

// Add verified outdoor entrance coordinates for each building before navigating to it.
export const hospitalBuildingCoordinates: Record<
  string,
  OutdoorCoordinate | null
> = {
  A: null,
  B: null,
  C: null,
  D: null,
};
