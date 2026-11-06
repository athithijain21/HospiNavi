import { useCallback, useEffect, useRef, useState } from "react";

export type GPSPosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

function getLocationError(error: GeolocationPositionError) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission was denied. Allow location access in your browser settings and try again.";
    case error.POSITION_UNAVAILABLE:
      return "Your position is unavailable. Check your device location settings and try again.";
    case error.TIMEOUT:
      return "The location request timed out. Move to an area with a clearer GPS signal and try again.";
    default:
      return "Unable to read your location. Please try again.";
  }
}

export function useGeolocationTracking(autoStart = false) {
  const [position, setPosition] = useState<GPSPosition | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  const stopTracking = useCallback(() => {
    if (
      watchId.current !== null &&
      typeof navigator !== "undefined" &&
      "geolocation" in navigator
    ) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setIsTracking(false);
  }, []);

  const startTracking = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("Geolocation is not supported by this browser.");
      return;
    }
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
    }

    setError(null);
    setIsTracking(true);
    watchId.current = navigator.geolocation.watchPosition(
      (location) => {
        setPosition({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          timestamp: location.timestamp,
        });
        setError(null);
      },
      (locationError) => {
        setError(getLocationError(locationError));
        if (watchId.current !== null) {
          navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
        }
        setIsTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }, []);

  useEffect(() => {
    if (!autoStart) return;
    const timer = window.setTimeout(startTracking, 0);
    return () => window.clearTimeout(timer);
  }, [autoStart, startTracking]);

  useEffect(
    () => () => {
      if (
        watchId.current !== null &&
        typeof navigator !== "undefined" &&
        "geolocation" in navigator
      ) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    },
    [],
  );

  return { position, isTracking, error, startTracking, stopTracking };
}
