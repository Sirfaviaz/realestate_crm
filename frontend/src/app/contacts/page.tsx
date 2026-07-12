"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  contactsApi,
  listingsApi,
  requirementsApi,
  type Activity,
  type Contact,
  type LeadRequirement,
  type Listing,
} from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import {
  CONTACT_TYPES,
  LEAD_SCORE_OPTIONS,
  PROPERTY_TYPES,
  TENANT_TYPES,
  URGENCY_OPTIONS,
  roleLabel,
} from "@/lib/contact-roles";
import { digitsOnly, isValidPhone, phoneError } from "@/lib/phone";
import { whatsappLink } from "@/lib/whatsapp";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, Input, ListItem, LoadingSpinner, SearchBar, Textarea } from "@/components/ui";

const formDefaults = {
  name: "",
  phone: "",
  email: "",
  whatsapp: "",
  role: "buyer",
  stream_type: "sales",
  budget_min: "",
  budget_max: "",
  rent_budget: "",
  urgency: "",
  lead_score: "",
  follow_up_at: "",
  site_visit_at: "",
  site_visit_location: "",
  notes: "",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState(formDefaults);
  const [formError, setFormError] = useState<string | null>(null);
  const [reqCounts, setReqCounts] = useState<Record<string, number>>({});
  const [listingsByContact, setListingsByContact] = useState<Record<string, Listing[]>>({});
  const [reqsByContact, setReqsByContact] = useState<Record<string, LeadRequirement[]>>({});
  const [activitiesByContact, setActivitiesByContact] = useState<Record<string, Activity[]>>({});
  const [detailLoading, setDetailLoading] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      contactsApi.list(query || undefined, undefined, filter || undefined),
      requirementsApi.list({ status: "active" }),
    ])
      .then(([contacts, reqs]) => {
        setContacts(contacts);
        const counts: Record<string, number> = {};
        for (const r of reqs) {
          counts[r.contact_id] = (counts[r.contact_id] || 0) + 1;
        }
        setReqCounts(counts);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [query, filter]);

  const save = async () => {
    const err =
      phoneError(form.phone) ||
      (form.whatsapp ? phoneError(form.whatsapp, { required: false, label: "WhatsApp" }) : null);
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    const meta = CONTACT_TYPES.find((r) => r.role === form.role);
    await contactsApi.create({
      name: form.name,
      phone: form.phone,
      email: form.email || undefined,
      whatsapp: form.whatsapp || undefined,
      roles: [form.role],
      stream_type: meta?.stream || form.stream_type,
      budget_min: form.budget_min ? Number(form.budget_min) : undefined,
      budget_max: form.budget_max ? Number(form.budget_max) : undefined,
      rent_budget: form.rent_budget ? Number(form.rent_budget) : undefined,
      urgency: form.urgency || undefined,
      lead_score: form.lead_score || undefined,
      follow_up_at: form.follow_up_at ? new Date(form.follow_up_at).toISOString() : undefined,
      site_visit_at: form.site_visit_at ? new Date(form.site_visit_at).toISOString() : undefined,
      site_visit_location: form.site_visit_location || undefined,
      notes: form.notes || undefined,
    });
    setShowForm(false);
    setForm(formDefaults);
    load();
  };

  const toggleExpanded = async (c: Contact) => {
    if (expanded === c.id) {
      setExpanded(null);
      return;
    }
    setExpanded(c.id);
    setDetailLoading(true);
    try {
      const [acts, reqs] = await Promise.all([
        contactsApi.activities(c.id),
        requirementsApi.list({ contact_id: c.id }),
      ]);
      setActivitiesByContact((prev) => ({ ...prev, [c.id]: acts.slice(0, 10) }));
      setReqsByContact((prev) => ({ ...prev, [c.id]: reqs }));
      const isOwner = c.roles.some((r) => r === "seller" || r === "landlord");
      if (isOwner) {
        const rows = await listingsApi.list({ contact_id: c.id });
        setListingsByContact((prev) => ({ ...prev, [c.id]: rows }));
      }
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl font-bold">People</h1>
      <SearchBar value={query} onChange={setQuery} placeholder="Search name or phone..." />
      <div className="mb-4 flex gap-2 overflow-x-auto">
        <button type="button" onClick={() => setFilter("")} className={`shrink-0 rounded-full px-3 py-1 text-sm ${!filter ? "bg-emerald-600 text-white" : "bg-slate-100"}`}>All</button>
        {CONTACT_TYPES.map((r) => (
          <button key={r.role} type="button" onClick={() => setFilter(r.role)} className={`shrink-0 rounded-full px-3 py-1 text-sm ${filter === r.role ? "bg-emerald-600 text-white" : "bg-slate-100"}`}>{r.label}</button>
        ))}
      </div>
      <Button className="mb-4 w-full" variant="outline" onClick={() => setShowForm(!showForm)}>+ Add Person</Button>
      {showForm && (
        <Card className="mb-4 space-y-3">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div>
            <Input
              placeholder="Phone * (10 digits)"
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: digitsOnly(e.target.value) })}
            />
            {form.phone && phoneError(form.phone) && (
              <p className="mt-1 text-sm text-red-600">{phoneError(form.phone)}</p>
            )}
          </div>
          <div className="space-y-2">
            <Input
              placeholder="WhatsApp (10 digits)"
              inputMode="numeric"
              maxLength={10}
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: digitsOnly(e.target.value) })}
            />
            {form.whatsapp && phoneError(form.whatsapp, { required: false, label: "WhatsApp" }) && (
              <p className="text-sm text-red-600">
                {phoneError(form.whatsapp, { required: false, label: "WhatsApp" })}
              </p>
            )}
            <button
              type="button"
              disabled={!isValidPhone(form.phone)}
              onClick={() => setForm((f) => ({ ...f, whatsapp: f.phone }))}
              className="text-sm font-medium text-emerald-700 disabled:text-slate-400"
            >
              Same as phone
            </button>
          </div>
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select
            className="min-h-12 w-full rounded-xl border-2 border-slate-200 px-4"
            value={form.role}
            onChange={(e) => {
              const role = e.target.value;
              const meta = CONTACT_TYPES.find((r) => r.role === role);
              setForm({ ...form, role, stream_type: meta?.stream || "sales" });
            }}
          >
            {CONTACT_TYPES.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
          </select>
          <LeadFields form={form} setForm={setForm} stream={form.stream_type} />
          <Textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Button
            className="w-full"
            disabled={
              !form.name.trim() ||
              !isValidPhone(form.phone) ||
              (!!form.whatsapp && !isValidPhone(form.whatsapp))
            }
            onClick={save}
          >
            Save
          </Button>
        </Card>
      )}
      {loading ? <LoadingSpinner /> : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <Card key={c.id} className="p-0">
              <ListItem
                title={c.name}
                subtitle={c.phone}
                onClick={() => toggleExpanded(c)}
                right={
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex gap-1">
                      {c.lead_score && <Badge className="capitalize">{c.lead_score}</Badge>}
                      {c.roles.map((r) => (
                        <Badge key={r}>{roleLabel(r)}</Badge>
                      ))}
                    </div>
                    {(reqCounts[c.id] ?? 0) > 0 && (
                      <span className="text-xs text-emerald-600">
                        {reqCounts[c.id]} active lead{reqCounts[c.id] > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                }
              />
              {expanded === c.id && (
                <div className="space-y-4 border-t border-slate-100 p-4">
                  {detailLoading ? (
                    <LoadingSpinner />
                  ) : (
                    <PersonDetailPanel
                      contact={c}
                      requirements={reqsByContact[c.id] || []}
                      listings={listingsByContact[c.id] || []}
                      activities={activitiesByContact[c.id] || []}
                    />
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function PersonDetailPanel({
  contact,
  requirements,
  listings,
  activities,
}: {
  contact: Contact;
  requirements: LeadRequirement[];
  listings: Listing[];
  activities: Activity[];
}) {
  const isSupply = contact.roles.some((r) => r === "landlord" || r === "seller");
  const isDemand = contact.roles.some((r) => r === "renter" || r === "buyer");
  const shownReqs = requirements.filter((r) => r.status !== "closed");
  const activeReqs = requirements.filter((r) => r.status === "active" || r.status === "matched");
  const timeline = buildTimeline(contact, activities);

  const reqByListingId = new Map(
    shownReqs.filter((r) => r.listing_id).map((r) => [r.listing_id as string, r])
  );
  const listingIds = new Set(listings.map((l) => l.id));
  /** Supply reqs with no linked listing (or listing not loaded) — show once as lead. */
  const orphanSupplyReqs = shownReqs.filter(
    (r) => (r.role === "landlord" || r.role === "seller") && (!r.listing_id || !listingIds.has(r.listing_id))
  );
  const demandReqs = shownReqs.filter((r) => r.role === "renter" || r.role === "buyer");
  const hasSupplyRows = listings.length > 0 || orphanSupplyReqs.length > 0;
  const hasDemandRows = demandReqs.length > 0;

  return (
    <>
      {(isDemand || isSupply) && (
        <div>
          <div className="mb-2 text-sm font-semibold text-slate-800">
            {isSupply && !isDemand ? "Properties" : isDemand && !isSupply ? "Looking for" : "Details"}
          </div>
          {!hasSupplyRows && !hasDemandRows ? (
            <p className="text-sm text-slate-500">
              {isSupply
                ? "No property details yet — tap Add property below."
                : "No active search yet — create a lead for this person."}
            </p>
          ) : (
            <div className="space-y-2">
              {isSupply &&
                listings.map((l) => (
                  <SupplyPropertyCard
                    key={l.id}
                    listing={l}
                    req={reqByListingId.get(l.id)}
                    stream={contact.stream_type}
                  />
                ))}
              {isSupply &&
                orphanSupplyReqs.map((r) => <RequirementSummary key={r.id} req={r} />)}
              {demandReqs.map((r) => (
                <RequirementSummary key={r.id} req={r} />
              ))}
            </div>
          )}
        </div>
      )}

      {!isDemand && !isSupply && (
        <p className="text-sm text-slate-500">No renter/landlord/buyer/seller role details on this contact.</p>
      )}

      <div>
        <div className="mb-2 text-sm font-semibold text-slate-800">Recent interactions</div>
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-500">No interactions yet.</p>
        ) : (
          <ul className="space-y-2">
            {timeline.slice(0, 10).map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <ActivityLine text={item.text} />
                <div className="mt-0.5 text-xs text-slate-400">{item.when}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={whatsappLink(contact.whatsapp || contact.phone, {
            type: "follow_up",
            name: contact.name,
            role: contact.roles[0],
          })}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white"
        >
          WhatsApp
        </a>
        {isSupply && (
          <Link
            href={`/listings/new?contact_id=${contact.id}&stream=${contact.stream_type}`}
            className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
          >
            Add property
          </Link>
        )}
        {activeReqs[0] && (
          <Link
            href={`/leads/${activeReqs[0].id}`}
            className="inline-flex rounded-lg border-2 border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Open lead
          </Link>
        )}
      </div>
    </>
  );
}

function SupplyPropertyCard({
  listing,
  req,
  stream,
}: {
  listing: Listing;
  req?: LeadRequirement;
  stream: string;
}) {
  const title = listing.project_name || listing.title;
  const area = listing.location_text;
  const price =
    listing.monthly_rent != null || listing.price != null
      ? formatPrice(listing.monthly_rent ?? listing.price, stream)
      : null;
  const status =
    listing.status !== "available"
      ? listing.status
      : req && req.status !== "active" && req.status !== "matched"
        ? req.status
        : null;

  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm text-slate-700">
      <Link href={`/listings/${listing.id}`} className="font-medium text-emerald-900 underline">
        {title}
      </Link>
      {area && <div>{area}</div>}
      <div className="mt-1 flex flex-wrap gap-1">
        {listing.bhk && <Badge>{listing.bhk}</Badge>}
        {listing.property_type && <Badge>{listing.property_type}</Badge>}
        {status && <Badge className="capitalize bg-amber-100 text-amber-900">{status}</Badge>}
      </div>
      {price && <div className="mt-1">{price}</div>}
      {listing.security_deposit != null && (
        <div>Deposit: {formatPrice(listing.security_deposit, "sales")}</div>
      )}
      {listing.maintenance != null && (
        <div>Maintenance: {formatPrice(listing.maintenance, "rental")}</div>
      )}
      <div className="mt-1 flex flex-wrap gap-3">
        <Link href={`/listings/${listing.id}`} className="text-xs font-medium text-emerald-700 underline">
          View property
        </Link>
        {req && (
          <Link href={`/leads/${req.id}`} className="text-xs font-medium text-emerald-700 underline">
            Matches
          </Link>
        )}
      </div>
    </div>
  );
}

function RequirementSummary({ req }: { req: LeadRequirement }) {
  const typeLabel = req.property_types?.map(
    (t) => PROPERTY_TYPES.find((p) => p.value === t)?.label || t
  ).join(", ");
  const areas = req.preferred_locations?.length
    ? req.preferred_locations.join(", ")
    : (req.location_anchors || []).map((a) => a.name).filter(Boolean).join(", ") || req.city;
  const isSupply = req.role === "landlord" || req.role === "seller";
  const budget =
    req.stream_type === "rental" && req.rent_budget != null
      ? formatPrice(req.rent_budget, "rental")
      : req.budget_max != null || req.budget_min != null
        ? `${formatPrice(req.budget_min, "sales")} – ${formatPrice(req.budget_max, "sales")}`
        : null;

  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm text-slate-700">
      <div className="font-medium text-emerald-900">
        {isSupply ? "Property" : "Search"} · {roleLabel(req.role)}
        {req.bhk ? ` · ${req.bhk}` : ""}
        {typeLabel ? ` · ${typeLabel}` : ""}
        {req.status !== "active" && req.status !== "matched" ? ` · ${req.status}` : ""}
      </div>
      {areas && <div>{isSupply ? "Area" : "Areas"}: {areas}</div>}
      {budget && <div>{isSupply ? (req.stream_type === "rental" ? "Rent" : "Price") : "Budget"}: {budget}</div>}
      {isSupply && req.security_deposit != null && (
        <div>Deposit: {formatPrice(req.security_deposit, "sales")}</div>
      )}
      {isSupply && req.maintenance != null && (
        <div>Maintenance: {formatPrice(req.maintenance, "rental")}</div>
      )}
      {req.tenant_type && (
        <div>
          Tenant: {TENANT_TYPES.find((t) => t.value === req.tenant_type)?.label || req.tenant_type}
          {req.occupant_count != null ? ` · ${req.occupant_count} occupants` : ""}
        </div>
      )}
      <Link href={`/leads/${req.id}`} className="mt-1 inline-block text-xs font-medium text-emerald-700 underline">
        View lead & matches
      </Link>
    </div>
  );
}

function buildTimeline(contact: Contact, activities: Activity[]) {
  const items: { id: string; text: string; when: string; at: number }[] = activities.map((a) => ({
    id: a.id,
    text: humanizeActivity(a),
    when: new Date(a.created_at).toLocaleString(),
    at: new Date(a.created_at).getTime(),
  }));

  if (contact.site_visit_at) {
    const at = new Date(contact.site_visit_at).getTime();
    items.push({
      id: `site-${contact.id}`,
      text: `Showed property (site visit)${contact.site_visit_location ? ` at ${contact.site_visit_location}` : ""}`,
      when: new Date(contact.site_visit_at).toLocaleString(),
      at,
    });
  }
  if (contact.follow_up_at) {
    const at = new Date(contact.follow_up_at).getTime();
    items.push({
      id: `fu-${contact.id}`,
      text: `Follow-up scheduled`,
      when: new Date(contact.follow_up_at).toLocaleString(),
      at,
    });
  }

  return items.sort((a, b) => b.at - a.at);
}

function humanizeActivity(a: Activity): string {
  const raw = a.content?.trim() || "";
  switch (a.activity_type) {
    case "match_informed":
      if (/whatsapp/i.test(raw)) return raw;
      return raw || "We sent a WhatsApp / call about a property";
    case "match_rejected":
      return raw.startsWith("Not interested") ? raw : `Not interested in ${raw || "a property"}`;
    case "follow_up":
    case "match_follow_up":
      return raw || "Followed up";
    case "site_visit":
      return raw || "Site visit";
    case "call":
      return raw || "Called";
    case "whatsapp":
      return raw || "WhatsApp message";
    case "note":
      return raw || "Note";
    default:
      return raw || a.activity_type.replace(/_/g, " ");
  }
}

function ActivityLine({ text }: { text: string }) {
  const parts = text.split(/(\/listings\/[0-9a-f-]{36})/gi);
  return (
    <span>
      {parts.map((part, i) => {
        if (/^\/listings\/[0-9a-f-]{36}$/i.test(part)) {
          return (
            <Link key={`${part}-${i}`} href={part} className="font-medium text-emerald-700 underline">
              view property
            </Link>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function LeadFields({
  form,
  setForm,
  stream,
}: {
  form: typeof formDefaults;
  setForm: React.Dispatch<React.SetStateAction<typeof formDefaults>>;
  stream: string;
}) {
  return (
    <>
      <select className="min-h-12 w-full rounded-xl border-2 border-slate-200 px-4" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
        <option value="">Urgency</option>
        {URGENCY_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
      </select>
      <select className="min-h-12 w-full rounded-xl border-2 border-slate-200 px-4" value={form.lead_score} onChange={(e) => setForm({ ...form, lead_score: e.target.value })}>
        <option value="">Lead score</option>
        {LEAD_SCORE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <Input type="datetime-local" value={form.follow_up_at} onChange={(e) => setForm({ ...form, follow_up_at: e.target.value })} />
      <Input type="datetime-local" value={form.site_visit_at} onChange={(e) => setForm({ ...form, site_visit_at: e.target.value })} />
      <Input placeholder="Site visit location" value={form.site_visit_location} onChange={(e) => setForm({ ...form, site_visit_location: e.target.value })} />
      {stream === "sales" ? (
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Budget min" type="number" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })} />
          <Input placeholder="Budget max" type="number" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} />
        </div>
      ) : (
        <Input placeholder="Rent budget / month" type="number" value={form.rent_budget} onChange={(e) => setForm({ ...form, rent_budget: e.target.value })} />
      )}
    </>
  );
}
