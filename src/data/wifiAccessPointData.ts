export type WiFiAccessPointConfig = {
  id: string;
  buildingId: string;
  floor: string;
  calibratedRssi: number;
};

// Calibrate access-point IDs and RSSI at known locations before enabling a
// native scanner or backend positioning integration.
export const wifiAccessPointDatabase: WiFiAccessPointConfig[] = [];
