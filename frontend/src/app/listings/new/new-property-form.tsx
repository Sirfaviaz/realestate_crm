"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { contactsApi, listingsApi, requirementsApi, type Contact } from "@/lib/api";
import { PROPERTY_TYPES } from "@/lib/contact-roles";
import { digitsOnly, isValidPhone, phoneError } from "@/lib/phone";
import {
  SupplyPropertyForm,
  emptySupplyPropertyValues,
  validateSupplyPropertyValues,
  type SupplyPropertyValues,
} from "@/components/supply-property-form";
import { AppShell } from "@/components/app-shell";
import { Button, Card, Input, ListItem, LoadingSpinner } from "@/components/ui";

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
  const [supply, setSupply] = useState<SupplyPropertyValues>(emptySupplyPropertyValues);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaStatus, setMediaStatus] = useState<string | null>(null);
  const [mediaProgress, setMediaProgress] = useState<number | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
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

  const save = async () => {
    setError(null);
    const supplyErr = validateSupplyPropertyValues(supply, role);
    if (supplyErr) {
      setError(supplyErr);
      if (
        supplyErr.toLowerCase().includes("photo") ||
        supplyErr.toLowerCase().includes("video") ||
        supplyErr.toLowerCase().includes("file")
      ) {
        setMediaError(supplyErr);
      }
      return;
    }

    let ownerId = contactId;
    if (ownerMode === "new" && !ownerLocked) {
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
      if (ownerMode === "new" && !ownerLocked) {
        const contact = await contactsApi.create({
          name: ownerForm.name.trim(),
          phone: ownerForm.phone,
          whatsapp: ownerForm.whatsapp || undefined,
          roles: [role],
          stream_type: stream,
        });
        ownerId = contact.id;
      }

      const anchor = supply.location_anchors[0];
      const area = anchor?.name || supply.city || "Property";
      const propType = supply.property_types[0];
      const typeLabel = PROPERTY_TYPES.find((p) => p.value === propType)?.label || propType;
      const title = [supply.bhk, typeLabel, area].filter(Boolean).join(" · ") || "Property";
      const rent = supply.rent_budget ? Number(supply.rent_budget) : undefined;
      const asking = supply.budget_max ? Number(supply.budget_max) : undefined;
      const deposit = supply.security_deposit ? Number(supply.security_deposit) : undefined;
      const maintenance = supply.maintenance ? Number(supply.maintenance) : undefined;

      const listing = await listingsApi.create({
        contact_id: ownerId,
        stream_type: stream,
        title,
        location_text: [area, supply.city].filter(Boolean).join(", "),
        latitude: supply.pin_lat ?? anchor?.lat,
        longitude: supply.pin_lng ?? anchor?.lng,
        bhk: supply.bhk || undefined,
        property_type: propType,
        price: stream === "rental" ? rent : asking,
        monthly_rent: stream === "rental" ? rent : undefined,
        security_deposit: role === "landlord" ? deposit : undefined,
        maintenance: role === "landlord" ? maintenance : undefined,
        total_amount: stream === "sales" ? asking : undefined,
        description: supply.notes || undefined,
        status: "available",
      });

      for (let i = 0; i < supply.media_files.length; i++) {
        await listingsApi.uploadMedia(listing.id, supply.media_files[i], i);
      }

      await requirementsApi.create({
        contact_id: ownerId!,
        role,
        stream_type: stream,
        property_types: supply.property_types.length ? supply.property_types : undefined,
        preferred_locations: supply.location_anchors.length
          ? supply.location_anchors.map((a) => a.name)
          : undefined,
        location_anchors: supply.location_anchors.length ? supply.location_anchors : undefined,
        city: supply.city || undefined,
        bhk: supply.bhk || undefined,
        budget_max: stream === "sales" ? asking : undefined,
        rent_budget: stream === "rental" ? rent : undefined,
        security_deposit: role === "landlord" ? deposit : undefined,
        maintenance: role === "landlord" ? maintenance : undefined,
        move_in_date: supply.move_in_date || undefined,
        urgency: supply.urgency || undefined,
        lead_score: supply.lead_score || undefined,
        notes: supply.notes || undefined,
        preferred_tenant_types:
          role === "landlord"
            ? supply.preferred_tenant_types.length
              ? supply.preferred_tenant_types
              : null
            : undefined,
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
          : "Same details as a landlord/seller lead — keeps everything under one person."}
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

      <Card className="mb-4">
        <SupplyPropertyForm
          role={role}
          values={supply}
          onChange={setSupply}
          mediaBusy={mediaBusy}
          mediaStatus={mediaStatus}
          mediaProgress={mediaProgress}
          mediaError={mediaError}
          onMediaBusy={setMediaBusy}
          onMediaStatus={setMediaStatus}
          onMediaProgress={setMediaProgress}
          onMediaError={setMediaError}
          intro={
            selectedOwner
              ? `What are ${selectedOwner.name}'s property details?`
              : "Property details"
          }
        />
      </Card>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Button className="w-full" disabled={loading || mediaBusy || !!mediaError} onClick={save}>
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
