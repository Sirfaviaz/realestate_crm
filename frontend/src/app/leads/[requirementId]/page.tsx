"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Phone, RefreshCw } from "lucide-react";
import {
  contactsApi,
  listingsApi,
  mediaUrl,
  requirementsApi,
  type Activity,
  type LeadRequirement,
  type Listing,
  type RequirementMatch,
} from "@/lib/api";
import { PROPERTY_TYPES, TENANT_TYPES, roleLabel } from "@/lib/contact-roles";
import { formatPrice } from "@/lib/utils";
import { shareViaWhatsApp, tenantTypeLabel, whatsappLink, whatsappMessage } from "@/lib/whatsapp";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, EmptyState, LoadingSpinner } from "@/components/ui";

export default function RequirementDetailPage() {
  const { requirementId } = useParams<{ requirementId: string }>();
  const [req, setReq] = useState<LeadRequirement | null>(null);
  const [matches, setMatches] = useState<RequirementMatch[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  const load = async (opts?: { findMatches?: boolean }) => {
    if (!requirementId) return;
    setLoading(true);
    try {
      if (opts?.findMatches) {
        try {
          await requirementsApi.findMatches(requirementId);
        } catch {
          // Matching may fail if backend is still updating; still load existing data.
        }
      }
      const [r, m] = await Promise.all([
        requirementsApi.get(requirementId),
        requirementsApi.matches(requirementId),
      ]);
      setReq(r);
      setMatches(m);
      if (r.contact_id) {
        setActivities(await contactsApi.activities(r.contact_id));
        if (r.role === "landlord" || r.role === "seller") {
          setListings(await listingsApi.list({ contact_id: r.contact_id }));
        } else {
          setListings([]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ findMatches: true });
  }, [requirementId]);

  const refreshMatches = async () => {
    if (!requirementId) return;
    setLoading(true);
    try {
      await requirementsApi.findMatches(requirementId);
      setMatches(await requirementsApi.matches(requirementId));
      setReq(await requirementsApi.get(requirementId));
    } finally {
      setLoading(false);
    }
  };

  const propertyListing = listings[0] || null;
  const propertyImages: string[] = (propertyListing?.media || [])
    .filter((m) => m.media_type === "image")
    .map((m) => mediaUrl(m.url) || "")
    .filter(Boolean);
  const coverOnly = propertyListing?.cover_url ? mediaUrl(propertyListing.cover_url) : null;
  if (!propertyImages.length && coverOnly) propertyImages.push(coverOnly);

  const supplySummary = (r: LeadRequirement) => {
    const locs = r.preferred_locations?.length
      ? r.preferred_locations.join(", ")
      : r.city || undefined;
    const typeLabel = r.property_types?.[0]
      ? PROPERTY_TYPES.find((p) => p.value === r.property_types![0])?.label || r.property_types[0]
      : undefined;
    const priceStr =
      r.stream_type === "rental" && r.rent_budget != null
        ? formatPrice(r.rent_budget, "rental")
        : r.budget_max != null || r.budget_min != null
          ? formatPrice(r.budget_max || r.budget_min, "sales")
          : undefined;
    const deposit =
      r.security_deposit != null ? formatPrice(r.security_deposit, "sales") : undefined;
    const maintenance =
      r.maintenance != null ? formatPrice(r.maintenance, "rental") : undefined;
    const availableFrom = r.move_in_date
      ? new Date(r.move_in_date).toLocaleDateString()
      : undefined;
    const parts = [
      r.bhk,
      typeLabel,
      locs,
      priceStr ? `Rent ${priceStr}` : null,
      deposit ? `Deposit ${deposit}` : null,
      maintenance ? `Maintenance ${maintenance}` : null,
      availableFrom ? `Available ${availableFrom}` : null,
      propertyImages.length ? `${propertyImages.length} photo(s)` : null,
    ].filter(Boolean);
    return {
      locs,
      typeLabel,
      priceStr,
      deposit,
      maintenance,
      availableFrom,
      text: parts.join(" · "),
    };
  };

  const tenantBudget = (r: LeadRequirement) => {
    if (r.stream_type === "rental" && r.rent_budget != null) {
      return formatPrice(r.rent_budget, "rental");
    }
    if (r.stream_type === "sales" && (r.budget_min || r.budget_max)) {
      return `${formatPrice(r.budget_min, "sales")} – ${formatPrice(r.budget_max, "sales")}`;
    }
    return undefined;
  };

  const shareTenantWithLandlord = (landlordPhone: string | null | undefined) => {
    if (!req || !landlordPhone) return;
    window.open(
      whatsappLink(landlordPhone, {
        type: "tenant_for_landlord",
        name: req.contact_name || "Tenant",
        tenantType: tenantTypeLabel(req.tenant_type),
        occupants: req.occupant_count ?? undefined,
        profession: req.profession ?? undefined,
        workplace: req.workplace_text ?? undefined,
        budget: tenantBudget(req),
        moveIn: req.move_in_date ? new Date(req.move_in_date).toLocaleDateString() : undefined,
      }),
      "_blank"
    );
  };

  const inform = async (match: RequirementMatch, via: "call" | "whatsapp") => {
    if (!requirementId || !req) return;
    const phone = match.contact_whatsapp || match.contact_phone;
    const isSupply = req.role === "landlord" || req.role === "seller";
    let sentNotes: string | undefined;

    if (via === "whatsapp" && phone) {
      setSharing(true);
      try {
        if (isSupply) {
          const summary = supplySummary(req);
          sentNotes = summary.text;
          const text = whatsappMessage({
            type: "property_for_renter",
            name: match.contact_name || "there",
            location: summary.locs,
            bhk: req.bhk || undefined,
            propertyType: summary.typeLabel,
            price: summary.priceStr,
            deposit: summary.deposit,
            maintenance: summary.maintenance,
            availableFrom: summary.availableFrom,
            photoNote: propertyImages.length
              ? `(${propertyImages.length} property photo${propertyImages.length > 1 ? "s" : ""} attached if share sheet supports it — otherwise please attach from gallery)`
              : undefined,
          });
          await shareViaWhatsApp({
            phone,
            text,
            imageUrls: propertyImages,
          });
        } else {
          const priceStr =
            match.price != null ? formatPrice(match.price, req.stream_type) : undefined;
          sentNotes = [match.title, match.location, match.bhk, priceStr].filter(Boolean).join(" · ");
          const cover = match.cover_url ? mediaUrl(match.cover_url) : null;
          const text = whatsappMessage({
            type: "match_found",
            name: match.contact_name || "there",
            title: match.title || "property",
            location: match.location || undefined,
            bhk: match.bhk || undefined,
            propertyType: match.property_type || undefined,
            price: priceStr,
          });
          await shareViaWhatsApp({
            phone,
            text,
            imageUrls: cover ? [cover] : [],
          });
        }
      } finally {
        setSharing(false);
      }
    } else if (via === "call" && match.contact_phone) {
      window.location.href = `tel:${match.contact_phone}`;
      sentNotes = isSupply ? supplySummary(req).text : match.title || undefined;
    }

    await requirementsApi.informMatch(requirementId, match.id, via, sentNotes);
    await load();
  };

  const rejectMatch = async (matchId: string) => {
    if (!requirementId) return;
    await requirementsApi.updateMatchStatus(requirementId, matchId, "rejected");
    await load();
  };

  const hasTenantProfile =
    req &&
    (req.tenant_type ||
      req.occupant_count ||
      req.profession ||
      req.workplace_text);

  const visibleMatches = matches.filter(
    (m) => m.status !== "rejected" && m.status !== "closed"
  );

  if (loading || !req) {
    return (
      <AppShell>
        <LoadingSpinner />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link href="/leads" className="mb-3 flex items-center gap-1 text-sm text-slate-600">
        <ChevronLeft className="h-4 w-4" /> Back to leads
      </Link>

      <Card className="mb-4">
        <div className="mb-1 text-sm text-slate-500">{req.contact_name} · {req.contact_phone}</div>
        <div className="flex flex-wrap gap-2">
          <Badge>{roleLabel(req.role)}</Badge>
          <Badge className="capitalize">{req.status}</Badge>
          {req.lead_score && <Badge className="capitalize">{req.lead_score}</Badge>}
        </div>
        <div className="mt-3 space-y-1 text-sm text-slate-600">
          {req.property_types?.length ? (
            <div>Types: {req.property_types.map((t) => PROPERTY_TYPES.find((p) => p.value === t)?.label || t).join(", ")}</div>
          ) : null}
          {req.preferred_locations?.length || req.location_anchors?.length ? (
            <div>
              {req.role === "landlord" || req.role === "seller" ? "Property area" : "Preferred areas"}:{" "}
              {(req.preferred_locations?.length
                ? req.preferred_locations
                : (req.location_anchors || []).map((a) => a.name).filter(Boolean)
              )
                .map((loc, i) => (req.role === "landlord" || req.role === "seller" ? loc : `${i + 1}. ${loc}`))
                .join(" · ")}
            </div>
          ) : null}
          {req.city && <div>City: {req.city}</div>}
          {req.search_radius_km != null && req.role !== "landlord" && req.role !== "seller" && (
            <div>Radius: {req.search_radius_km === 0 ? "Whole city" : `${req.search_radius_km} km`}</div>
          )}
          {req.bhk && <div>BHK: {req.bhk}</div>}
          {req.role === "landlord" && (
            <div>
              Preferred tenants:{" "}
              {req.preferred_tenant_types?.length
                ? req.preferred_tenant_types
                    .map((t) => TENANT_TYPES.find((x) => x.value === t)?.label || t)
                    .join(", ")
                : "All"}
            </div>
          )}
          {req.stream_type === "rental" && req.rent_budget != null && (
            <div>
              {req.role === "landlord" ? "Asking rent" : "Budget"}: {formatPrice(req.rent_budget, "rental")}
            </div>
          )}
          {req.role === "landlord" && req.security_deposit != null && (
            <div>Deposit: {formatPrice(req.security_deposit, "sales")}</div>
          )}
          {req.role === "landlord" && req.maintenance != null && (
            <div>Maintenance: {formatPrice(req.maintenance, "rental")}</div>
          )}
          {req.stream_type === "sales" && (req.budget_min || req.budget_max) && (
            <div>
              {req.role === "seller" ? "Asking price" : "Budget"}:{" "}
              {req.role === "seller" && req.budget_max != null && !req.budget_min
                ? formatPrice(req.budget_max, "sales")
                : `${formatPrice(req.budget_min, "sales")} – ${formatPrice(req.budget_max, "sales")}`}
            </div>
          )}
          {req.notes && <div className="italic">{req.notes}</div>}
        </div>
        {(req.role === "landlord" || req.role === "seller") && propertyImages.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {propertyImages.slice(0, 6).map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
            ))}
          </div>
        )}
        {(req.contact_phone || req.contact_whatsapp) && (
          <div className="mt-3 flex gap-2">
            {req.contact_phone && (
              <a href={`tel:${req.contact_phone}`} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white">
                <Phone className="h-4 w-4" /> Call
              </a>
            )}
          </div>
        )}
      </Card>

      {hasTenantProfile && (
        <Card className="mb-4">
          <h2 className="mb-2 font-semibold">Tenant profile</h2>
          <div className="space-y-1 text-sm text-slate-600">
            {req.tenant_type && (
              <div>Type: {TENANT_TYPES.find((t) => t.value === req.tenant_type)?.label || tenantTypeLabel(req.tenant_type)}</div>
            )}
            {req.occupant_count != null && <div>Occupants: {req.occupant_count}</div>}
            {req.profession && <div>Profession: {req.profession}</div>}
            {req.workplace_text && <div>Workplace: {req.workplace_text}</div>}
          </div>
        </Card>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">
          Matches ({visibleMatches.length})
          {req.role === "landlord"
            ? " — renters"
            : req.role === "seller"
              ? " — buyers"
              : ""}
        </h2>
        <button type="button" onClick={refreshMatches} className="flex items-center gap-1 text-sm text-emerald-600">
          <RefreshCw className="h-4 w-4" /> Find matches
        </button>
      </div>

      {visibleMatches.length === 0 ? (
        <EmptyState
          message={
            req.role === "landlord"
              ? "No matching renters yet. Create a renter lead in the same city/area, then tap Find matches."
              : req.role === "seller"
                ? "No matching buyers yet. Create a buyer lead, then tap Find matches."
                : "No matches yet. Add listings or a landlord/seller lead, then tap Find matches."
          }
        />
      ) : (
        <div className="mb-6 space-y-3">
          {visibleMatches.map((m) => (
            <Card key={m.id} className={m.status === "new" ? "border-orange-200 bg-orange-50/50" : ""}>
              <div className="flex gap-3">
                {m.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(m.cover_url) || ""} alt="" className="h-20 w-20 rounded-lg object-cover" />
                )}
                <div className="flex-1">
                  <div className="font-semibold">{m.title || (m.matched_role ? roleLabel(m.matched_role) : "Match")}</div>
                  <div className="text-sm text-slate-600">{m.contact_name}{m.location ? ` · ${m.location}` : ""}</div>
                  <div className="text-sm font-medium">{formatPrice(m.price, req.stream_type)}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.matched_role && <Badge>{roleLabel(m.matched_role)}</Badge>}
                    {m.bhk && <Badge>{m.bhk}</Badge>}
                    <Badge className="capitalize">{m.status.replace(/_/g, " ")}</Badge>
                  </div>
                </div>
              </div>

              {(m.status.startsWith("informed") || m.notes || m.follow_up_at) && (
                <div className="mt-3 space-y-1 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {m.informed_at && (
                    <div>
                      Sent via {m.informed_via || "message"} · {new Date(m.informed_at).toLocaleString()}
                    </div>
                  )}
                  {m.notes && <div><span className="font-medium text-slate-800">Property details sent:</span> {m.notes}</div>}
                  {m.follow_up_at && (
                    <div className="font-medium text-amber-800">
                      Follow up {new Date(m.follow_up_at).toLocaleString()}
                      {(req.role === "landlord" || req.role === "seller") && m.contact_name
                        ? ` with ${m.contact_name}`
                        : ""}
                    </div>
                  )}
                </div>
              )}

              {m.status === "new" || m.status.startsWith("informed") || m.status === "follow_up" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(m.contact_phone || m.contact_whatsapp) && (
                    <Button className="text-sm px-3 py-2" variant="outline" onClick={() => inform(m, "call")} disabled={sharing}>
                      Call
                    </Button>
                  )}
                  {(m.contact_whatsapp || m.contact_phone) && (
                    <Button className="text-sm px-3 py-2" onClick={() => inform(m, "whatsapp")} disabled={sharing}>
                      {sharing
                        ? "Opening…"
                        : req.role === "landlord"
                          ? "WhatsApp renter"
                          : req.role === "seller"
                            ? "WhatsApp buyer"
                            : "WhatsApp"}
                    </Button>
                  )}
                  {req.role === "renter" && hasTenantProfile && m.matched_role === "landlord" && m.contact_whatsapp && (
                    <Button
                      className="text-sm px-3 py-2"
                      variant="secondary"
                      onClick={() => shareTenantWithLandlord(m.contact_whatsapp)}
                    >
                      Share profile with landlord
                    </Button>
                  )}
                  <Button className="text-sm px-3 py-2" variant="secondary" onClick={() => rejectMatch(m.id)}>
                    Not interested
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 font-semibold">Timeline</h2>
      {activities.length === 0 ? (
        <EmptyState message="No activity yet" />
      ) : (
        <div className="space-y-2">
          {activities.slice(0, 20).map((a) => (
            <Card key={a.id} className="py-3">
              <div className="text-xs uppercase text-slate-400">{a.activity_type.replace(/_/g, " ")}</div>
              <div className="text-sm">{a.content}</div>
              <div className="text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
