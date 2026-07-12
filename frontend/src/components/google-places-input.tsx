"use client";

import { useEffect, useRef } from "react";

export type PlaceSelection = {
  area: string;
  city: string;
  state?: string;
  pin_code?: string;
  latitude?: number;
  longitude?: number;
  google_place_id?: string;
};

type AddressComponent = {
  longText?: string | null;
  shortText?: string | null;
  types: string[];
};

type PlaceLike = {
  id?: string;
  formattedAddress?: string | null;
  displayName?: string | null;
  location?: { lat: () => number; lng: () => number } | { lat: number; lng: number } | null;
  addressComponents?: AddressComponent[] | null;
  fetchFields: (opts: { fields: string[] }) => Promise<unknown>;
};

type PlacePredictionSelectEvent = Event & {
  placePrediction?: { toPlace: () => PlaceLike };
};

type PlaceAutocompleteElementLike = HTMLElement & {
  placeholder: string;
  includedRegionCodes?: string[];
};

declare global {
  interface Window {
    google?: {
      maps?: {
        importLibrary: (name: string) => Promise<{
          PlaceAutocompleteElement: new (opts?: {
            includedRegionCodes?: string[];
            placeholder?: string;
          }) => PlaceAutocompleteElementLike;
        }>;
      };
    };
  }
}

let mapsLoader: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (mapsLoader) return mapsLoader;

  mapsLoader = new Promise<void>((resolve, reject) => {
    const scriptId = "google-maps-js";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      if (window.google?.maps?.importLibrary) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });

  return mapsLoader;
}

function readLatLng(location: PlaceLike["location"]): { lat?: number; lng?: number } {
  if (!location) return {};
  if (typeof (location as { lat: unknown }).lat === "function") {
    const loc = location as { lat: () => number; lng: () => number };
    return { lat: loc.lat(), lng: loc.lng() };
  }
  const loc = location as { lat: number; lng: number };
  return { lat: loc.lat, lng: loc.lng };
}

function parsePlace(place: PlaceLike): PlaceSelection {
  const components = place.addressComponents || [];
  const get = (type: string) => components.find((c) => c.types.includes(type))?.longText || undefined;
  const area =
    get("sublocality") ||
    get("sublocality_level_1") ||
    get("neighborhood") ||
    get("locality") ||
    "";
  const city = get("locality") || get("administrative_area_level_2") || "";
  const state = get("administrative_area_level_1");
  const pin_code = get("postal_code");
  const { lat, lng } = readLatLng(place.location);
  return {
    area: area || place.displayName || place.formattedAddress?.split(",")[0] || "",
    city: city || "",
    state,
    pin_code,
    latitude: lat,
    longitude: lng,
    google_place_id: place.id,
  };
}

export function GooglePlacesInput({
  onSelect,
  placeholder = "Search location...",
  className,
}: {
  onSelect: (place: PlaceSelection) => void;
  placeholder?: string;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!apiKey || !hostRef.current) return;

    let cancelled = false;
    let element: PlaceAutocompleteElementLike | null = null;

    const onSelectPlace = async (event: Event) => {
      const { placePrediction } = event as PlacePredictionSelectEvent;
      if (!placePrediction) return;
      const place = placePrediction.toPlace();
      await place.fetchFields({
        fields: ["id", "displayName", "formattedAddress", "location", "addressComponents"],
      });
      if (place.location || place.addressComponents?.length) {
        onSelectRef.current(parsePlace(place));
      }
    };

    void (async () => {
      try {
        await loadGoogleMaps(apiKey);
        if (cancelled || !hostRef.current || !window.google?.maps?.importLibrary) return;

        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary("places");
        if (cancelled || !hostRef.current) return;

        const placeAutocomplete = new PlaceAutocompleteElement({
          includedRegionCodes: ["in"],
        });
        placeAutocomplete.placeholder = placeholder;
        placeAutocomplete.style.display = "block";
        placeAutocomplete.style.width = "100%";
        placeAutocomplete.addEventListener("gmp-select", onSelectPlace);

        hostRef.current.replaceChildren(placeAutocomplete);
        element = placeAutocomplete;
      } catch (err) {
        console.error(err);
      }
    })();

    return () => {
      cancelled = true;
      element?.removeEventListener("gmp-select", onSelectPlace);
      hostRef.current?.replaceChildren();
    };
  }, [apiKey, placeholder]);

  if (!apiKey) {
    return (
      <input
        placeholder={placeholder + " (manual — add GOOGLE_MAPS_API_KEY for autocomplete)"}
        className={className}
      />
    );
  }

  return (
    <div className={className}>
      <div ref={hostRef} className="w-full [&_gmp-place-autocomplete]:block [&_gmp-place-autocomplete]:w-full" />
    </div>
  );
}
