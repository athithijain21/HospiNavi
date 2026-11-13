import { useEffect, useState } from "react";
import type { GPSFix } from "../services/gpsPositioningService";
import {
  reverseGeocodeGPS,
  type ReadableGPSLocation,
} from "../services/reverseGeocodingService";

export function useReverseGeocoding(fix: GPSFix | null) {
  const [result, setResult] = useState<{
    key: string;
    location: ReadableGPSLocation | null;
    status: "success" | "error";
    error: string;
  } | null>(null);
  const latitude = fix?.latitude;
  const longitude = fix?.longitude;
  const accuracy = fix?.accuracy;
  const timestamp = fix?.timestamp;
  const key =
    fix && Number.isFinite(latitude) && Number.isFinite(longitude)
      ? `${latitude?.toFixed(4)},${longitude?.toFixed(4)}`
      : "";

  useEffect(() => {
    if (!fix) {
      return;
    }
    const controller = new AbortController();
    void reverseGeocodeGPS(fix, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setResult({ key, location: result, status: "success", error: "" });
      })
      .catch((lookupError: unknown) => {
        if (controller.signal.aborted) return;
        setResult({
          key,
          location: null,
          status: "error",
          error:
            lookupError instanceof Error
              ? lookupError.message
              : "Unable to determine a readable location name.",
        });
      });
    return () => controller.abort();
  }, [accuracy, fix, key, latitude, longitude, timestamp]);

  if (!fix) return { location: null, status: "idle" as const, error: "" };
  if (!result || result.key !== key) {
    return { location: null, status: "loading" as const, error: "" };
  }
  return result;
}
