"use client";

import { X } from "lucide-react";
import type { LocationAnchor } from "@/lib/api";
import {
  LEAD_SCORE_OPTIONS,
  PROPERTY_TYPES,
  TENANT_TYPES,
  URGENCY_OPTIONS,
} from "@/lib/contact-roles";
import { BHK_OPTIONS } from "@/lib/inventory-presets";
import { formatFileSize, mediaKind, validateMediaFiles } from "@/lib/media-validation";
import { prepareMediaFiles } from "@/lib/compress-video";
import { GooglePlacesInput } from "@/components/google-places-input";
import { PropertyMapPin } from "@/components/property-map-pin";
import { FormSelect, Input, Textarea } from "@/components/ui";

export type SupplyPropertyValues = {
  property_types: string[];
  city: string;
  location_anchors: LocationAnchor[];
  city_center: { lat: number; lng: number } | null;
  pin_lat: number | null;
  pin_lng: number | null;
  bhk: string;
  preferred_tenant_types: string[];
  budget_max: string;
  rent_budget: string;
  security_deposit: string;
  maintenance: string;
  urgency: string;
  move_in_date: string;
  lead_score: string;
  notes: string;
  media_files: File[];
};

export const emptySupplyPropertyValues = (): SupplyPropertyValues => ({
  property_types: [],
  city: "",
  location_anchors: [],
  city_center: null,
  pin_lat: null,
  pin_lng: null,
  bhk: "",
  preferred_tenant_types: [],
  budget_max: "",
  rent_budget: "",
  security_deposit: "",
  maintenance: "",
  urgency: "",
  move_in_date: "",
  lead_score: "",
  notes: "",
  media_files: [],
});

export function validateSupplyPropertyValues(
  values: SupplyPropertyValues,
  role: "landlord" | "seller"
): string | null {
  if (!values.property_types.length) return "Select a property type.";
  if (!values.city.trim()) return "City is required.";
  if (!values.location_anchors.length) return "Property area is required.";
  if (values.pin_lat == null || values.pin_lng == null) {
    return "Pin the exact property location on the map.";
  }
  if (!values.bhk) return "BHK is required.";
  if (role === "landlord") {
    if (!values.rent_budget || Number(values.rent_budget) <= 0) return "Asking rent is required.";
    if (values.security_deposit === "" || Number(values.security_deposit) < 0) {
      return "Security deposit is required.";
    }
    if (values.maintenance === "" || Number(values.maintenance) < 0) {
      return "Maintenance is required.";
    }
  }
  if (role === "seller") {
    if (!values.budget_max || Number(values.budget_max) <= 0) return "Asking price is required.";
  }
  if (!values.urgency) return "Urgency is required.";
  if (!values.move_in_date) return "Property available from date is required.";
  if (!values.lead_score) return "Lead score is required.";
  if (!values.media_files.length) return "At least one photo is required.";
  const mediaErr = validateMediaFiles(values.media_files);
  if (mediaErr) return mediaErr;
  if (!values.media_files.some((f) => mediaKind(f) === "image")) {
    return "At least one photo (image) is required. Videos alone are not enough.";
  }
  return null;
}

