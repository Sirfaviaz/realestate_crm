"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LocateFixed, Plus } from "lucide-react";
import { listingsApi, mediaUrl, type Listing } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { listingStatusLabel } from "@/components/status-pills";
import { GooglePlacesInput } from "@/components/google-places-input";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, EmptyState, Input, LoadingSpinner } from "@/components/ui";

type StatusFilter = "available" | "unavailable" | "all";

const RADIUS_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Any distance" },
  { value: 2, label: "2 km" },
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
  { value: 20, label: "20 km" },
];

export default function PropertiesPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [query, setQuery] = useState("");
  const [stream, setStream] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("available");
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [near, setNear] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [nearError, setNearError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setNearError("Location not supported on this device");
      return;
    }
    setLocating(true);
    setNearError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNear({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "Current location",
        });
        if (radiusKm == null) setRadiusKm(5);
        setLocating(false);
      },
      (err) => {
        setNearError(err.message || "Could not get current location");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  useEffect(() => {
    setLoading(true);
    const nearby = radiusKm != null && near != null;
    listingsApi
      .list({
        q: query || undefined,
        stream_type: stream || undefined,
        status: statusFilter,
        sync: true,
        lat: nearby ? near.lat : undefined,
        lng: nearby ? near.lng : undefined,
        radius_km: nearby ? radiusKm : undefined,
      })
      .then(setListings)
      .finally(() => setLoading(false));
  }, [query, stream, statusFilter, radiusKm, near]);

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Properties</h1>
        <Link href="/listings/new">
          <Button className="min-h-10 px-3 text-sm">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </Link>
      </div>
      <Input
        className="mb-3"
        placeholder="Search location or title..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="mb-2">
        <div className="mb-1.5 text-xs font-medium text-slate-500">Nearby radius</div>
        <div className="flex gap-2 overflow-x-auto">
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => {
                setRadiusKm(r.value);
                if (r.value != null && !near) useCurrentLocation();
              }}
              className={`shrink-0 rounded-full px-3 py-1 text-sm ${
                radiusKm === r.value ? "bg-emerald-600 text-white" : "bg-slate-100"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {radiusKm != null && (
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 disabled:opacity-50"
            >
              <LocateFixed className="h-4 w-4" />
              {locating ? "Locating…" : "Near me"}
            </button>
            {near && (
              <span className="inline-flex min-h-10 items-center rounded-xl bg-emerald-50 px-3 text-sm text-emerald-900">
                {near.label}
                <button
                  type="button"
                  className="ml-2 text-emerald-700 underline"
                  onClick={() => setNear(null)}
                >
                  Clear
                </button>
              </span>
            )}
          </div>
          <GooglePlacesInput
            mode="area"
            clearOnSelect
            placeholder="Or search a place to search near…"
            className="min-h-12 w-full rounded-xl border-2 border-slate-200 px-4"
            onSelect={(p) => {
              if (p.latitude == null || p.longitude == null) {
                setNearError("That place has no coordinates");
                return;
              }
              setNearError(null);
              setNear({
                lat: p.latitude,
                lng: p.longitude,
                label: [p.area, p.city].filter(Boolean).join(", ") || "Selected place",
              });
            }}
          />
          {nearError && <p className="text-sm text-red-600">{nearError}</p>}
          {!near && !locating && (
            <p className="text-xs text-amber-700">Choose Near me or a place to filter by radius.</p>
          )}
        </div>
      )}

      <div className="mb-2 flex gap-2 overflow-x-auto">
        {(["", "sales", "rental"] as const).map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStream(s)}
            className={`shrink-0 rounded-full px-3 py-1 text-sm ${stream === s ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
          >
            {s === "" ? "All" : s === "sales" ? "Sale" : "Rent"}
          </button>
        ))}
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {(
          [
            { value: "available", label: "Available" },
            { value: "unavailable", label: "Unavailable" },
            { value: "all", label: "All statuses" },
          ] as const
        ).map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatusFilter(s.value)}
            className={`shrink-0 rounded-full px-3 py-1 text-sm ${statusFilter === s.value ? "bg-slate-800 text-white" : "bg-slate-100"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : listings.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            message={
              radiusKm != null && near
                ? `No properties within ${radiusKm} km of ${near.label}.`
                : statusFilter === "available"
                  ? "No available properties. Add one, or check Unavailable."
                  : "No properties for this filter."
            }
          />
          <Link href="/listings/new" className="block">
            <Button className="w-full">Add property</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {listings.map((l) => (
            <Link key={l.id} href={`/listings/${l.id}`}>
              <Card className="overflow-hidden p-0">
                <div className="aspect-[4/3] bg-slate-200">
                  {l.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(l.cover_url) || ""} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">No photo</div>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-semibold">{formatPrice(l.price, l.stream_type)}</div>
                  <div className="line-clamp-1 text-sm text-slate-600">{l.title}</div>
                  {l.contact_name && (
                    <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">{l.contact_name}</div>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {l.bhk && <Badge>{l.bhk}</Badge>}
                    <Badge className="capitalize">{l.stream_type === "sales" ? "Sale" : "Rent"}</Badge>
                    {l.distance_km != null && (
                      <Badge className="bg-sky-100 text-sky-900">{l.distance_km} km</Badge>
                    )}
                    {l.status !== "available" && (
                      <Badge className="bg-amber-100 text-amber-900">{listingStatusLabel(l.status)}</Badge>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
