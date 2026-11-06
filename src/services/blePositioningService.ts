import type { BLEBeaconConfig } from "../data/bleBeaconData";
import type {
  BeaconReading,
  BeaconScannerAdapter,
} from "./indoorPositioningService";

type AdvertisementDevice = {
  manufacturerData?: Map<number, DataView>;
};

type AdvertisementEvent = Event & {
  device?: AdvertisementDevice;
  rssi?: number;
};

type BLEScan = {
  stop: () => void;
};

type BLEScanner = EventTarget & {
  requestLEScan: (options: {
    acceptAllAdvertisements: boolean;
    keepRepeatedDevices: boolean;
  }) => Promise<BLEScan>;
};

type NavigatorWithBLE = Navigator & {
  bluetooth?: BLEScanner;
};

export type BLESupport = {
  supported: boolean;
  reason: string;
};

type NativeBLEBridge = {
  startBLEScan: (
    beacons: BLEBeaconConfig[],
    onReading: (reading: BeaconReading) => void,
  ) => Promise<() => void>;
};

declare global {
  interface Window {
    hospiNavPositioning?: NativeBLEBridge;
  }
}

export function getNativeBLEScannerAdapter(
  beacons: BLEBeaconConfig[],
): BeaconScannerAdapter | null {
  const bridge = typeof window !== "undefined" ? window.hospiNavPositioning : undefined;
  if (!bridge) return null;
  return {
    start: (onReading) =>
      bridge.startBLEScan(beacons, onReading),
  };
}

export function getBLESupport(): BLESupport {
  if (typeof navigator === "undefined") {
    return { supported: false, reason: "Bluetooth is unavailable outside a browser." };
  }
  if (!globalThis.isSecureContext) {
    return { supported: false, reason: "BLE scanning requires HTTPS or localhost." };
  }
  const bluetooth = (navigator as NavigatorWithBLE).bluetooth;
  if (!bluetooth || typeof bluetooth.requestLEScan !== "function") {
    return {
      supported: false,
      reason:
        "This browser does not expose BLE advertisement scanning. Web Bluetooth support varies and often does not allow beacon scans.",
    };
  }
  return { supported: true, reason: "BLE advertisement scanning is available." };
}

function normalizeUUID(bytes: Uint8Array) {
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function parseIBeacon(data: DataView) {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (bytes.length < 23 || bytes[0] !== 0x02 || bytes[1] !== 0x15) return null;
  const uuid = normalizeUUID(bytes.slice(2, 18));
  const major = (bytes[18] << 8) | bytes[19];
  const minor = (bytes[20] << 8) | bytes[21];
  return { uuid, major, minor };
}

function matchBeacon(
  advertisement: AdvertisementEvent,
  beacons: BLEBeaconConfig[],
) {
  for (const [manufacturerId, data] of advertisement.device?.manufacturerData ?? []) {
    if (manufacturerId !== 0x004c) continue;
    const parsed = parseIBeacon(data);
    if (!parsed) continue;
    return beacons.find(
      (beacon) =>
        beacon.uuid.toLowerCase() === parsed.uuid.toLowerCase() &&
        beacon.major === parsed.major &&
        beacon.minor === parsed.minor,
    );
  }
  return undefined;
}

function smoothedRSSI(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export const blePositioningService = {
  getSupport: getBLESupport,
  async start(
    beacons: BLEBeaconConfig[],
    onReadings: (readings: BeaconReading[]) => void,
    adapter?: BeaconScannerAdapter,
  ): Promise<() => void> {
    if (beacons.length === 0) {
      throw new Error(
        "No surveyed BLE beacons are configured. Add installed beacon IDs to src/data/bleBeaconData.ts.",
      );
    }

    const samples = new Map<string, number[]>();
    const latest = new Map<string, BeaconReading>();
    const configuredBeaconIds = new Set(beacons.map((beacon) => beacon.id));
    let active = true;

    const acceptReading = (reading: BeaconReading) => {
      if (!configuredBeaconIds.has(reading.beaconId) || !Number.isFinite(reading.rssi)) {
        return;
      }
      const recentSamples = [...(samples.get(reading.beaconId) ?? []), reading.rssi].slice(-5);
      samples.set(reading.beaconId, recentSamples);
      latest.set(reading.beaconId, {
        ...reading,
        source: "ble",
        rssi: smoothedRSSI(recentSamples),
      });
      onReadings([...latest.values()]);
    };

    if (adapter) {
      const stopAdapter = await adapter.start((reading) => {
        if (active) acceptReading(reading);
      });
      return () => {
        active = false;
        stopAdapter();
      };
    }

    const support = getBLESupport();
    if (!support.supported) throw new Error(support.reason);
    const bluetooth = (navigator as NavigatorWithBLE).bluetooth;
    if (!bluetooth) throw new Error("Bluetooth scanning is unavailable.");

    const scan = await bluetooth.requestLEScan({
      acceptAllAdvertisements: true,
      keepRepeatedDevices: true,
    });
    const onAdvertisement = (event: Event) => {
      const advertisement = event as AdvertisementEvent;
      if (typeof advertisement.rssi !== "number") return;
      const beacon = matchBeacon(advertisement, beacons);
      if (!beacon) return;
      acceptReading({
        beaconId: beacon.id,
        rssi: advertisement.rssi,
        timestamp: Date.now(),
        source: "ble",
      });
    };
    bluetooth.addEventListener("advertisementreceived", onAdvertisement);

    return () => {
      if (!active) return;
      active = false;
      bluetooth.removeEventListener("advertisementreceived", onAdvertisement);
      scan.stop();
    };
  },
};
