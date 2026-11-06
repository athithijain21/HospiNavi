import { useCallback, useEffect, useRef, useState } from "react";
import type { HospitalBuilding } from "../data/hospitalMapData";
import { bleBeaconDatabase, getBeaconConfigurationErrors } from "../data/bleBeaconData";
import { blePositioningService } from "../services/blePositioningService";
import { estimateFloorFromBeacons, isStrongEnoughToSwitch } from "../services/floorDetectionService";
import { wifiPositioningService } from "../services/wifiPositioningService";
import type {
  BeaconReading,
  BeaconScannerAdapter,
  IndoorPositionEstimate,
  WiFiReading,
} from "../services/indoorPositioningService";

export type IndoorPositionStatus =
  | "idle"
  | "scanning"
  | "positioned"
  | "low-confidence"
  | "manual"
  | "demo"
  | "error";

export type DemoSignalMode = "stable" | "weak" | "conflicting";

type Props = {
  buildings: HospitalBuilding[];
  onPositionChange?: (estimate: IndoorPositionEstimate) => void;
};

const CONFIDENCE_THRESHOLD = 0.72;
const REQUIRED_CONFIRMATIONS = 3;
const MINIMUM_CONFIRMATION_MS = 1200;

const demoBeacons = (buildings: HospitalBuilding[]) =>
  buildings.flatMap((building, buildingIndex) =>
    building.floors.map((floor, floorIndex) => ({
      id: `DEMO-${building.id}-${floorIndex}`,
      uuid: `00000000-0000-4000-8000-${(buildingIndex * 100 + floorIndex + 1)
        .toString()
        .padStart(12, "0")}`,
      major: buildingIndex + 1,
      minor: floorIndex + 1,
      buildingId: building.id,
      floor,
    })),
  );

