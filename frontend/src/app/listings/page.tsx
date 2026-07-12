"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { listingsApi, mediaUrl, type Listing } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, EmptyState, Input, LoadingSpinner } from "@/components/ui";

export default function PropertiesPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [query, setQuery] = useState("");
  const [stream, setStream] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listingsApi
      .list({ q: query || undefined, stream_type: stream || undefined })
      .then(setListings)
      .finally(() => setLoading(false));
  }, [query, stream]);

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Properties</h1>
        <Link href="/admin/inventory">
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
      <div className="mb-4 flex gap-2">
        {["", "sales", "rental"].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStream(s)}
            className={`rounded-full px-3 py-1 text-sm ${stream === s ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
          >
            {s === "" ? "All" : s === "sales" ? "Sale" : "Rent"}
          </button>
        ))}
      </div>
      {loading ? (
        <LoadingSpinner />
      ) : listings.length === 0 ? (
        <div className="space-y-4">
          <EmptyState message="No properties yet. Add a sale or rental listing to show here." />
          <Link href="/admin/inventory" className="block">
            <Button className="w-full">Add property</Button>
          </Link>
          <p className="text-center text-xs text-slate-500">
            Landlord/seller leads are tracked under Leads. Use Add property when you want a photo listing in inventory.
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
                  <div className="mt-1 flex gap-1">
                    {l.bhk && <Badge>{l.bhk}</Badge>}
                    <Badge className="capitalize">{l.stream_type === "sales" ? "Sale" : "Rent"}</Badge>
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
