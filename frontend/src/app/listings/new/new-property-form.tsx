"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  contactsApi,
  listingsApi,
  requirementsApi,
  type Contact,
  type LocationAnchor,
} from "@/lib/api";
import { PROPERTY_TYPES } from "@/lib/contact-roles";
import { BHK_OPTIONS } from "@/lib/inventory-presets";
import { formatFileSize, validateMediaFiles } from "@/lib/media-validation";
import { prepareMediaFiles } from "@/lib/compress-video";
import { digitsOnly, isValidPhone, phoneError } from "@/lib/phone";
import { AppShell } from "@/components/app-shell";
import { GooglePlacesInput } from "@/components/google-places-input";
import { Button, Card, FormSelect, Input, ListItem, LoadingSpinner, Textarea } from "@/components/ui";

type OwnerMode = "existing" | "new";

export default function NewPropertyPage() {
  const router = useRouter();
  const search = useSearchParams();
  const presetContactId = search.get("contact_id") || "";
  const presetStream =
    search.get("stream") === "rental" ? "rental" : search.get("stream") === "sales" ? "sales" : "";

  const [stream, setStream] = useState(presetStream || "rental");
  const [ownerMode, setOwnerMode] = useState<OwnerMode>("existing");
  const [owners, setOwners] = useState<Contact[]>([]);
  const [ownerQuery, setOwnerQuery] = useState("");
  const [contactId, setContactId] = useState(presetContactId);
  const [lockedOwner, setLockedOwner] = useState<Contact | null>(null);
  const [ownerLocked, setOwnerLocked] = useState(Boolean(presetContactId));
  const [ownerForm, setOwnerForm] = useState({ name: "", phone: "", whatsapp: "" });
  const [form, setForm] = useState({
    title: "",
    location_text: "",
    city: "",
    latitude: null as number | null,
    longitude: null as number | null,
    property_type: "",
    bhk: "",
    price: "",
    security_deposit: "",
    maintenance: "",
    notes: "",
  });
  const [anchors, setAnchors] = useState<LocationAnchor[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaStatus, setMediaStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingOwners, setLoadingOwners] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = stream === "sales" ? "seller" : "landlord";

  useEffect(() => {
    if (ownerLocked) return;
    setLoadingOwners(true);
    contactsApi
      .list(ownerQuery || undefined, stream, role)
      .then(setOwners)
      .finally(() => setLoadingOwners(false));
  }, [ownerQuery, stream, role, ownerLocked]);

  useEffect(() => {
    if (!presetContactId) return;
    setOwnerLocked(true);
    setContactId(presetContactId);
    setOwnerMode("existing");
    contactsApi.list().then((all) => {
      const found = all.find((c) => c.id === presetContactId);
      if (found) {
        setLockedOwner(found);
        if (!presetStream) {
          setStream(found.stream_type === "sales" ? "sales" : "rental");
        }
      }
    });
  }, [presetContactId, presetStream]);

  const selectedOwner = useMemo(
    () => lockedOwner || owners.find((o) => o.id === contactId) || null,
    [lockedOwner, owners, contactId]
  );

  const onPlace = (p: {
    area: string;
    city: string;
    latitude?: number;
    longitude?: number;
  }) => {
    const name = [p.area, p.city].filter(Boolean).join(", ");
    setForm((f) => ({
      ...f,
      location_text: name,
      city: p.city || f.city,
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
    }));
    if (p.latitude != null && p.longitude != null) {
      setAnchors([{ name: p.area || name, lat: p.latitude, lng: p.longitude, radius_km: 5 }]);
    }
  };

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const incoming = Array.from(list);
    const err = validateMediaFiles([...files, ...incoming]);
    if (err) {
      setError(err);
      return;
    }
    setMediaBusy(true);
    setMediaStatus("Preparing media…");
    try {
      const { files: prepared, error: prepErr } = await prepareMediaFiles(incoming, {
        onStatus: (msg) => setMediaStatus(msg),
      });
      if (prepErr) {
        setError(prepErr);
        return;
      }
      setFiles((prev) => [...prev, ...prepared]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare media");
    } finally {
      setMediaBusy(false);
      setMediaStatus(null);
    }
  };

  const save = async () => {
    setError(null);
    if (!form.location_text.trim()) {
      setError("Location is required");
      return;
    }
    if (!form.price) {
      setError(stream === "rental" ? "Monthly rent is required" : "Asking price is required");
      return;
    }
    if (!files.length) {
      setError("Add at least one photo");
      return;
    }
    const mediaErr = validateMediaFiles(files);
    if (mediaErr) {
      setError(mediaErr);
      return;
    }

    let ownerId = contactId;
    if (ownerMode === "new") {
      const phoneErr =
        phoneError(ownerForm.phone) ||
        (ownerForm.whatsapp
          ? phoneError(ownerForm.whatsapp, { required: false, label: "WhatsApp" })
          : null);
      if (!ownerForm.name.trim()) {
        setError("Owner name is required");
        return;
      }
      if (phoneErr) {
        setError(phoneErr);
        return;
      }
    } else if (!ownerId) {
      setError("Select an existing landlord/seller, or create a new one");
      return;
    }

    setLoading(true);
    try {
      if (ownerMode === "new") {
        const contact = await contactsApi.create({
          name: ownerForm.name.trim(),
          phone: ownerForm.phone,
          whatsapp: ownerForm.whatsapp || undefined,
          roles: [role],
          stream_type: stream,
        });
        ownerId = contact.id;
      }

      const price = Number(form.price);
      const deposit = form.security_deposit ? Number(form.security_deposit) : undefined;
      const maintenance = form.maintenance ? Number(form.maintenance) : undefined;
      const title =
        form.title.trim() ||
        [form.bhk, form.property_type, form.location_text.split(",")[0]].filter(Boolean).join(" · ") ||
        "Property";

      const listing = await listingsApi.create({
        contact_id: ownerId,
        stream_type: stream,
        title,
        location_text: form.location_text,
        latitude: form.latitude ?? undefined,
        longitude: form.longitude ?? undefined,
        bhk: form.bhk || undefined,
        property_type: form.property_type || undefined,
        price,
        monthly_rent: stream === "rental" ? price : undefined,
        security_deposit: stream === "rental" ? deposit : undefined,
        maintenance: stream === "rental" ? maintenance : undefined,
        total_amount: stream === "sales" ? price : undefined,
        description: form.notes || undefined,
        status: "available",
      });

      for (let i = 0; i < files.length; i++) {
        await listingsApi.uploadMedia(listing.id, files[i], i);
      }

      await requirementsApi.create({
        contact_id: ownerId!,
        role,
        stream_type: stream,
        property_types: form.property_type ? [form.property_type] : undefined,
        preferred_locations: anchors.length
          ? anchors.map((a) => a.name)
          : form.location_text
            ? [form.location_text]
            : undefined,
        location_anchors: anchors.length ? anchors : undefined,
        city: form.city || undefined,
        bhk: form.bhk || undefined,
        budget_max: stream === "sales" ? price : undefined,
        rent_budget: stream === "rental" ? price : undefined,
        security_deposit: stream === "rental" ? deposit : undefined,
        maintenance: stream === "rental" ? maintenance : undefined,
        notes: form.notes || undefined,
        listing_id: listing.id,
        status: "active",
      });

      router.replace(`/listings/${listing.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save property");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <Link href="/listings" className="mb-3 flex items-center gap-1 text-sm text-slate-600">
        <ChevronLeft className="h-4 w-4" /> Back to Properties
      </Link>
      <h1 className="mb-1 text-2xl font-bold">Add property</h1>
      <p className="mb-4 text-sm text-slate-600">
        {ownerLocked && selectedOwner
          ? `Adding another property for ${selectedOwner.name}.`
          : "Link to an existing landlord/seller to keep multiple properties under one person."}
      </p>

      <Card className="mb-4 space-y-3">
        <div className="text-sm font-semibold text-slate-800">Listing type</div>
        <div className="flex gap-2">
          {(
            [
              { value: "rental", label: "Rent" },
              { value: "sales", label: "Sale" },
            ] as const
          ).map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                setStream(s.value);
                if (!ownerLocked) setContactId("");
              }}
              className={`min-h-10 flex-1 rounded-xl text-sm font-medium ${stream === s.value ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-4 space-y-3">
        <div className="text-sm font-semibold text-slate-800">
          {stream === "sales" ? "Seller" : "Landlord"}
        </div>

        {ownerLocked ? (
          <div className="rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            <div className="font-medium">{selectedOwner?.name || "Selected owner"}</div>
            {selectedOwner?.phone && <div className="text-emerald-800">{selectedOwner.phone}</div>}
            <button
              type="button"
              className="mt-2 text-sm font-medium text-emerald-700 underline"
              onClick={() => {
                setOwnerLocked(false);
                setLockedOwner(null);
              }}
            >
              Choose a different person
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOwnerMode("existing")}
                className={`min-h-10 flex-1 rounded-xl text-sm font-medium ${ownerMode === "existing" ? "bg-slate-800 text-white" : "bg-slate-100"}`}
              >
                Existing
              </button>
              <button
                type="button"
                onClick={() => {
                  setOwnerMode("new");
                  setContactId("");
                }}
                className={`min-h-10 flex-1 rounded-xl text-sm font-medium ${ownerMode === "new" ? "bg-slate-800 text-white" : "bg-slate-100"}`}
              >
                New person
              </button>
            </div>

            {ownerMode === "existing" ? (
              <>
                <Input
                  placeholder="Search by name or phone…"
                  value={ownerQuery}
                  onChange={(e) => setOwnerQuery(e.target.value)}
                />
                {selectedOwner && (
                  <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    Selected: <span className="font-medium">{selectedOwner.name}</span> · {selectedOwner.phone}
                  </div>
                )}
                {loadingOwners ? (
                  <LoadingSpinner />
                ) : owners.length === 0 ? (
                  <p className="text-sm text-slate-500">No matching owners — create a new person instead.</p>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {owners.map((c) => (
                      <ListItem
                        key={c.id}
                        title={c.name}
                        subtitle={c.phone}
                        active={contactId === c.id}
                        onClick={() => setContactId(c.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <Input
                  placeholder="Name *"
                  value={ownerForm.name}
                  onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })}
                />
                <Input
                  placeholder="Phone * (10 digits)"
                  inputMode="numeric"
                  maxLength={10}
                  value={ownerForm.phone}
                  onChange={(e) => setOwnerForm({ ...ownerForm, phone: digitsOnly(e.target.value) })}
                />
                <Input
                  placeholder="WhatsApp (10 digits)"
                  inputMode="numeric"
                  maxLength={10}
                  value={ownerForm.whatsapp}
                  onChange={(e) => setOwnerForm({ ...ownerForm, whatsapp: digitsOnly(e.target.value) })}
                />
                <button
                  type="button"
                  disabled={!isValidPhone(ownerForm.phone)}
                  onClick={() => setOwnerForm((f) => ({ ...f, whatsapp: f.phone }))}
                  className="text-sm font-medium text-emerald-700 disabled:text-slate-400"
                >
                  Same as phone
                </button>
              </>
            )}
          </>
        )}
      </Card>

      <Card className="mb-4 space-y-3">
        <div className="text-sm font-semibold text-slate-800">Property</div>
        <GooglePlacesInput
          onSelect={onPlace}
          placeholder="Search location…"
          className="flex min-h-12 w-full rounded-xl border-2 border-slate-200 px-4"
        />
        <Input
          placeholder="Location *"
          value={form.location_text}
          onChange={(e) => setForm({ ...form, location_text: e.target.value })}
        />
        <Input
          placeholder="Title (optional)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <FormSelect
          value={form.property_type}
          onChange={(v) => setForm({ ...form, property_type: v })}
          options={PROPERTY_TYPES.map((p) => ({ value: p.value, label: p.label }))}
          placeholder="Property type"
        />
        <FormSelect
          value={form.bhk}
          onChange={(v) => setForm({ ...form, bhk: v })}
          options={BHK_OPTIONS}
          placeholder="BHK"
        />
        <Input
          type="number"
          placeholder={stream === "rental" ? "Monthly rent *" : "Asking price *"}
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
        />
        {stream === "rental" && (
          <>
            <Input
              type="number"
              placeholder="Security deposit"
              value={form.security_deposit}
              onChange={(e) => setForm({ ...form, security_deposit: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Maintenance / month"
              value={form.maintenance}
              onChange={(e) => setForm({ ...form, maintenance: e.target.value })}
            />
          </>
        )}
        <Textarea
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Photos / videos *</label>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            disabled={mediaBusy}
            onChange={(e) => onFiles(e.target.files)}
            className="block w-full text-sm"
          />
          {mediaStatus && <p className="mt-1 text-xs text-slate-500">{mediaStatus}</p>}
          {files.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {files.map((f) => (
                <li key={`${f.name}-${f.size}`}>
                  {f.name} · {formatFileSize(f.size)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Button className="w-full" disabled={loading || mediaBusy} onClick={save}>
        {loading ? "Saving…" : "Save property"}
      </Button>
      <p className="mt-3 text-center text-xs text-slate-500">
        Need builder inventory?{" "}
        <Link href="/admin/inventory" className="font-medium text-emerald-700 underline">
          Open admin inventory
        </Link>
      </p>
    </AppShell>
  );
}
