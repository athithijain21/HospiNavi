import type { HospitalBuilding } from "../data/hospitalMapData";
import { wifiAccessPointDatabase } from "../data/wifiAccessPointData";
import type { IndoorPositionEstimate, WiFiReading } from "./indoorPositioningService";

export type WiFiPositioningOptions = {
  endpoint?: string;
  fetcher?: typeof fetch;
};

type BackendEstimate = {
  buildingId?: unknown;
  floor?: unknown;
  confidence?: unknown;
  nearestAccessPointId?: unknown;
  rssi?: unknown;
  timestamp?: unknown;
};

export function createWiFiPositioningService({
  endpoint = import.meta.env.VITE_INDOOR_WIFI_ENDPOINT,
  fetcher = fetch,
}: WiFiPositioningOptions = {}) {
  return {
    isConfigured: Boolean(endpoint),
    async estimate(
      readings: WiFiReading[],
      buildings: HospitalBuilding[],
    ): Promise<IndoorPositionEstimate> {
      if (!endpoint) {
        throw new Error(
          "Wi-Fi positioning requires a configured backend and readings from a native or supported hardware adapter.",
        );
      }
      if (readings.length === 0) {
        throw new Error("No calibrated Wi-Fi access-point readings were supplied.");
      }

      const response = await fetcher(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readings,
          knownAccessPoints: wifiAccessPointDatabase,
        }),
      });
      if (!response.ok) {
        throw new Error(`Wi-Fi positioning backend returned HTTP ${response.status}.`);
      }

      const result = (await response.json()) as BackendEstimate;
      const buildingId =
        typeof result.buildingId === "string" ? result.buildingId : "";
      const floor = typeof result.floor === "string" ? result.floor : "";
      const building = buildings.find((item) => item.id === buildingId);
      if (!building || !building.floors.includes(floor)) {
        throw new Error("Wi-Fi backend returned an unknown building or floor.");
      }
      const confidence =
        typeof result.confidence === "number" &&
        Number.isFinite(result.confidence) &&
        result.confidence >= 0 &&
        result.confidence <= 1
          ? result.confidence
          : null;
      if (confidence === null) {
        throw new Error("Wi-Fi backend returned an invalid confidence score.");
      }

      return {
        buildingId,
        floor,
        confidence,
        source: "wifi",
        nearestBeaconId:
          typeof result.nearestAccessPointId === "string"
            ? result.nearestAccessPointId
            : null,
        rssi: typeof result.rssi === "number" ? result.rssi : null,
        timestamp:
          typeof result.timestamp === "number" ? result.timestamp : Date.now(),
        evidenceCount: readings.length,
      };
    },
  };
}

export const wifiPositioningService = createWiFiPositioningService();
