export type PositioningSource = "ble" | "wifi" | "gps" | "demo" | "manual";

export type BeaconReading = {
  beaconId: string;
  rssi: number;
  timestamp: number;
  source: PositioningSource;
};

export type WiFiReading = {
  accessPointId: string;
  rssi: number;
  timestamp: number;
};

export type IndoorPositionEstimate = {
  buildingId: string;
  floor: string;
  confidence: number;
  source: PositioningSource;
  nearestBeaconId: string | null;
  rssi: number | null;
  timestamp: number;
  evidenceCount: number;
};

export type BeaconReadingListener = (readings: BeaconReading[]) => void;

export interface BeaconScannerAdapter {
  start(onReading: (reading: BeaconReading) => void): Promise<() => void>;
}

export interface IndoorPositionProvider {
  start(onEstimate: (estimate: IndoorPositionEstimate) => void): Promise<() => void>;
}
