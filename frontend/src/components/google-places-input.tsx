"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useId, useRef, useState } from "react";

export type PlaceSelection = {
  area: string;
  city: string;
  state?: string;
  pin_code?: string;
  latitude?: number;
  longitude?: number;
  google_place_id?: string;
};

type SuggestionItem = {
  id: string;
  label: string;
  prediction: google.maps.places.PlacePrediction;
};

let mapsConfigured = false;

async function ensurePlacesLibrary(apiKey: string) {
  if (!mapsConfigured) {
    setOptions({ key: apiKey, v: "weekly" });
    mapsConfigured = true;
  }
  return importLibrary("places");
}

function readLatLng(
  location: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined
): { lat?: number; lng?: number } {
  if (!location) return {};
  if (typeof (location as google.maps.LatLng).lat === "function") {
    const loc = location as google.maps.LatLng;
    return { lat: loc.lat(), lng: loc.lng() };
  }
  const loc = location as google.maps.LatLngLiteral;
  return { lat: loc.lat, lng: loc.lng };
}

function parsePlace(place: google.maps.places.Place): PlaceSelection {
  const components = place.addressComponents || [];
  const get = (type: string) =>
    components.find((c) => c.types.includes(type))?.longText || undefined;
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
    state: state || undefined,
    pin_code: pin_code || undefined,
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
  const listId = useId();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const onSelectRef = useRef(onSelect);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    void (async () => {
      try {
        await ensurePlacesLibrary(apiKey);
        if (!cancelled) {
          setReady(true);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Google Maps failed to load");
          setReady(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  async function fetchSuggestions(value: string) {
    if (!apiKey || !ready || value.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const { AutocompleteSuggestion, AutocompleteSessionToken } = await ensurePlacesLibrary(apiKey);
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new AutocompleteSessionToken();
      }

      const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: value,
        includedRegionCodes: ["in"],
        sessionToken: sessionTokenRef.current,
      });

      const items: SuggestionItem[] = (results || [])
        .map((suggestion, index) => {
          const prediction = suggestion.placePrediction;
          if (!prediction) return null;
          return {
            id: prediction.placeId || String(index),
            label: prediction.text?.toString() || "",
            prediction,
          };
        })
        .filter((item): item is SuggestionItem => Boolean(item?.label));

      setSuggestions(items);
      setOpen(items.length > 0);
      setError(null);
    } catch (err) {
      setSuggestions([]);
      setOpen(false);
      setError(
        err instanceof Error
          ? err.message
          : "Places autocomplete failed — enable Places API (New) and check key restrictions"
      );
    } finally {
      setLoading(false);
    }
  }

  function onChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(value);
    }, 250);
  }

  async function pickSuggestion(item: SuggestionItem) {
    setQuery(item.label);
    setSuggestions([]);
    setOpen(false);
    setLoading(true);
    try {
      const place = item.prediction.toPlace();
      await place.fetchFields({
        fields: ["id", "displayName", "formattedAddress", "location", "addressComponents"],
      });
      onSelectRef.current(parsePlace(place));
      sessionTokenRef.current = null;
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load place details");
    } finally {
      setLoading(false);
    }
  }

  const inputPlaceholder = !apiKey
    ? `${placeholder} (manual — add GOOGLE_MAPS_API_KEY)`
    : error
      ? `${placeholder} (maps unavailable — type manually)`
      : placeholder;

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onBlur={() => {
          // Allow click on suggestion before closing.
          setTimeout(() => setOpen(false), 150);
        }}
        placeholder={inputPlaceholder}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
      />
      {loading && (
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          …
        </div>
      )}
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-emerald-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void pickSuggestion(item)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && apiKey && (
        <p className="mt-1 text-xs text-amber-700">{error}</p>
      )}
    </div>
  );
}
