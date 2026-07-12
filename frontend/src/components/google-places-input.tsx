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

export type PlacesLocationBias = {
  lat: number;
  lng: number;
  /** Search bias radius in meters (default 35km). */
  radiusMeters?: number;
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

function parsePlace(place: google.maps.places.Place, mode: "area" | "city"): PlaceSelection {
  const components = place.addressComponents || [];
  const get = (type: string) =>
    components.find((c) => c.types.includes(type))?.longText || undefined;
  const locality = get("locality");
  const admin2 = get("administrative_area_level_2");
  const area =
    get("sublocality") ||
    get("sublocality_level_1") ||
    get("neighborhood") ||
    locality ||
    "";
  const city = locality || admin2 || "";
  const state = get("administrative_area_level_1");
  const pin_code = get("postal_code");
  const { lat, lng } = readLatLng(place.location);

  if (mode === "city") {
    const cityName =
      locality || admin2 || place.displayName || place.formattedAddress?.split(",")[0] || "";
    return {
      area: cityName,
      city: cityName,
      state: state || undefined,
      pin_code: pin_code || undefined,
      latitude: lat,
      longitude: lng,
      google_place_id: place.id,
    };
  }

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
  mode = "area",
  locationBias,
  value,
  onQueryChange,
  clearOnSelect = false,
}: {
  onSelect: (place: PlaceSelection) => void;
  placeholder?: string;
  className?: string;
  /** `city` limits suggestions to cities/localities. */
  mode?: "area" | "city";
  /** Bias area suggestions near a selected city center. */
  locationBias?: PlacesLocationBias | null;
  /** Controlled text (e.g. city name). */
  value?: string;
  onQueryChange?: (value: string) => void;
  /** Clear the input after a successful selection (area chips). */
  clearOnSelect?: boolean;
}) {
  const listId = useId();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const onSelectRef = useRef(onSelect);
  const onQueryChangeRef = useRef(onQueryChange);
  const locationBiasRef = useRef(locationBias);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState(value ?? "");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onQueryChangeRef.current = onQueryChange;
  }, [onQueryChange]);

  useEffect(() => {
    locationBiasRef.current = locationBias;
  }, [locationBias]);

  useEffect(() => {
    if (value !== undefined && value !== query) {
      setQuery(value);
    }
    // Only sync from external value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

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

  async function fetchSuggestions(searchValue: string) {
    if (!apiKey || !ready || searchValue.trim().length < 2) {
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

      const bias = locationBiasRef.current;
      const request: google.maps.places.AutocompleteRequest = {
        input: searchValue,
        includedRegionCodes: ["in"],
        sessionToken: sessionTokenRef.current,
      };

      if (mode === "city") {
        request.includedPrimaryTypes = ["locality", "administrative_area_level_2"];
      } else if (bias) {
        request.locationBias = {
          center: { lat: bias.lat, lng: bias.lng },
          radius: bias.radiusMeters ?? 35000,
        };
      }

      const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

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

  function onChange(next: string) {
    setQuery(next);
    onQueryChangeRef.current?.(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(next);
    }, 250);
  }

  async function pickSuggestion(item: SuggestionItem) {
    setSuggestions([]);
    setOpen(false);
    setLoading(true);
    try {
      const place = item.prediction.toPlace();
      await place.fetchFields({
        fields: ["id", "displayName", "formattedAddress", "location", "addressComponents"],
      });
      const parsed = parsePlace(place, mode);
      const display =
        mode === "city"
          ? parsed.city
          : [parsed.area, parsed.city].filter(Boolean).join(", ") || item.label;
      if (clearOnSelect) {
        setQuery("");
        onQueryChangeRef.current?.("");
      } else {
        setQuery(display);
        onQueryChangeRef.current?.(display);
      }
      onSelectRef.current(parsed);
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
      {error && apiKey && <p className="mt-1 text-xs text-amber-700">{error}</p>}
    </div>
  );
}
