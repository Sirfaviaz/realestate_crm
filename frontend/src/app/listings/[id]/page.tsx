"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { listingsApi, mediaUrl, type Listing } from "@/lib/api";
import { formatPrice, formatSqft } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, LoadingSpinner } from "@/components/ui";

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [mediaIndex, setMediaIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    listingsApi.get(id).then(setListing).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <AppShell>
        <LoadingSpinner />
      </AppShell>
    );
  }

  if (!listing) {
    return (
      <AppShell>
        <div>Listing not found</div>
      </AppShell>
    );
  }

  const media = listing.media || [];
  const current = media[mediaIndex];

  return (
    <AppShell>
      <Link href="/listings" className="mb-3 flex items-center gap-1 text-sm text-slate-600">
        <ChevronLeft className="h-4 w-4" /> Back to Properties
      </Link>

      <Card className="mb-4 overflow-hidden p-0">
        <div className="aspect-video bg-slate-200">
          {current?.url ? (
            current.media_type === "video" ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={mediaUrl(current.url) || ""} controls className="h-full w-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(current.url) || ""} alt="" className="h-full w-full object-cover" />
            )
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">No media</div>
          )}
        </div>
        {media.length > 1 && (
          <div className="flex gap-1 overflow-x-auto p-2">
            {media.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMediaIndex(i)}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${i === mediaIndex ? "border-emerald-500" : "border-transparent"}`}
              >
                {m.media_type === "video" ? (
                  <div className="flex h-full items-center justify-center bg-slate-800 text-xs text-white">Video</div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(m.url) || ""} alt="" className="h-full w-full object-cover" />
                )}
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="mb-2 text-2xl font-bold">{formatPrice(listing.price, listing.stream_type)}</div>
      <h1 className="mb-1 text-lg font-semibold">{listing.title}</h1>
      {listing.location_text && <div className="mb-3 text-slate-600">{listing.location_text}</div>}
      <div className="mb-4 flex gap-2">
        {listing.bhk && <Badge>{listing.bhk}</Badge>}
        {listing.sqft && <Badge>{formatSqft(listing.sqft)}</Badge>}
        <Badge className="capitalize">{listing.status}</Badge>
      </div>
      {listing.stream_type === "rental" && (
        <div className="mb-4 space-y-1 text-sm text-slate-600">
          {listing.monthly_rent != null && <div>Rent: {formatPrice(listing.monthly_rent, "rental")}</div>}
          {listing.security_deposit != null && <div>Deposit: {formatPrice(listing.security_deposit, "sales")}</div>}
          {listing.maintenance != null && <div>Maintenance: {formatPrice(listing.maintenance, "rental")}</div>}
        </div>
      )}
      {listing.description && <p className="mb-4 text-sm text-slate-600">{listing.description}</p>}

      {listing.contact_whatsapp && (
        <a
          href={whatsappLink(listing.contact_whatsapp, {
            type: "listing",
            title: listing.title,
            location: listing.location_text || undefined,
          })}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-green-600 font-medium text-white"
        >
          WhatsApp {listing.contact_name || "owner"}
        </a>
      )}
    </AppShell>
  );
}
