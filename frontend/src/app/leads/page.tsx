"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronUp, Plus, Search, X } from "lucide-react";
import { contactsApi, listingsApi, mediaUrl, requirementsApi, type AvailableNowResponse, type Contact, type LeadRequirement, type LocationAnchor } from "@/lib/api";
import {
  CONTACT_TYPES,
  LEAD_SCORE_OPTIONS,
  PROPERTY_TYPES,
  RADIUS_OPTIONS,
  TENANT_TYPES,
  URGENCY_OPTIONS,
  getContactType,
  roleLabel,
  type ContactRoleKey,
} from "@/lib/contact-roles";
import { BHK_OPTIONS } from "@/lib/inventory-presets";
import { formatFileSize, mediaKind, validateMediaFiles } from "@/lib/media-validation";
import { prepareMediaFiles } from "@/lib/compress-video";
import { digitsOnly, isValidPhone, normalizePhone, phoneError } from "@/lib/phone";
import { formatPrice } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { GooglePlacesInput } from "@/components/google-places-input";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  ListItem,
  LoadingSpinner,
  SearchBar,
  StepHeader,
  Textarea,
  FormSelect,
} from "@/components/ui";

type Mode = "hub" | "create" | "work";

export default function LeadsPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("hub");
  const [createStep, setCreateStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const [personForm, setPersonForm] = useState({ name: "", phone: "", whatsapp: "", existingId: "" });
  const [role, setRole] = useState<ContactRoleKey | null>(null);
  const [reqForm, setReqForm] = useState({
    property_types: [] as string[],
    city: "",
    search_radius_km: 5,
    bhk: "",
    budget_min: "",
    budget_max: "",
    rent_budget: "",
    security_deposit: "",
    maintenance: "",
    move_in_date: "",
    urgency: "",
    lead_score: "",
    notes: "",
  });
  const [tenantForm, setTenantForm] = useState({
    tenant_type: "",
    occupant_count: "",
    profession: "",
    workplace_text: "",
    workplace_lat: undefined as number | undefined,
    workplace_lng: undefined as number | undefined,
  });
  const [locationAnchors, setLocationAnchors] = useState<LocationAnchor[]>([]);
  const [cityCenter, setCityCenter] = useState<{ lat: number; lng: number } | null>(null);
  /** Landlord: empty = all tenant types welcome. */
  const [preferredTenantTypes, setPreferredTenantTypes] = useState<string[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaStatus, setMediaStatus] = useState<string | null>(null);
  const [mediaProgress, setMediaProgress] = useState<number | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedReqId, setSavedReqId] = useState<string | null>(null);
  const [available, setAvailable] = useState<AvailableNowResponse | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [requirements, setRequirements] = useState<LeadRequirement[]>([]);

  const loadRequirements = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      setRequirements(await requirementsApi.list({ q, status: "active" }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "work") {
      const t = setTimeout(() => loadRequirements(query || undefined), 300);
      return () => clearTimeout(t);
    }
  }, [mode, query, loadRequirements]);

  const loadContacts = async (q?: string) => {
    setLoading(true);
    try {
      setContacts(await contactsApi.list(q));
    } finally {
      setLoading(false);
    }
  };

  const togglePropertyType = (value: string) => {
    setReqForm((f) => ({
      ...f,
      property_types: f.property_types.includes(value)
        ? f.property_types.filter((x) => x !== value)
        : [...f.property_types, value],
    }));
  };

  const setPropertyType = (value: string) => {
    setReqForm((f) => ({ ...f, property_types: [value] }));
  };

  const togglePreferredTenantType = (value: string) => {
    if (value === "all") {
      setPreferredTenantTypes([]);
      return;
    }
    setPreferredTenantTypes((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
    );
  };

  const addLocationAnchor = (place: { area: string; city: string; latitude?: number; longitude?: number }) => {
    if (place.latitude == null || place.longitude == null) return;
    const name = place.area || place.city;
    if (!name) return;
    setLocationAnchors((prev) => {
      if (prev.some((a) => a.lat === place.latitude && a.lng === place.longitude)) return prev;
      return [...prev, { name, lat: place.latitude!, lng: place.longitude! }];
    });
    if (!reqForm.city && place.city) setReqForm((f) => ({ ...f, city: place.city }));
  };

  /** Landlord/seller: one property pin, not a priority list. */
  const setPropertyLocation = (place: { area: string; city: string; latitude?: number; longitude?: number }) => {
    if (place.latitude == null || place.longitude == null) return;
    const name = place.area || place.city;
    if (!name) return;
    setLocationAnchors([{ name, lat: place.latitude, lng: place.longitude }]);
    if (place.city) setReqForm((f) => ({ ...f, city: f.city || place.city }));
  };

  const removeLocationAnchor = (index: number) => {
    setLocationAnchors((prev) => prev.filter((_, i) => i !== index));
  };

  const moveLocationAnchor = (index: number, direction: -1 | 1) => {
    setLocationAnchors((prev) => {
      const next = index + direction;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  };

  const onCitySelect = (place: { city: string; area: string; latitude?: number; longitude?: number }) => {
    const cityName = place.city || place.area;
    setReqForm((f) => ({ ...f, city: cityName }));
    if (place.latitude != null && place.longitude != null) {
      setCityCenter({ lat: place.latitude, lng: place.longitude });
    } else {
      setCityCenter(null);
    }
  };

  const onMediaPick = async (files: FileList | null) => {
    if (!files?.length) return;
    setMediaBusy(true);
    setMediaError(null);
    setMediaStatus(null);
    setMediaProgress(null);
    try {
      const combined = [...mediaFiles, ...Array.from(files)];
      const { files: prepared, error } = await prepareMediaFiles(combined, {
        onStatus: setMediaStatus,
        onProgress: setMediaProgress,
      });
      setMediaError(error);
      if (!error) setMediaFiles(prepared);
    } catch (e) {
      setMediaError(e instanceof Error ? e.message : "Could not process media files.");
    } finally {
      setMediaBusy(false);
      setMediaProgress(null);
    }
  };

  const removeMediaFile = (index: number) => {
    const next = mediaFiles.filter((_, i) => i !== index);
    setMediaFiles(next);
    setMediaError(next.length ? validateMediaFiles(next) : null);
    setMediaStatus(null);
  };

  const validateSupplyDetails = (): string | null => {
    if (!reqForm.property_types.length) return "Select a property type.";
    if (!reqForm.city.trim()) return "City is required.";
    if (!locationAnchors.length) return "Property area is required.";
    if (!reqForm.bhk) return "BHK is required.";
    if (role === "landlord") {
      if (!reqForm.rent_budget || Number(reqForm.rent_budget) <= 0) return "Asking rent is required.";
      if (reqForm.security_deposit === "" || Number(reqForm.security_deposit) < 0) {
        return "Security deposit is required.";
      }
      if (reqForm.maintenance === "" || Number(reqForm.maintenance) < 0) {
        return "Maintenance is required.";
      }
    }
    if (role === "seller") {
      if (!reqForm.budget_max || Number(reqForm.budget_max) <= 0) return "Asking price is required.";
    }
    if (!reqForm.urgency) return "Urgency is required.";
    if (!reqForm.move_in_date) return "Property available from date is required.";
    if (!reqForm.lead_score) return "Lead score is required.";
    if (!mediaFiles.length) return "At least one photo is required.";
    const mediaErr = validateMediaFiles(mediaFiles);
    if (mediaErr) return mediaErr;
    if (!mediaFiles.some((f) => mediaKind(f) === "image")) {
      return "At least one photo (image) is required. Videos alone are not enough.";
    }
    return null;
  };

  const saveLead = async () => {
    if (!role) return;
    setFormError(null);
    const phoneErr =
      phoneError(personForm.phone) ||
      (personForm.whatsapp
        ? phoneError(personForm.whatsapp, { required: false, label: "WhatsApp" })
        : null);
    if (phoneErr) {
      setFormError(phoneErr);
      return;
    }
    const supply = role === "landlord" || role === "seller";
    if (supply) {
      const err = validateSupplyDetails();
      if (err) {
        setFormError(err);
        if (err.toLowerCase().includes("photo") || err.toLowerCase().includes("video") || err.toLowerCase().includes("file")) {
          setMediaError(err);
        }
        return;
      }
    }
    setLoading(true);
    try {
      const meta = getContactType(role);
      const tenantPayload = {
        tenant_type: tenantForm.tenant_type || undefined,
        occupant_count: tenantForm.occupant_count ? Number(tenantForm.occupant_count) : undefined,
        profession: tenantForm.profession || undefined,
        workplace_text: tenantForm.workplace_text || undefined,
        workplace_lat: tenantForm.workplace_lat,
        workplace_lng: tenantForm.workplace_lng,
      };
      let contactId = personForm.existingId;
      if (!contactId) {
        const c = await contactsApi.create({
          name: personForm.name,
          phone: personForm.phone,
          whatsapp: personForm.whatsapp || undefined,
          roles: [role],
          stream_type: meta.stream,
          ...tenantPayload,
        });
        contactId = c.id;
      } else {
        await contactsApi.update(contactId, {
          name: personForm.name,
          phone: personForm.phone,
          whatsapp: personForm.whatsapp || undefined,
          roles: [role],
          stream_type: meta.stream,
          ...tenantPayload,
        });
      }
      const deposit = reqForm.security_deposit ? Number(reqForm.security_deposit) : undefined;
      const maintenance = reqForm.maintenance ? Number(reqForm.maintenance) : undefined;
      const req = await requirementsApi.create({
        contact_id: contactId,
        role,
        stream_type: meta.stream,
        property_types: reqForm.property_types.length ? reqForm.property_types : undefined,
        preferred_locations: locationAnchors.length
          ? locationAnchors.map((a) => a.name)
          : undefined,
        location_anchors: locationAnchors.length ? locationAnchors : undefined,
        city: reqForm.city || undefined,
        search_radius_km: reqForm.search_radius_km,
        bhk: reqForm.bhk || undefined,
        budget_min: reqForm.budget_min ? Number(reqForm.budget_min) : undefined,
        budget_max: reqForm.budget_max ? Number(reqForm.budget_max) : undefined,
        rent_budget: reqForm.rent_budget ? Number(reqForm.rent_budget) : undefined,
        security_deposit: role === "landlord" ? deposit : undefined,
        maintenance: role === "landlord" ? maintenance : undefined,
        move_in_date: reqForm.move_in_date || undefined,
        urgency: reqForm.urgency || undefined,
        lead_score: reqForm.lead_score || undefined,
        notes: reqForm.notes || undefined,
        preferred_tenant_types:
          role === "landlord"
            ? preferredTenantTypes.length
              ? preferredTenantTypes
              : null
            : undefined,
      });

      if (role === "landlord" || role === "seller") {
        const anchor = locationAnchors[0];
        const area = anchor?.name || reqForm.city || "Property";
        const propType = reqForm.property_types[0];
        const title = [reqForm.bhk, propType, area].filter(Boolean).join(" · ") || `${personForm.name}'s property`;
        const rent = reqForm.rent_budget ? Number(reqForm.rent_budget) : undefined;
        const asking = reqForm.budget_max ? Number(reqForm.budget_max) : undefined;
        const listing = await listingsApi.create({
          contact_id: contactId,
          stream_type: meta.stream,
          title,
          location_text: [area, reqForm.city].filter(Boolean).join(", "),
          latitude: anchor?.lat,
          longitude: anchor?.lng,
          bhk: reqForm.bhk || undefined,
          property_type: propType,
          price: meta.stream === "rental" ? rent : asking,
          monthly_rent: meta.stream === "rental" ? rent : undefined,
          security_deposit: role === "landlord" ? deposit : undefined,
          maintenance: role === "landlord" ? maintenance : undefined,
          total_amount: meta.stream === "sales" ? asking : undefined,
          description: reqForm.notes || undefined,
          status: "available",
        });
        for (let i = 0; i < mediaFiles.length; i++) {
          await listingsApi.uploadMedia(listing.id, mediaFiles[i], i);
        }
        await requirementsApi.update(req.id, {
          contact_id: contactId,
          role,
          stream_type: meta.stream,
          property_types: req.property_types || undefined,
          preferred_locations: req.preferred_locations || undefined,
          location_anchors: req.location_anchors || undefined,
          city: req.city || undefined,
          search_radius_km: req.search_radius_km ?? undefined,
          bhk: req.bhk || undefined,
          budget_min: req.budget_min ?? undefined,
          budget_max: req.budget_max ?? undefined,
          rent_budget: req.rent_budget ?? undefined,
          security_deposit: req.security_deposit ?? undefined,
          maintenance: req.maintenance ?? undefined,
          move_in_date: req.move_in_date || undefined,
          urgency: req.urgency || undefined,
          lead_score: req.lead_score || undefined,
          notes: req.notes || undefined,
          preferred_tenant_types: req.preferred_tenant_types,
          listing_id: listing.id,
          status: req.status,
        });
      }

      const avail = await requirementsApi.availableNow(req.id);
      setSavedReqId(req.id);
      setAvailable(avail);
      setCreateStep(3);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save lead");
    } finally {
      setLoading(false);
    }
  };

  const resetCreate = () => {
    setCreateStep(0);
    setPersonForm({ name: "", phone: "", whatsapp: "", existingId: "" });
    setRole(null);
    setReqForm({
      property_types: [],
      city: "",
      search_radius_km: 5,
      bhk: "",
      budget_min: "",
      budget_max: "",
      rent_budget: "",
      security_deposit: "",
      maintenance: "",
      move_in_date: "",
      urgency: "",
      lead_score: "",
      notes: "",
    });
    setTenantForm({
      tenant_type: "",
      occupant_count: "",
      profession: "",
      workplace_text: "",
      workplace_lat: undefined,
      workplace_lng: undefined,
    });
    setLocationAnchors([]);
    setCityCenter(null);
    setPreferredTenantTypes([]);
    setMediaFiles([]);
    setMediaError(null);
    setMediaStatus(null);
    setMediaProgress(null);
    setMediaBusy(false);
    setFormError(null);
    setSavedReqId(null);
    setAvailable(null);
  };

  const goBack = () => {
    if (mode === "create" && createStep > 0) {
      setCreateStep(createStep - 1);
    } else {
      setMode("hub");
      resetCreate();
      setQuery("");
    }
  };

  if (mode === "hub") {
    return (
      <AppShell>
        <h1 className="mb-1 text-2xl font-bold">Leads</h1>
        <p className="mb-6 text-slate-600">Create a lead with requirements, or work an existing search.</p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => { setMode("create"); setCreateStep(0); }}
            className="flex w-full items-center gap-4 rounded-2xl border-2 border-emerald-500 bg-emerald-600 p-5 text-left text-white"
          >
            <Plus className="h-8 w-8" />
            <div>
              <div className="text-lg font-semibold">Create Lead</div>
              <div className="text-sm opacity-90">New person + what they&apos;re looking for</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode("work")}
            className="flex w-full items-center gap-4 rounded-2xl border-2 border-slate-200 bg-white p-5 text-left hover:border-emerald-300"
          >
            <Search className="h-8 w-8 text-emerald-600" />
            <div>
              <div className="text-lg font-semibold">Work Lead</div>
              <div className="text-sm text-slate-500">Open requirements, matches & follow-ups</div>
            </div>
          </button>
        </div>
      </AppShell>
    );
  }

  if (mode === "work") {
    return (
      <AppShell>
        <button type="button" onClick={goBack} className="mb-3 flex items-center gap-1 text-sm text-slate-600">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="mb-4 text-2xl font-bold">Work Lead</h1>
        <SearchBar value={query} onChange={setQuery} placeholder="Search name, phone, location..." />
        {loading ? <LoadingSpinner /> : requirements.length === 0 ? (
          <EmptyState message="No active requirements" />
        ) : (
          <div className="mt-4 space-y-2">
            {requirements.map((r) => (
              <Link key={r.id} href={`/leads/${r.id}`}>
                <ListItem
                  title={r.contact_name || "Contact"}
                  subtitle={[roleLabel(r.role), r.preferred_locations?.join(", ")].filter(Boolean).join(" · ")}
                  right={
                    <div className="flex gap-1">
                      {(r.new_match_count ?? 0) > 0 && (
                        <Badge className="bg-orange-500 text-white">{r.new_match_count} new</Badge>
                      )}
                      <Badge className="capitalize">{r.status}</Badge>
                    </div>
                  }
                />
              </Link>
            ))}
          </div>
        )}
      </AppShell>
    );
  }

  const meta = role ? getContactType(role) : null;
  const isSupply = role === "landlord" || role === "seller";
  const createTitles = ["Person", "Role", "Requirements", "Available now"];

  return (
    <AppShell>
      <button type="button" onClick={goBack} className="mb-3 flex items-center gap-1 text-sm text-slate-600">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <StepHeader step={createStep + 1} total={4} title={`Create Lead — ${createTitles[createStep]}`} />

      {createStep === 0 && (
        <Card className="space-y-3">
          <p className="text-sm text-slate-600">Enter person details or pick an existing contact.</p>
          <Input placeholder="Name *" value={personForm.name} onChange={(e) => setPersonForm({ ...personForm, name: e.target.value, existingId: "" })} />
          <div>
            <Input
              placeholder="Phone * (10 digits)"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              value={personForm.phone}
              onChange={(e) =>
                setPersonForm({
                  ...personForm,
                  phone: digitsOnly(e.target.value),
                  existingId: "",
                })
              }
            />
            {personForm.phone && phoneError(personForm.phone) && (
              <p className="mt-1 text-sm text-red-600">{phoneError(personForm.phone)}</p>
            )}
          </div>
          <div className="space-y-2">
            <Input
              placeholder="WhatsApp (10 digits, optional)"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              value={personForm.whatsapp}
              onChange={(e) => setPersonForm({ ...personForm, whatsapp: digitsOnly(e.target.value) })}
            />
            {personForm.whatsapp && phoneError(personForm.whatsapp, { required: false, label: "WhatsApp" }) && (
              <p className="text-sm text-red-600">
                {phoneError(personForm.whatsapp, { required: false, label: "WhatsApp" })}
              </p>
            )}
            <button
              type="button"
              disabled={!isValidPhone(personForm.phone)}
              onClick={() => setPersonForm((f) => ({ ...f, whatsapp: f.phone }))}
              className="text-sm font-medium text-emerald-700 disabled:text-slate-400"
            >
              Same as phone
            </button>
          </div>
          <Button variant="outline" className="w-full" onClick={() => loadContacts()}>Search existing</Button>
          {contacts.length > 0 && (
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {contacts.map((c) => (
                <ListItem
                  key={c.id}
                  title={c.name}
                  subtitle={c.phone}
                  onClick={() =>
                    setPersonForm({
                      name: c.name,
                      phone: normalizePhone(c.phone || ""),
                      whatsapp: c.whatsapp ? normalizePhone(c.whatsapp) : "",
                      existingId: c.id,
                    })
                  }
                  active={personForm.existingId === c.id}
                />
              ))}
            </div>
          )}
          <Button
            className="w-full"
            disabled={
              !personForm.name.trim() ||
              !isValidPhone(personForm.phone) ||
              (!!personForm.whatsapp && !isValidPhone(personForm.whatsapp))
            }
            onClick={() => {
              const err =
                phoneError(personForm.phone) ||
                (personForm.whatsapp
                  ? phoneError(personForm.whatsapp, { required: false, label: "WhatsApp" })
                  : null);
              if (err) {
                setFormError(err);
                return;
              }
              setFormError(null);
              setCreateStep(1);
            }}
          >
            Next
          </Button>
          {formError && createStep === 0 && <p className="text-sm text-red-600">{formError}</p>}
        </Card>
      )}

      {createStep === 1 && (
        <div className="grid grid-cols-2 gap-3">
          {CONTACT_TYPES.map((t) => (
            <button
              key={t.role}
              type="button"
              onClick={() => { setRole(t.role); setCreateStep(2); }}
              className={`rounded-2xl border-2 p-4 text-left min-h-[90px] ${role === t.role ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}
            >
              <div className="font-bold">{t.label}</div>
              <div className="text-sm text-slate-500">{t.description}</div>
            </button>
          ))}
        </div>
      )}

      {createStep === 2 && meta && (
        <Card className="space-y-3">
          <p className="text-sm text-slate-600">
            {isSupply
              ? `What are ${personForm.name}'s property details?`
              : `What is ${personForm.name} looking for?`}
          </p>
          <div>
            <div className="mb-2 text-sm font-medium">Property type{isSupply ? " *" : ""}</div>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => (isSupply ? setPropertyType(t.value) : togglePropertyType(t.value))}
                  className={`rounded-full px-3 py-1 text-sm ${reqForm.property_types.includes(t.value) ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {!isSupply && (
              <p className="mt-1 text-xs text-slate-500">You can select more than one.</p>
            )}
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">City{isSupply ? " *" : ""}</div>
            <GooglePlacesInput
              mode="city"
              value={reqForm.city}
              onQueryChange={(city) => {
                setReqForm((f) => ({ ...f, city }));
                setCityCenter(null);
              }}
              onSelect={onCitySelect}
              placeholder="Start typing a city..."
              className="min-h-12 w-full rounded-xl border-2 border-slate-200 px-4"
            />
          </div>
          {isSupply ? (
            <div>
              <div className="mb-2 text-sm font-medium">Property area *</div>
              <GooglePlacesInput
                mode="area"
                clearOnSelect
                locationBias={cityCenter}
                onSelect={setPropertyLocation}
                placeholder={reqForm.city ? `Area in ${reqForm.city}...` : "Property locality / area..."}
                className="min-h-12 w-full rounded-xl border-2 border-slate-200 px-4"
              />
              {locationAnchors[0] && (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <span className="min-w-0 flex-1 text-sm font-medium text-emerald-900">
                    {locationAnchors[0].name}
                  </span>
                  <button
                    type="button"
                    aria-label="Clear area"
                    onClick={() => setLocationAnchors([])}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div>
                <div className="mb-2 text-sm font-medium">Preferred areas</div>
                <p className="mb-2 text-xs text-slate-500">
                  Add in priority order (1 = most preferred). Use arrows to reorder.
                </p>
                <GooglePlacesInput
                  mode="area"
                  clearOnSelect
                  locationBias={cityCenter}
                  onSelect={addLocationAnchor}
                  placeholder={reqForm.city ? `Area in ${reqForm.city}...` : "Add preferred area..."}
                  className="min-h-12 w-full rounded-xl border-2 border-slate-200 px-4"
                />
                {locationAnchors.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {locationAnchors.map((a, index) => (
                      <li
                        key={`${a.lat}-${a.lng}-${a.name}`}
                        className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-medium text-emerald-900">{a.name}</span>
                        <button
                          type="button"
                          aria-label="Move up"
                          disabled={index === 0}
                          onClick={() => moveLocationAnchor(index, -1)}
                          className="rounded-lg p-1.5 text-emerald-800 disabled:opacity-30"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Move down"
                          disabled={index === locationAnchors.length - 1}
                          onClick={() => moveLocationAnchor(index, 1)}
                          className="rounded-lg p-1.5 text-emerald-800 disabled:opacity-30"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${a.name}`}
                          onClick={() => removeLocationAnchor(index)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="mb-2 text-sm font-medium">Search radius</div>
                <div className="flex gap-2">
                  {RADIUS_OPTIONS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setReqForm({ ...reqForm, search_radius_km: r.value })}
                      className={`rounded-full px-3 py-1 text-sm ${reqForm.search_radius_km === r.value ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {!isSupply && (role === "renter" || role === "buyer") && (
            <div className="border-t border-slate-100 pt-3">
              <div className="mb-2 text-sm font-medium">Tenant / buyer profile</div>
              <select
                className="mb-2 min-h-12 w-full rounded-xl border-2 border-slate-200 px-4"
                value={tenantForm.tenant_type}
                onChange={(e) => setTenantForm({ ...tenantForm, tenant_type: e.target.value })}
              >
                <option value="">Tenant type</option>
                {TENANT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <Input
                placeholder="Number of occupants"
                type="number"
                value={tenantForm.occupant_count}
                onChange={(e) => setTenantForm({ ...tenantForm, occupant_count: e.target.value })}
              />
              <Input
                placeholder="Profession"
                value={tenantForm.profession}
                onChange={(e) => setTenantForm({ ...tenantForm, profession: e.target.value })}
                className="mt-2"
              />
              <div className="mt-2 text-sm text-slate-600">Workplace (for location search)</div>
              <GooglePlacesInput
                onSelect={(p) => setTenantForm({
                  ...tenantForm,
                  workplace_text: [p.area, p.city].filter(Boolean).join(", "),
                  workplace_lat: p.latitude,
                  workplace_lng: p.longitude,
                })}
                placeholder="Office / work area..."
                className="min-h-12 w-full rounded-xl border-2 border-slate-200 px-4"
              />
            </div>
          )}
          <FormSelect
            value={reqForm.bhk}
            onChange={(v) => setReqForm({ ...reqForm, bhk: v })}
            options={BHK_OPTIONS}
            placeholder={isSupply ? "Select BHK *" : "Select BHK"}
          />
          {role === "landlord" && (
            <div>
              <div className="mb-2 text-sm font-medium">Preferred tenants</div>
              <p className="mb-2 text-xs text-slate-500">All, or pick one or more types.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => togglePreferredTenantType("all")}
                  className={`rounded-full px-3 py-1 text-sm ${preferredTenantTypes.length === 0 ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
                >
                  All
                </button>
                {TENANT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => togglePreferredTenantType(t.value)}
                    className={`rounded-full px-3 py-1 text-sm ${preferredTenantTypes.includes(t.value) ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isSupply ? (
            meta.stream === "sales" ? (
              <Input
                placeholder="Asking price *"
                type="number"
                required
                value={reqForm.budget_max}
                onChange={(e) => setReqForm({ ...reqForm, budget_min: "", budget_max: e.target.value })}
              />
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="Asking rent / month *"
                  type="number"
                  required
                  value={reqForm.rent_budget}
                  onChange={(e) => setReqForm({ ...reqForm, rent_budget: e.target.value })}
                />
                <Input
                  placeholder="Security deposit *"
                  type="number"
                  required
                  value={reqForm.security_deposit}
                  onChange={(e) => setReqForm({ ...reqForm, security_deposit: e.target.value })}
                />
                <Input
                  placeholder="Maintenance / month *"
                  type="number"
                  required
                  value={reqForm.maintenance}
                  onChange={(e) => setReqForm({ ...reqForm, maintenance: e.target.value })}
                />
              </div>
            )
          ) : meta.stream === "sales" ? (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Budget min" type="number" value={reqForm.budget_min} onChange={(e) => setReqForm({ ...reqForm, budget_min: e.target.value })} />
              <Input placeholder="Budget max" type="number" value={reqForm.budget_max} onChange={(e) => setReqForm({ ...reqForm, budget_max: e.target.value })} />
            </div>
          ) : (
            <Input placeholder="Rent budget / month" type="number" value={reqForm.rent_budget} onChange={(e) => setReqForm({ ...reqForm, rent_budget: e.target.value })} />
          )}
          {isSupply && (
            <div>
              <div className="mb-2 text-sm font-medium">Photos & videos *</div>
              <p className="mb-2 text-xs text-slate-500">
                At least one photo required. Images up to 25 MB. Videos up to 100 MB after compression
                (large videos are compressed in your browser automatically). Max 12 files.
              </p>
              <input
                type="file"
                multiple
                disabled={mediaBusy}
                required={mediaFiles.length === 0}
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm,.jpg,.jpeg,.png,.webp,.heic,.heif,.mp4,.mov,.webm"
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
                onChange={(e) => {
                  void onMediaPick(e.target.files);
                  e.target.value = "";
                }}
              />
              {mediaBusy && (
                <p className="mt-2 text-sm text-emerald-700">
                  {mediaStatus || "Processing media…"}
                  {mediaProgress != null ? ` ${Math.round(mediaProgress * 100)}%` : ""}
                </p>
              )}
              {!mediaBusy && mediaStatus && !mediaError && (
                <p className="mt-2 text-sm text-slate-600">{mediaStatus}</p>
              )}
              {mediaError && <p className="mt-2 text-sm text-red-600">{mediaError}</p>}
              {mediaFiles.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {mediaFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${file.size}-${index}`}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                        {mediaKind(file)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                      <span className="shrink-0 text-xs text-slate-500">{formatFileSize(file.size)}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => removeMediaFile(index)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <select
            className="min-h-12 w-full rounded-xl border-2 border-slate-200 px-4"
            value={reqForm.urgency}
            required={!!isSupply}
            onChange={(e) => setReqForm({ ...reqForm, urgency: e.target.value })}
          >
            <option value="">{isSupply ? "Urgency *" : "Urgency"}</option>
            {URGENCY_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
          <div>
            <div className="mb-2 text-sm font-medium">
              {isSupply ? "Property available from *" : "Move-in date"}
            </div>
            <Input
              type="date"
              required={!!isSupply}
              value={reqForm.move_in_date}
              onChange={(e) => setReqForm({ ...reqForm, move_in_date: e.target.value })}
            />
          </div>
          <select
            className="min-h-12 w-full rounded-xl border-2 border-slate-200 px-4"
            value={reqForm.lead_score}
            required={!!isSupply}
            onChange={(e) => setReqForm({ ...reqForm, lead_score: e.target.value })}
          >
            <option value="">{isSupply ? "Lead score *" : "Lead score"}</option>
            {LEAD_SCORE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <Textarea placeholder="Notes (optional)" value={reqForm.notes} onChange={(e) => setReqForm({ ...reqForm, notes: e.target.value })} />
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Button className="w-full" disabled={loading || mediaBusy || !!mediaError} onClick={saveLead}>
            {loading
              ? "Saving..."
              : role === "landlord"
                ? "Save & find renters"
                : role === "seller"
                  ? "Save & find buyers"
                  : "Save & find properties"}
          </Button>
        </Card>
      )}

      {createStep === 3 && available && savedReqId && (
        <div className="space-y-4">
          <AvailableSection
            title={`Within ${available.search_radius_km || 5} km`}
            items={available.within_radius}
            stream={role ? getContactType(role).stream : "rental"}
          />
          <AvailableSection title="Within 10 km" items={available.within_10km} stream={role ? getContactType(role).stream : "rental"} />
          <AvailableSection title={`In ${reqForm.city || "city"}`} items={available.in_city} stream={role ? getContactType(role).stream : "rental"} />
          <Button className="w-full" onClick={() => router.push(`/leads/${savedReqId}`)}>
            Open lead & manage matches
          </Button>
        </div>
      )}
    </AppShell>
  );
}

function AvailableSection({
  title,
  items,
  stream,
}: {
  title: string;
  items: AvailableNowResponse["within_radius"];
  stream: string;
}) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-2 font-semibold">{title} ({items.length})</h3>
      <div className="space-y-2">
        {items.slice(0, 5).map((p, i) => (
          <Card key={`${p.listing_id || p.spec_id}-${i}`} className="flex gap-3">
            {p.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(p.cover_url) || ""} alt="" className="h-16 w-16 rounded-lg object-cover" />
            )}
            <div>
              <div className="font-medium">{p.title}</div>
              <div className="text-sm text-slate-600">{p.location}</div>
              <div className="text-sm">{formatPrice(p.price, stream)} {p.distance_km != null ? `· ${p.distance_km} km` : ""}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
