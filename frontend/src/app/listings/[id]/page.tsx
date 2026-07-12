"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Plus, Search, X } from "lucide-react";
import {
  contactsApi,
  listingsApi,
  mediaUrl,
  requirementsApi,
  type LeadRequirement,
  type Listing,
} from "@/lib/api";
import { PROPERTY_TYPES } from "@/lib/contact-roles";
import { formatPrice, formatSqft } from "@/lib/utils";
import { shareViaWhatsApp, whatsappMessage } from "@/lib/whatsapp";
import {
  LISTING_STATUS_OPTIONS,
  StatusPills,
  listingStatusLabel,
} from "@/components/status-pills";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, EmptyState, Input, ListItem, LoadingSpinner } from "@/components/ui";

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [demandQuery, setDemandQuery] = useState("");
  const [demandLeads, setDemandLeads] = useState<LeadRequirement[]>([]);
  const [loadingDemand, setLoadingDemand] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendNote, setSendNote] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    listingsApi.get(id).then(setListing).finally(() => setLoading(false));
  }, [id]);

  const demandRole = listing?.stream_type === "sales" ? "buyer" : "renter";

  useEffect(() => {
    if (!pickerOpen || !listing) return;
    setLoadingDemand(true);
    const t = setTimeout(() => {
      requirementsApi
        .list({ role: demandRole, q: demandQuery || undefined })
        .then((rows) =>
          setDemandLeads(rows.filter((r) => r.status === "active" || r.status === "matched"))
        )
        .finally(() => setLoadingDemand(false));
    }, 250);
    return () => clearTimeout(t);
  }, [pickerOpen, listing, demandRole, demandQuery]);

  const setStatus = async (status: string) => {
    if (!listing || listing.status === status) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await listingsApi.update(listing.id, { status });
      setListing(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setSaving(false);
    }
  };

  const propertyImages = useMemo(() => {
    if (!listing) return [] as string[];
    const urls = (listing.media || [])
      .filter((m) => m.media_type === "image")
      .map((m) => mediaUrl(m.url) || "")
      .filter(Boolean);
    if (!urls.length && listing.cover_url) {
      const cover = mediaUrl(listing.cover_url);
      if (cover) urls.push(cover);
    }
    return urls;
  }, [listing]);

  const sendToLead = async (lead: LeadRequirement) => {
    if (!listing) return;
    const phone = lead.contact_whatsapp || lead.contact_phone;
    if (!phone) {
      setError("This person has no phone/WhatsApp number");
      return;
    }

    setSendingId(lead.id);
    setError(null);
    setSendNote(null);
    try {
      const typeLabel = listing.property_type
        ? PROPERTY_TYPES.find((p) => p.value === listing.property_type)?.label || listing.property_type
        : undefined;
      const priceStr =
        listing.price != null ? formatPrice(listing.price, listing.stream_type) : undefined;
      const deposit =
        listing.security_deposit != null
          ? formatPrice(listing.security_deposit, "sales")
          : undefined;
      const maintenance =
        listing.maintenance != null
          ? formatPrice(listing.maintenance, "rental")
          : undefined;
      const detailsLine = [listing.title, listing.location_text, listing.bhk, priceStr]
        .filter(Boolean)
        .join(" · ");

      const text = whatsappMessage({
        type: "property_for_renter",
        name: lead.contact_name || "there",
        location: listing.location_text || undefined,
        bhk: listing.bhk || undefined,
        propertyType: typeLabel,
        price: priceStr,
        deposit: listing.stream_type === "rental" ? deposit : undefined,
        maintenance: listing.stream_type === "rental" ? maintenance : undefined,
        photoNote: propertyImages.length
          ? `(${propertyImages.length} property photo${propertyImages.length > 1 ? "s" : ""} attached if share sheet supports it — otherwise please attach from gallery)`
          : undefined,
      });

      await shareViaWhatsApp({
        phone,
        text,
        imageUrls: propertyImages,
      });

      await contactsApi.addActivity({
        contact_id: lead.contact_id,
        activity_type: "whatsapp",
        content: `Sent property details: ${detailsLine} (/listings/${listing.id})`,
      });

      // If this listing is already a match for the lead, mark informed → follow-up
      try {
        const matches = await requirementsApi.matches(lead.id);
        const match = matches.find(
          (m) => m.listing_id === listing.id && m.status !== "rejected" && m.status !== "closed"
        );
        if (match) {
          await requirementsApi.informMatch(lead.id, match.id, "whatsapp", detailsLine);
        }
      } catch {
        // Inform is best-effort; WhatsApp + activity already done
      }

      setSendNote(`Sent to ${lead.contact_name || "renter"}`);
      setPickerOpen(false);
      setDemandQuery("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSendingId(null);
    }
  };

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
  const isTerminal = listing.status === "sold" || listing.status === "rented";
  const statusOptions = isTerminal
    ? [
        ...LISTING_STATUS_OPTIONS,
        { value: listing.status, label: listingStatusLabel(listing.status) },
      ]
    : LISTING_STATUS_OPTIONS;
  const recipientLabel = listing.stream_type === "sales" ? "buyer" : "renter";

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
      {listing.location_text && <div className="mb-1 text-slate-600">{listing.location_text}</div>}
      {listing.contact_name && (
        <div className="mb-3 text-sm text-slate-500">
          Owner: {listing.contact_name}
          {listing.contact_phone ? ` · ${listing.contact_phone}` : ""}
        </div>
      )}
      <div className="mb-4 flex gap-2">
        {listing.bhk && <Badge>{listing.bhk}</Badge>}
        {listing.sqft && <Badge>{formatSqft(listing.sqft)}</Badge>}
        <Badge className="capitalize">{listing.stream_type === "sales" ? "Sale" : "Rent"}</Badge>
      </div>

      <Card className="mb-4 space-y-2">
        <div className="text-sm font-semibold text-slate-800">Status</div>
        <p className="text-xs text-slate-500">
          Unavailable and on-hold properties leave matching and the Available list.
        </p>
        <StatusPills
          value={listing.status}
          options={statusOptions}
          onChange={setStatus}
          disabled={saving || isTerminal}
        />
        {isTerminal && (
          <p className="text-xs text-slate-500">
            Marked {listingStatusLabel(listing.status)} from a closed deal.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {sendNote && <p className="text-sm text-emerald-700">{sendNote}</p>}
      </Card>

      {listing.stream_type === "rental" && (
        <div className="mb-4 space-y-1 text-sm text-slate-600">
          {listing.monthly_rent != null && <div>Rent: {formatPrice(listing.monthly_rent, "rental")}</div>}
          {listing.security_deposit != null && <div>Deposit: {formatPrice(listing.security_deposit, "sales")}</div>}
          {listing.maintenance != null && <div>Maintenance: {formatPrice(listing.maintenance, "rental")}</div>}
        </div>
      )}
      {listing.description && <p className="mb-4 text-sm text-slate-600">{listing.description}</p>}

      {listing.contact_id && (
        <Link
          href={`/listings/new?contact_id=${listing.contact_id}&stream=${listing.stream_type}`}
          className="mb-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 font-medium text-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add another property for {listing.contact_name || "this owner"}
        </Link>
      )}

      {!pickerOpen ? (
        <Button
          className="w-full bg-green-600 hover:bg-green-700"
          onClick={() => {
            setPickerOpen(true);
            setSendNote(null);
            setError(null);
          }}
        >
          <Search className="h-4 w-4" />
          Send to {recipientLabel}
        </Button>
      ) : (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-800">
              Choose a {recipientLabel}
            </div>
            <button
              type="button"
              onClick={() => {
                setPickerOpen(false);
                setDemandQuery("");
              }}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Search and select who should get this property’s details on WhatsApp.
          </p>
          <Input
            placeholder={`Search ${recipientLabel} name or phone…`}
            value={demandQuery}
            onChange={(e) => setDemandQuery(e.target.value)}
            autoFocus
          />
          {loadingDemand ? (
            <LoadingSpinner />
          ) : demandLeads.length === 0 ? (
            <EmptyState message={`No active ${recipientLabel}s found. Create a lead first.`} />
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {demandLeads.map((lead) => {
                const budget =
                  lead.stream_type === "rental" && lead.rent_budget != null
                    ? formatPrice(lead.rent_budget, "rental")
                    : lead.budget_max != null || lead.budget_min != null
                      ? `${formatPrice(lead.budget_min, "sales")} – ${formatPrice(lead.budget_max, "sales")}`
                      : null;
                const areas =
                  lead.preferred_locations?.join(", ") ||
                  (lead.location_anchors || []).map((a) => a.name).filter(Boolean).join(", ") ||
                  lead.city;
                return (
                  <ListItem
                    key={lead.id}
                    title={lead.contact_name || "Unknown"}
                    subtitle={[lead.contact_phone, lead.bhk, areas, budget].filter(Boolean).join(" · ")}
                    onClick={() => sendToLead(lead)}
                    right={
                      sendingId === lead.id ? (
                        <span className="text-xs text-slate-500">Sending…</span>
                      ) : (
                        <span className="text-xs font-medium text-green-700">WhatsApp</span>
                      )
                    }
                  />
                );
              })}
            </div>
          )}
        </Card>
      )}
    </AppShell>
  );
}
