"use client";

import { useEffect, useRef } from "react";

type PlaceResult = {
  formatted_address?: string;
  geometry?: { location: { lat: () => number; lng: () => number } };
  place_id?: string;
  address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
};

export type PlaceSelection = {
  area: string;
  city: string;
  state?: string;
  pin_code?: string;
  latitude?: number;
  longitude?: number;
  google_place_id?: string;
};

function parsePlace(place: PlaceResult): PlaceSelection {
  const components = place.address_components || [];
  const get = (type: string) => components.find((c) => c.types.includes(type))?.long_name;
  const area = get("sublocality") || get("sublocality_level_1") || get("neighborhood") || get("locality") || "";
  const city = get("locality") || get("administrative_area_level_2") || "";
  const state = get("administrative_area_level_1");
  const pin_code = get("postal_code");
  const lat = place.geometry?.location.lat();
  const lng = place.geometry?.location.lng();
  return {
    area: area || place.formatted_address?.split(",")[0] || "",
    city: city || "",
    state,
    pin_code,
    latitude: lat,
    longitude: lng,
    google_place_id: place.place_id,
  };
}

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: Record<string, unknown>
          ) => {
            addListener: (event: string, handler: () => void) => void;
            getPlace: () => PlaceResult;
          };
        };
      };
    };
    initGooglePlaces?: () => void;
  }
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
  const inputRef = useRef<HTMLInputElement>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey || !inputRef.current) return;

    const init = () => {
      if (!window.google?.maps?.places || !inputRef.current) return;
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["geocode"],
        componentRestrictions: { country: "in" },
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace() as PlaceResult;
        if (place.geometry) {
          onSelect(parsePlace(place));
        }
      });
    };

    if (window.google?.maps?.places) {
      init();
      return;
    }

    const scriptId = "google-maps-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.onload = init;
      document.head.appendChild(script);
    } else {
      init();
    }
  }, [apiKey, onSelect]);

  if (!apiKey) {
    return (
      <input
        ref={inputRef}
        placeholder={placeholder + " (manual — add GOOGLE_MAPS_API_KEY for autocomplete)"}
        className={className}
      />
    );
  }

  return <input ref={inputRef} placeholder={placeholder} className={className} />;
}
