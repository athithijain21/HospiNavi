import type { GPSFix } from "./gpsPositioningService";

export type ReadableGPSLocation = {
  locality: string | null;
  road: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  displayName: string;
  approximate: boolean;
};

type NominatimResponse = {
  display_name?: unknown;
  address?: Record<string, unknown>;
};

const cache = new Map<string, ReadableGPSLocation>();
const cachePrecision = 4;
let lastRequestAt = 0;
let requestQueue: Promise<void> = Promise.resolve();

function cacheKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(cachePrecision)},${longitude.toFixed(cachePrecision)}`;
}

function firstAddressValue(address: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = address[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function parseResponse(body: NominatimResponse): Omit<ReadableGPSLocation, "approximate"> {
  const address = body.address ?? {};
  const locality = firstAddressValue(address, [
    "neighbourhood",
    "suburb",
    "quarter",
    "village",
    "town",
  ]);
  const road = firstAddressValue(address, ["road", "pedestrian", "footway"]);
  const city = firstAddressValue(address, ["city", "municipality", "town"]);
  const district = firstAddressValue(address, [
    "city_district",
    "district",
    "county",
    "state_district",
  ]);
  const state = firstAddressValue(address, ["state", "region"]);
  const displayName =
    typeof body.display_name === "string" && body.display_name.trim()
      ? body.display_name.trim()
      : [locality, city, state].filter(Boolean).join(", ");

  if (!displayName) {
    throw new Error("The geocoding provider returned no readable location.");
  }
  return {
    locality,
    road,
    city,
    district,
    state,
    displayName,
  };
}

async function waitForProviderSlot() {
  const previous = requestQueue;
  let release!: () => void;
  requestQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  const delay = Math.max(0, 1_100 - (Date.now() - lastRequestAt));
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  lastRequestAt = Date.now();
  release();
}

export async function reverseGeocodeGPS(
  fix: Pick<GPSFix, "latitude" | "longitude" | "accuracy">,
  signal?: AbortSignal,
) {
  if (
    !Number.isFinite(fix.latitude) ||
    !Number.isFinite(fix.longitude) ||
    !Number.isFinite(fix.accuracy)
  ) {
    throw new Error("GPS coordinates are unavailable.");
  }
  const key = cacheKey(fix.latitude, fix.longitude);
  const cached = cache.get(key);
  if (cached) {
    return { ...cached, approximate: fix.accuracy > 50 };
  }

  await waitForProviderSlot();
  if (signal?.aborted) throw new DOMException("Geocoding request was cancelled.", "AbortError");
  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    lat: String(fix.latitude),
    lon: String(fix.longitude),
    zoom: "18",
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
    {
      headers: { Accept: "application/json" },
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(`Location name lookup failed (HTTP ${response.status}).`);
  }
  const parsed = parseResponse((await response.json()) as NominatimResponse);
  const result: ReadableGPSLocation = {
    ...parsed,
    approximate: fix.accuracy > 50,
  };
  cache.set(key, result);
  return result;
}