export function useIndoorPosition({ buildings, onPositionChange }: Props) {
  const [status, setStatus] = useState<IndoorPositionStatus>("idle");
  const [currentPosition, setCurrentPosition] =
    useState<IndoorPositionEstimate | null>(null);
  const [latestEstimate, setLatestEstimate] =
    useState<IndoorPositionEstimate | null>(null);
  const [error, setError] = useState("");
  const [manualOverride, setManualOverride] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [demoBuilding, setDemoBuilding] = useState(buildings[0]?.id ?? "");
  const [demoFloor, setDemoFloor] = useState(buildings[0]?.floors[0] ?? "");
  const [demoSignalMode, setDemoSignalMode] = useState<DemoSignalMode>("stable");
  const stopScanner = useRef<(() => void) | null>(null);
  const demoInterval = useRef<number | null>(null);
  const scanGeneration = useRef(0);
  const manualOverrideRef = useRef(false);
  const candidate = useRef<{
    key: string;
    count: number;
    firstSeen: number;
  } | null>(null);
  const acceptedPosition = useRef<IndoorPositionEstimate | null>(null);
  const lastEstimateUpdate = useRef(0);
  const onPositionChangeRef = useRef(onPositionChange);

  useEffect(() => {
    onPositionChangeRef.current = onPositionChange;
  }, [onPositionChange]);

  const clearDemoInterval = useCallback(() => {
    if (demoInterval.current !== null) {
      window.clearInterval(demoInterval.current);
      demoInterval.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    scanGeneration.current += 1;
    stopScanner.current?.();
    stopScanner.current = null;
    clearDemoInterval();
    setDemoMode(false);
    setIsScanning(false);
    setStatus(manualOverrideRef.current ? "manual" : "idle");
  }, [clearDemoInterval]);

  const clearSimulatedPosition = useCallback(() => {
    if (
      currentPosition?.source !== "demo" &&
      latestEstimate?.source !== "demo"
    ) {
      return;
    }
    stop();
    acceptedPosition.current = null;
    setCurrentPosition((position) =>
      position?.source === "demo" ? null : position,
    );
    setLatestEstimate((estimate) =>
      estimate?.source === "demo" ? null : estimate,
    );
    setStatus("idle");
  }, [currentPosition?.source, latestEstimate?.source, stop]);

  const processEstimate = useCallback((estimate: IndoorPositionEstimate | null) => {
    if (Date.now() - lastEstimateUpdate.current >= 1000 || !estimate) {
      setLatestEstimate(estimate);
      lastEstimateUpdate.current = Date.now();
    }
    if (!estimate || !isStrongEnoughToSwitch(estimate, CONFIDENCE_THRESHOLD)) {
      candidate.current = null;
      if (!manualOverrideRef.current) setStatus("low-confidence");
      return;
    }

    const key = [
      estimate.buildingId,
      estimate.floor,
      estimate.source,
      estimate.nearestBeaconId ?? "unmapped",
    ].join(":");
    const now = Date.now();
    if (candidate.current?.key === key) {
      candidate.current.count += 1;
    } else {
      candidate.current = { key, count: 1, firstSeen: now };
    }
    if (
      manualOverrideRef.current ||
      candidate.current.count < REQUIRED_CONFIRMATIONS ||
      now - candidate.current.firstSeen < MINIMUM_CONFIRMATION_MS
    ) {
      return;
    }

    const previousPosition = acceptedPosition.current;
    const locationChanged =
      previousPosition?.buildingId !== estimate.buildingId ||
      previousPosition.floor !== estimate.floor ||
      previousPosition.source !== estimate.source ||
      previousPosition.nearestBeaconId !== estimate.nearestBeaconId;
    if (locationChanged || now - (previousPosition?.timestamp ?? 0) >= 1500) {
      acceptedPosition.current = estimate;
      setCurrentPosition(estimate);
    }
    setStatus(estimate.source === "demo" ? "demo" : "positioned");
    if (locationChanged) onPositionChangeRef.current?.(estimate);
  }, []);

  const processReadings = useCallback(
    (readings: BeaconReading[], beaconDatabase = bleBeaconDatabase) => {
      processEstimate(estimateFloorFromBeacons(readings, beaconDatabase));
    },
    [processEstimate],
  );

  const submitWiFiReadings = useCallback(
    async (readings: WiFiReading[]) => {
      try {
        const estimate = await wifiPositioningService.estimate(readings, buildings);
        processEstimate(estimate);
        return estimate;
      } catch (wifiError) {
        const message =
          wifiError instanceof Error
            ? wifiError.message
            : "Unable to estimate a position from Wi-Fi readings.";
        setError(message);
        setStatus("error");
        throw wifiError;
      }
    },
    [buildings, processEstimate],
  );

  const startBLE = useCallback(
    async (adapter?: BeaconScannerAdapter) => {
      scanGeneration.current += 1;
      const generation = scanGeneration.current;
      stopScanner.current?.();
      stopScanner.current = null;
      clearDemoInterval();
      setDemoMode(false);
      setIsScanning(false);
      setError("");
      manualOverrideRef.current = false;
      setManualOverride(false);
      candidate.current = null;

      const configurationErrors = getBeaconConfigurationErrors(
        bleBeaconDatabase,
        buildings,
      );
      if (configurationErrors.length > 0) {
        setError(configurationErrors.join(" "));
        setStatus("error");
        return;
      }
      if (bleBeaconDatabase.length === 0) {
        setError(
          "No surveyed BLE beacons are configured. Add real beacon UUID, major/minor, building, and floor values to src/data/bleBeaconData.ts.",
        );
        setStatus("error");
        return;
      }
      setStatus("scanning");
      setIsScanning(true);
      try {
        const stopScan = await blePositioningService.start(
          bleBeaconDatabase,
          (readings) => processReadings(readings),
          adapter,
        );
        if (generation !== scanGeneration.current) {
          stopScan();
          return;
        }
        stopScanner.current = stopScan;
      } catch (scanError) {
        if (generation !== scanGeneration.current) return;
        setIsScanning(false);
        setStatus("error");
        setError(
          scanError instanceof Error
            ? scanError.message
            : "Unable to start BLE scanning.",
        );
      }
    },
    [buildings, clearDemoInterval, processReadings],
  );

  const startDemo = useCallback(
    (
      buildingId: string,
      floor: string,
      signalMode: DemoSignalMode = "stable",
    ) => {
      scanGeneration.current += 1;
      stopScanner.current?.();
      stopScanner.current = null;
      clearDemoInterval();
      setIsScanning(false);
      setError("");
      manualOverrideRef.current = false;
      setManualOverride(false);
      setDemoMode(true);
      setStatus("demo");
      setDemoBuilding(buildingId);
      setDemoFloor(floor);
      setDemoSignalMode(signalMode);
      candidate.current = null;

      const database = demoBeacons(buildings);
      const chosenBeacon = database.find(
        (beacon) => beacon.buildingId === buildingId && beacon.floor === floor,
      );
      if (!chosenBeacon) {
        setError("Choose a valid demo building and floor.");
        setStatus("error");
        setDemoMode(false);
        return;
      }

      const report = () => {
        const now = Date.now();
        const readings: BeaconReading[] = [];
        if (signalMode === "weak") {
          readings.push({
            beaconId: chosenBeacon.id,
            rssi: -94,
            timestamp: now,
            source: "demo",
          });
        } else {
          readings.push({
            beaconId: chosenBeacon.id,
            rssi: -64,
            timestamp: now,
            source: "demo",
          });
          if (signalMode === "conflicting") {
            const otherBeacon = database.find(
              (beacon) =>
                beacon.buildingId !== buildingId || beacon.floor !== floor,
            );
            if (otherBeacon) {
              readings.push({
                beaconId: otherBeacon.id,
                rssi: -65,
                timestamp: now,
                source: "demo",
              });
            }
          }
        }
        processReadings(readings, database);
      };
      report();
      demoInterval.current = window.setInterval(report, 700);
    },
    [buildings, clearDemoInterval, processReadings],
  );

  const setManualPosition = useCallback(
    (buildingId: string, floor: string) => {
      const building = buildings.find((item) => item.id === buildingId);
      if (!building || !building.floors.includes(floor)) return;
      setManualOverride(true);
      manualOverrideRef.current = true;
      setDemoMode(false);
      clearDemoInterval();
      candidate.current = null;
      const estimate: IndoorPositionEstimate = {
        buildingId,
        floor,
        confidence: 1,
        source: "manual",
        nearestBeaconId: null,
        rssi: null,
        timestamp: Date.now(),
        evidenceCount: 0,
      };
      acceptedPosition.current = estimate;
      setCurrentPosition(estimate);
      setStatus("manual");
    },
    [buildings, clearDemoInterval],
  );

  const resumeAutomatic = useCallback(() => {
    manualOverrideRef.current = false;
    setManualOverride(false);
    candidate.current = null;
    setStatus(isScanning ? "scanning" : demoMode ? "demo" : "idle");
  }, [demoMode, isScanning]);

  useEffect(
    () => () => {
      scanGeneration.current += 1;
      stopScanner.current?.();
      clearDemoInterval();
    },
    [clearDemoInterval],
  );

  return {
    status,
    currentPosition,
    latestEstimate,
    error,
    manualOverride,
    demoMode,
    isScanning,
    demoBuilding,
    demoFloor,
    demoSignalMode,
    setDemoBuilding,
    setDemoFloor,
    setDemoSignalMode,
    startBLE,
    startDemo,
    stop,
    clearSimulatedPosition,
    setManualPosition,
    resumeAutomatic,
    submitWiFiReadings,
  };
}
