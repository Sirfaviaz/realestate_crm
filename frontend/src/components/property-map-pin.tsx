"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { LocateFixed } from "lucide-react";
import { useEffect, useRef, useState } from "react";

let mapsConfigured = false;

async function ensureMaps(apiKey: string) {
  if (!mapsConfigured) {
    setOptions({ key: apiKey, v: "weekly" });
    mapsConfigured = true;
  }
  await importLibrary("maps");
}

export type MapPin = { lat: number; lng: number };

export function PropertyMapPin({
  value,
  onChange,
  center,
  className,
  readOnly = false,
}: {
  value: MapPin | null;
  onChange: (pin: MapPin) => void;
  /** Map center bias (city/area) when no pin yet. */
  center?: MapPin | null;
  className?: string;
  readOnly?: boolean;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const syncMarker = (map: google.maps.Map, pin: MapPin) => {
    const position = { lat: pin.lat, lng: pin.lng };
    if (markerRef.current) {
      markerRef.current.setPosition(position);
    } else {
        const marker = new google.maps.Marker({
        map,
        position,
        draggable: !readOnly,
        title: "Property location",
      });
      if (!readOnly) {
        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (!pos) return;
          onChangeRef.current({ lat: pos.lat(), lng: pos.lng() });
        });
      }
      markerRef.current = marker;
    }
    map.panTo(position);
    if ((map.getZoom() || 0) < 15) map.setZoom(16);
  };

  useEffect(() => {
    if (!apiKey || !mapEl.current) return;
    let cancelled = false;

    (async () => {
      try {
        await ensureMaps(apiKey);
        if (cancelled || !mapEl.current) return;

        const start = value || center || { lat: 11.2588, lng: 75.7804 };
        const map = new google.maps.Map(mapEl.current, {
          center: start,
          zoom: value ? 16 : center ? 13 : 12,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          clickableIcons: false,
        });
        mapRef.current = map;

        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (readOnly || !e.latLng) return;
          const pin = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          syncMarker(map, pin);
          onChangeRef.current(pin);
        });

        if (value) syncMarker(map, value);
        setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load map");
        }
      }
    })();

    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, readOnly]);

  useEffect(() => {
    if (!ready || !mapRef.current || !value) return;
    syncMarker(mapRef.current, value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ready]);

  useEffect(() => {
    if (!ready || !mapRef.current || value || !center) return;
    mapRef.current.setCenter(center);
    mapRef.current.setZoom(13);
  }, [center, ready, value]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Location is not supported on this device");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setError(err.message || "Could not get current location");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  if (!apiKey) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable map pinning.
      </div>
    );
  }

  return (
    <div className={className}>
      {!readOnly && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">Exact location on map *</div>
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 disabled:opacity-50"
          >
            <LocateFixed className="h-4 w-4" />
            {locating ? "Locating…" : "Current location"}
          </button>
        </div>
      )}
      {!readOnly && (
        <p className="mb-2 text-xs text-slate-500">
          Tap the map to drop a pin, or drag the pin. Use current location when you’re at the property.
        </p>
      )}
      {readOnly && <div className="mb-2 text-sm font-medium">Location on map</div>}
      <div
        ref={mapEl}
        className="h-56 w-full overflow-hidden rounded-xl border-2 border-slate-200 bg-slate-100"
      />
      {value ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span>
            Lat {value.lat.toFixed(6)} · Lng {value.lng.toFixed(6)}
          </span>
          <a
            href={`https://www.google.com/maps?q=${value.lat},${value.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-emerald-700 underline"
          >
            Open in Google Maps
          </a>
        </div>
      ) : (
        !readOnly && (
          <div className="mt-2 text-xs text-amber-700">No pin yet — tap the map or use current location.</div>
        )
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