export function SupplyPropertyForm({
  role,
  values,
  onChange,
  mediaBusy,
  mediaStatus,
  mediaProgress,
  mediaError,
  onMediaBusy,
  onMediaStatus,
  onMediaProgress,
  onMediaError,
  intro,
}: {
  role: "landlord" | "seller";
  values: SupplyPropertyValues;
  onChange: (next: SupplyPropertyValues) => void;
  mediaBusy: boolean;
  mediaStatus: string | null;
  mediaProgress: number | null;
  mediaError: string | null;
  onMediaBusy: (v: boolean) => void;
  onMediaStatus: (v: string | null) => void;
  onMediaProgress: (v: number | null) => void;
  onMediaError: (v: string | null) => void;
  intro?: string;
}) {
  const patch = (partial: Partial<SupplyPropertyValues>) => onChange({ ...values, ...partial });

  const setPropertyType = (value: string) => patch({ property_types: [value] });

  const togglePreferredTenantType = (value: string) => {
    if (value === "all") {
      patch({ preferred_tenant_types: [] });
      return;
    }
    const prev = values.preferred_tenant_types;
    patch({
      preferred_tenant_types: prev.includes(value)
        ? prev.filter((x) => x !== value)
        : [...prev, value],
    });
  };

  const onCitySelect = (place: {
    city: string;
    area: string;
    latitude?: number;
    longitude?: number;
  }) => {
    const cityName = place.city || place.area;
    patch({
      city: cityName,
      city_center:
        place.latitude != null && place.longitude != null
          ? { lat: place.latitude, lng: place.longitude }
          : null,
    });
  };

  const setPropertyLocation = (place: {
    area: string;
    city: string;
    latitude?: number;
    longitude?: number;
  }) => {
    if (place.latitude == null || place.longitude == null) return;
    const name = place.area || place.city;
    if (!name) return;
    patch({
      location_anchors: [{ name, lat: place.latitude, lng: place.longitude }],
      city: values.city || place.city,
      // Seed pin from area search if user hasn't pinned yet
      pin_lat: values.pin_lat ?? place.latitude,
      pin_lng: values.pin_lng ?? place.longitude,
    });
  };

  const onMediaPick = async (files: FileList | null) => {
    if (!files?.length) return;
    onMediaBusy(true);
    onMediaError(null);
    onMediaStatus(null);
    onMediaProgress(null);
    try {
      const combined = [...values.media_files, ...Array.from(files)];
      const { files: prepared, error } = await prepareMediaFiles(combined, {
        onStatus: onMediaStatus,
        onProgress: onMediaProgress,
      });
      onMediaError(error);
      if (!error) patch({ media_files: prepared });
    } catch (e) {
      onMediaError(e instanceof Error ? e.message : "Could not process media files.");
    } finally {
      onMediaBusy(false);
      onMediaProgress(null);
    }
  };

  const removeMediaFile = (index: number) => {
    const next = values.media_files.filter((_, i) => i !== index);
    patch({ media_files: next });
    onMediaError(next.length ? validateMediaFiles(next) : null);
    onMediaStatus(null);
  };

  return (
    <div className="space-y-3">
      {intro && <p className="text-sm text-slate-600">{intro}</p>}

      <div>
        <div className="mb-2 text-sm font-medium">Property type *</div>
        <div className="flex flex-wrap gap-2">
          {PROPERTY_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setPropertyType(t.value)}
              className={`rounded-full px-3 py-1 text-sm ${values.property_types.includes(t.value) ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">City *</div>
        <GooglePlacesInput
          mode="city"
          value={values.city}
          onQueryChange={(city) => patch({ city, city_center: null })}
          onSelect={onCitySelect}
          placeholder="Start typing a city..."
          className="min-h-12 w-full rounded-xl border-2 border-slate-200 px-4"
        />
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">Property area *</div>
        <GooglePlacesInput
          mode="area"
          clearOnSelect
          locationBias={values.city_center}
          onSelect={setPropertyLocation}
          placeholder={values.city ? `Area in ${values.city}...` : "Property locality / area..."}
          className="min-h-12 w-full rounded-xl border-2 border-slate-200 px-4"
        />
        {values.location_anchors[0] && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <span className="min-w-0 flex-1 text-sm font-medium text-emerald-900">
              {values.location_anchors[0].name}
            </span>
            <button
              type="button"
              aria-label="Clear area"
              onClick={() => patch({ location_anchors: [] })}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <PropertyMapPin
        value={
          values.pin_lat != null && values.pin_lng != null
            ? { lat: values.pin_lat, lng: values.pin_lng }
            : null
        }
        onChange={(pin) => patch({ pin_lat: pin.lat, pin_lng: pin.lng })}
        center={
          values.location_anchors[0]
            ? { lat: values.location_anchors[0].lat, lng: values.location_anchors[0].lng }
            : values.city_center
        }
      />

      <FormSelect
        value={values.bhk}
        onChange={(v) => patch({ bhk: v })}
        options={BHK_OPTIONS}
        placeholder="Select BHK *"
      />

      {role === "landlord" && (
        <div>
          <div className="mb-2 text-sm font-medium">Preferred tenants</div>
          <p className="mb-2 text-xs text-slate-500">All, or pick one or more types.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => togglePreferredTenantType("all")}
              className={`rounded-full px-3 py-1 text-sm ${values.preferred_tenant_types.length === 0 ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
            >
              All
            </button>
            {TENANT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => togglePreferredTenantType(t.value)}
                className={`rounded-full px-3 py-1 text-sm ${values.preferred_tenant_types.includes(t.value) ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {role === "seller" ? (
        <Input
          placeholder="Asking price *"
          type="number"
          required
          value={values.budget_max}
          onChange={(e) => patch({ budget_max: e.target.value })}
        />
      ) : (
        <div className="space-y-2">
          <Input
            placeholder="Asking rent / month *"
            type="number"
            required
            value={values.rent_budget}
            onChange={(e) => patch({ rent_budget: e.target.value })}
          />
          <Input
            placeholder="Security deposit *"
            type="number"
            required
            value={values.security_deposit}
            onChange={(e) => patch({ security_deposit: e.target.value })}
          />
          <Input
            placeholder="Maintenance / month *"
            type="number"
            required
            value={values.maintenance}
            onChange={(e) => patch({ maintenance: e.target.value })}
          />
        </div>
      )}

      <div>
        <div className="mb-2 text-sm font-medium">Photos & videos *</div>
        <p className="mb-2 text-xs text-slate-500">
          At least one photo required. Images up to 25 MB. Videos up to 100 MB after compression
          (large videos are compressed in your browser automatically). Max 12 files.
        </p>
        <input
          type="file"
          multiple
          disabled={mediaBusy}
          required={values.media_files.length === 0}
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm,.jpg,.jpeg,.png,.webp,.heic,.heif,.mp4,.mov,.webm"
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
          onChange={(e) => {
            void onMediaPick(e.target.files);
            e.target.value = "";
          }}
        />
        {mediaBusy && (
          <p className="mt-2 text-sm text-emerald-700">
            {mediaStatus || "Processing media…"}
            {mediaProgress != null ? ` ${Math.round(mediaProgress * 100)}%` : ""}
          </p>
        )}
        {!mediaBusy && mediaStatus && !mediaError && (
          <p className="mt-2 text-sm text-slate-600">{mediaStatus}</p>
        )}
        {mediaError && <p className="mt-2 text-sm text-red-600">{mediaError}</p>}
        {values.media_files.length > 0 && (
          <ul className="mt-2 space-y-2">
            {values.media_files.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                  {mediaKind(file)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => removeMediaFile(index)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <select
        className="min-h-12 w-full rounded-xl border-2 border-slate-200 px-4"
        value={values.urgency}
        required
        onChange={(e) => patch({ urgency: e.target.value })}
      >
        <option value="">Urgency *</option>
        {URGENCY_OPTIONS.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </select>

      <div>
        <div className="mb-2 text-sm font-medium">Property available from *</div>
        <Input
          type="date"
          required
          value={values.move_in_date}
          onChange={(e) => patch({ move_in_date: e.target.value })}
        />
      </div>

      <select
        className="min-h-12 w-full rounded-xl border-2 border-slate-200 px-4"
        value={values.lead_score}
        required
        onChange={(e) => patch({ lead_score: e.target.value })}
      >
        <option value="">Lead score *</option>
        {LEAD_SCORE_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <Textarea
        placeholder="Notes (optional)"
        value={values.notes}
        onChange={(e) => patch({ notes: e.target.value })}
      />
    </div>
  );
}
