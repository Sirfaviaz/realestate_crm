"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listingsApi, mediaUrl, type Listing } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, EmptyState, Input, LoadingSpinner } from "@/components/ui";

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [query, setQuery] = useState("");
  const [stream, setStream] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listingsApi.list({ q: query || undefined, stream_type: stream || undefined })
      .then(setListings)
      .finally(() => setLoading(false));
  }, [query, stream]);

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl font-bold">Listings</h1>
      <Input className="mb-3" placeholder="Search location or title..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="mb-4 flex gap-2">
        {["", "sales", "rental"].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStream(s)}
            className={`rounded-full px-3 py-1 text-sm ${stream === s ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
          >
            {s === "" ? "All" : s === "sales" ? "Buy & Sell" : "Rent & Let"}
          </button>
        ))}
      </div>
      {loading ? <LoadingSpinner /> : listings.length === 0 ? (
        <EmptyState message="No listings found" />
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
                  <div className="text-sm text-slate-600 line-clamp-1">{l.title}</div>
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
