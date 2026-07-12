"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { listingsApi, mediaUrl, type Listing } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { listingStatusLabel } from "@/components/status-pills";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, EmptyState, Input, LoadingSpinner } from "@/components/ui";

type StatusFilter = "available" | "unavailable" | "all";

export default function PropertiesPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [query, setQuery] = useState("");
  const [stream, setStream] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("available");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listingsApi
      .list({
        q: query || undefined,
        stream_type: stream || undefined,
        status: statusFilter,
        sync: true,
      })
      .then(setListings)
      .finally(() => setLoading(false));
  }, [query, stream, statusFilter]);

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
              statusFilter === "available"
                ? "No available properties. Add one, or check Unavailable."
                : "No properties for this filter."
            }
          />
          <Link href="/listings/new" className="block">
            <Button className="w-full">Add property</Button>
          </Link>
          <p className="text-center text-xs text-slate-500">
            Pick an existing landlord/seller to add another property under the same person.
          </p>
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
