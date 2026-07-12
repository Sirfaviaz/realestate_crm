"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Phone, RefreshCw } from "lucide-react";
import {
  contactsApi,
  mediaUrl,
  requirementsApi,
  type Activity,
  type AvailableNowResponse,
  type AvailableProperty,
  type LeadRequirement,
  type RequirementMatch,
} from "@/lib/api";
import { PROPERTY_TYPES, TENANT_TYPES, roleLabel } from "@/lib/contact-roles";
import { formatPrice } from "@/lib/utils";
import { tenantTypeLabel, whatsappLink } from "@/lib/whatsapp";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, EmptyState, Input, LoadingSpinner } from "@/components/ui";

export default function RequirementDetailPage() {
  const { requirementId } = useParams<{ requirementId: string }>();
  const [req, setReq] = useState<LeadRequirement | null>(null);
  const [matches, setMatches] = useState<RequirementMatch[]>([]);
  const [available, setAvailable] = useState<AvailableNowResponse | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [followUpMatchId, setFollowUpMatchId] = useState<string | null>(null);
  const [followUpAt, setFollowUpAt] = useState("");

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
      const [r, m, avail] = await Promise.all([
        requirementsApi.get(requirementId),
        requirementsApi.matches(requirementId),
        requirementsApi.availableNow(requirementId),
      ]);
      setReq(r);
      setMatches(m);
      setAvailable(avail);
      if (r.contact_id) {
        setActivities(await contactsApi.activities(r.contact_id));
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
      setAvailable(await requirementsApi.availableNow(requirementId));
    } finally {
      setLoading(false);
    }
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
    if (via === "whatsapp" && phone) {
      const isSupply = req.role === "landlord" || req.role === "seller";
      if (isSupply) {
        const priceStr =
          req.stream_type === "rental" && req.rent_budget != null
            ? formatPrice(req.rent_budget, "rental")
            : req.budget_max != null || req.budget_min != null
              ? formatPrice(req.budget_max || req.budget_min, "sales")
              : undefined;
        const locs = req.preferred_locations?.length
          ? req.preferred_locations.join(", ")
          : req.city || undefined;
        window.open(
          whatsappLink(phone, {
            type: "property_for_renter",
            name: match.contact_name || "there",
            location: locs,
            bhk: req.bhk || undefined,
            propertyType: req.property_types?.[0]
              ? PROPERTY_TYPES.find((p) => p.value === req.property_types![0])?.label || req.property_types[0]
              : undefined,
            price: priceStr,
            availableFrom: req.move_in_date
              ? new Date(req.move_in_date).toLocaleDateString()
              : undefined,
          }),
          "_blank"
        );
      } else {
        const priceStr =
          match.price != null ? formatPrice(match.price, req.stream_type) : undefined;
        window.open(
          whatsappLink(phone, {
            type: "match_found",
            name: match.contact_name || "there",
            title: match.title || "property",
            location: match.location || undefined,
            bhk: match.bhk || undefined,
            propertyType: match.property_type || undefined,
            price: priceStr,
          }),
          "_blank"
        );
      }
    } else if (via === "call" && match.contact_phone) {
      window.location.href = `tel:${match.contact_phone}`;
    }
    await requirementsApi.informMatch(requirementId, match.id, via);
    await load();
    if (via === "whatsapp" || via === "call") {
      setFollowUpMatchId(match.id);
    }
  };

  const saveFollowUp = async () => {
    if (!requirementId || !followUpMatchId || !followUpAt) return;
    await requirementsApi.followUpMatch(
      requirementId,
      followUpMatchId,
      new Date(followUpAt).toISOString()
    );
    setFollowUpMatchId(null);
    setFollowUpAt("");
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

  if (loading || !req) {
    return (
      <AppShell>
        <LoadingSpinner />
      </AppShell>
    );
  }

  const radiusLabel =
    available?.search_radius_km === 0
      ? "Whole city"
      : `Within ${available?.search_radius_km || req.search_radius_km || 5} km`;

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
          {(req.preferred_locations?.length || req.location_anchors?.length) ? (
            <div>
              Preferred areas:{" "}
              {(req.preferred_locations?.length
                ? req.preferred_locations
                : (req.location_anchors || []).map((a) => a.name).filter(Boolean)
              )
                .map((loc, i) => `${i + 1}. ${loc}`)
                .join(" · ")}
            </div>
          ) : null}
          {req.city && <div>City: {req.city}</div>}
          {req.search_radius_km != null && (
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
            <div>Budget: {formatPrice(req.rent_budget, "rental")}</div>
          )}
          {req.stream_type === "sales" && (req.budget_min || req.budget_max) && (
            <div>Budget: {formatPrice(req.budget_min, "sales")} – {formatPrice(req.budget_max, "sales")}</div>
          )}
          {req.notes && <div className="italic">{req.notes}</div>}
        </div>
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

      {available &&
        (available.within_radius.length > 0 ||
          available.within_10km.length > 0 ||
          available.in_city.length > 0) && (
          <div className="mb-6">
            <h2 className="mb-3 font-semibold">Available now</h2>
            <AvailableSection
              title={radiusLabel}
              items={available.within_radius}
              stream={req.stream_type}
              req={req}
              onShareLandlord={shareTenantWithLandlord}
            />
            <AvailableSection
              title="Within 10 km"
              items={available.within_10km}
              stream={req.stream_type}
              req={req}
              onShareLandlord={shareTenantWithLandlord}
            />
            <AvailableSection
              title={`In ${req.city || "city"}`}
              items={available.in_city}
              stream={req.stream_type}
              req={req}
              onShareLandlord={shareTenantWithLandlord}
            />
          </div>
        )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">
          Matches ({matches.length})
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

      {matches.length === 0 ? (
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
          {matches.map((m) => (
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
                  <div className="mt-1 flex gap-1">
                    {m.matched_role && <Badge>{roleLabel(m.matched_role)}</Badge>}
                    {m.bhk && <Badge>{m.bhk}</Badge>}
                    <Badge className="capitalize">{m.status.replace(/_/g, " ")}</Badge>
                  </div>
                </div>
              </div>
              {m.status === "new" || m.status.startsWith("informed") ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(m.contact_phone || m.contact_whatsapp) && (
                    <Button className="text-sm px-3 py-2" variant="outline" onClick={() => inform(m, "call")}>
                      Call
                    </Button>
                  )}
                  {(m.contact_whatsapp || m.contact_phone) && (
                    <Button className="text-sm px-3 py-2" onClick={() => inform(m, "whatsapp")}>
                      {req.role === "landlord"
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

      {followUpMatchId && (
        <Card className="mb-4 space-y-3">
          <div className="font-semibold">Schedule follow-up</div>
          <Input type="datetime-local" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
          <Button className="w-full" onClick={saveFollowUp} disabled={!followUpAt}>Save follow-up</Button>
        </Card>
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

function AvailableSection({
  title,
  items,
  stream,
  req,
  onShareLandlord,
}: {
  title: string;
  items: AvailableProperty[];
  stream: string;
  req: LeadRequirement;
  onShareLandlord: (phone: string | null | undefined) => void;
}) {
  if (!items.length) return null;
  const showLandlordShare =
    req.stream_type === "rental" &&
    (req.tenant_type || req.occupant_count || req.profession || req.workplace_text);

  return (
    <div className="mb-4">
      <h3 className="mb-2 font-semibold">{title} ({items.length})</h3>
      <div className="space-y-2">
        {items.slice(0, 8).map((p, i) => (
          <Card key={`${p.listing_id || p.spec_id}-${i}`} className="flex gap-3">
            {p.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(p.cover_url) || ""} alt="" className="h-16 w-16 rounded-lg object-cover" />
            )}
            <div className="flex-1">
              <div className="font-medium">{p.title}</div>
              <div className="text-sm text-slate-600">{p.location}</div>
              <div className="text-sm">
                {formatPrice(p.price, stream)}
                {p.distance_km != null ? ` · ${p.distance_km} km` : ""}
              </div>
              {showLandlordShare && p.contact_whatsapp && (
                <button
                  type="button"
                  onClick={() => onShareLandlord(p.contact_whatsapp)}
                  className="mt-2 text-sm text-emerald-600"
                >
                  Share tenant profile with landlord
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
