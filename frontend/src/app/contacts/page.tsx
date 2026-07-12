"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { contactsApi, listingsApi, requirementsApi, type Contact, type Listing } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { CONTACT_TYPES, LEAD_SCORE_OPTIONS, URGENCY_OPTIONS, roleLabel } from "@/lib/contact-roles";
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
  const [reqCounts, setReqCounts] = useState<Record<string, number>>({});
  const [listings, setListings] = useState<Record<string, Listing[]>>({});

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
    load();
  };

  const updateLead = async (c: Contact, patch: Partial<Contact>) => {
    const { id, ...rest } = c;
    await contactsApi.update(id, { ...rest, ...patch });
    load();
  };

  const toggleExpanded = async (c: Contact) => {
    if (expanded === c.id) {
      setExpanded(null);
      return;
    }
    setExpanded(c.id);
    const isOwner = c.roles.some((r) => r === "seller" || r === "landlord");
    if (isOwner && !listings[c.id]) {
      const rows = await listingsApi.list({ contact_id: c.id });
      setListings((prev) => ({ ...prev, [c.id]: rows }));
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
          <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
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
          <Button className="w-full" onClick={save}>Save</Button>
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
                      <Link href="/leads" className="text-xs text-emerald-600 underline">
                        {reqCounts[c.id]} active search{reqCounts[c.id] > 1 ? "es" : ""}
                      </Link>
                    )}
                  </div>
                }
              />
              {expanded === c.id && (
                <div className="space-y-3 border-t border-slate-100 p-4">
                  <div className="flex flex-wrap gap-2">
                    {URGENCY_OPTIONS.map((u) => (
                      <button
                        key={u.value}
                        type="button"
                        onClick={() => updateLead(c, { urgency: u.value })}
                        className={`rounded-full px-3 py-1 text-xs ${c.urgency === u.value ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {LEAD_SCORE_OPTIONS.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => updateLead(c, { lead_score: s.value })}
                        className={`rounded-full px-3 py-1 text-xs capitalize ${c.lead_score === s.value ? "bg-orange-500 text-white" : "bg-slate-100"}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="datetime-local"
                    value={c.follow_up_at ? c.follow_up_at.slice(0, 16) : ""}
                    onChange={(e) => updateLead(c, { follow_up_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                  <Input
                    type="datetime-local"
                    value={c.site_visit_at ? c.site_visit_at.slice(0, 16) : ""}
                    onChange={(e) => updateLead(c, { site_visit_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                  <Input
                    placeholder="Site visit location"
                    value={c.site_visit_location || ""}
                    onChange={(e) => updateLead(c, { site_visit_location: e.target.value })}
                  />
                  <a
                    href={whatsappLink(c.whatsapp || c.phone, { type: "follow_up", name: c.name, role: c.roles[0] })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    WhatsApp
                  </a>
                  {(c.roles.includes("seller") || c.roles.includes("landlord")) && (
                    <PropertyDetails listings={listings[c.id] || []} stream={c.stream_type} />
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

function PropertyDetails({ listings, stream }: { listings: Listing[]; stream: string }) {
  if (!listings.length) {
    return <p className="text-sm text-slate-500">No property details yet — import or add via Data Entry → Listing.</p>;
  }
  return (
    <div className="space-y-3 border-t border-slate-100 pt-3">
      <div className="text-sm font-semibold">Properties ({listings.length})</div>
      {listings.map((l) => (
        <Card key={l.id} className="space-y-1 bg-slate-50 py-3 text-sm">
          <div className="font-medium">{l.project_name || l.title}</div>
          {l.builder_name && <div className="text-slate-600">Builder: {l.builder_name}</div>}
          {l.location_text && <div className="text-slate-600">{l.location_text}</div>}
          <div className="flex flex-wrap gap-2">
            {l.bhk && <Badge>{l.bhk}</Badge>}
            {l.property_type && <Badge>{l.property_type}</Badge>}
            {l.sqft != null && <Badge>{l.sqft} sqft</Badge>}
          </div>
          {(l.total_amount != null || l.monthly_rent != null || l.price != null) && (
            <div>{formatPrice(l.monthly_rent ?? l.total_amount ?? l.price, stream)}</div>
          )}
          {l.amenities?.length ? <div className="text-slate-600">Amenities: {l.amenities.join(", ")}</div> : null}
          {l.parking_details && <div className="text-slate-600">Parking: {l.parking_details}</div>}
          {(l.gst_percent != null || l.down_payment_percent != null) && (
            <div className="text-slate-600">
              {l.gst_percent != null ? `GST ${l.gst_percent}%` : ""}
              {l.down_payment_percent != null ? ` · Down ${l.down_payment_percent}%` : ""}
            </div>
          )}
        </Card>
      ))}
    </div>
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
