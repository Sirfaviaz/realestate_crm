"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { inventoryApi, listingsApi, contactsApi, type Location, type Project, type Contact } from "@/lib/api";
import {
  AMENITY_OPTIONS,
  AVAILABLE_FLOOR_OPTIONS,
  BHK_OPTIONS,
  COMPLETION_TIMELINE_OPTIONS,
  DOWN_PAYMENT_OPTIONS,
  FACING_OPTIONS,
  FLOOR_COUNT_OPTIONS,
  FURNISHING_OPTIONS,
  GST_OPTIONS,
  INSTALMENT_OPTIONS,
  LAUNCH_TIMELINE_OPTIONS,
  PARKING_DETAIL_OPTIONS,
  PARKING_OPTIONS,
  POSSESSION_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  STREAM_OPTIONS,
} from "@/lib/inventory-presets";
import { validateMediaFiles } from "@/lib/media-validation";
import { digitsOnly, isValidPhone, phoneError } from "@/lib/phone";
import { AppShell } from "@/components/app-shell";
import { GooglePlacesInput, type PlaceSelection } from "@/components/google-places-input";
import { Button, Card, FormSelect, Input, ListItem, LoadingSpinner, Textarea } from "@/components/ui";

type Tab = "listing" | "location" | "project" | "unit";

function AmenitiesChips({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (a: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {AMENITY_OPTIONS.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onToggle(a)}
          className={`rounded-full px-3 py-1 text-sm ${selected.includes(a) ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
        >
          {a}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-sm font-medium text-slate-700">{children}</div>;
}

export default function InventoryAdminPage() {
  const [tab, setTab] = useState<Tab>("listing");
  const [locations, setLocations] = useState<Location[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [locForm, setLocForm] = useState<PlaceSelection>({ area: "", city: "" });
  const [projForm, setProjForm] = useState({
    name: "",
    builder_name: "",
    rera_id: "",
    possession_status: "",
    description: "",
    amenities: [] as string[],
    towers: "",
    total_units: "",
  });
  const [unitForm, setUnitForm] = useState({
    bhk: "",
    tower: "",
    availability_count: "",
    stream_type: "sales",
    carpet_sqft: "",
    built_up_sqft: "",
    sale_price: "",
    rent_price: "",
    floor: "",
    facing: "",
    parking: "",
    furnishing: "",
    unit_number: "",
  });
  const [listingForm, setListingForm] = useState({
    title: "",
    project_name: "",
    builder_name: "",
    location_text: "",
    latitude: null as number | null,
    longitude: null as number | null,
    property_type: "",
    land_area_cent: "",
    launching_time: "",
    completion_time: "",
    total_floors: "",
    parking_details: "",
    bhk: "",
    sqft: "",
    available_floors: "",
    amenities: [] as string[],
    base_price: "",
    car_parking_price: "",
    gst_percent: "",
    down_payment_percent: "",
    utility_charge: "",
    total_instalment: "",
    total_amount: "",
    price_as_of_date: "",
    monthly_rent: "",
    security_deposit: "",
    maintenance: "",
    stream_type: "sales",
    contact_id: "",
    description: "",
    use_project_context: true,
  });
  const [contactMode, setContactMode] = useState<"existing" | "new">("existing");
  const [ownerForm, setOwnerForm] = useState({ name: "", phone: "", email: "", whatsapp: "" });
  const [listingContacts, setListingContacts] = useState<Contact[]>([]);
  const [listingFiles, setListingFiles] = useState<File[]>([]);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);

  useEffect(() => {
    inventoryApi.locations().then(setLocations);
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      inventoryApi.projects(selectedLocation.id).then(setProjects);
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (tab === "listing") {
      const role = listingForm.stream_type === "sales" ? "seller" : "landlord";
      contactsApi.list(undefined, listingForm.stream_type, role).then(setListingContacts);
    }
  }, [tab, listingForm.stream_type]);

  useEffect(() => {
    if (!selectedProject || !listingForm.use_project_context) return;
    setListingForm((f) => ({
      ...f,
      project_name: selectedProject.name,
      builder_name: selectedProject.builder_name || "",
      location_text: selectedLocation
        ? `${selectedLocation.area}, ${selectedLocation.city}`
        : f.location_text,
      amenities: selectedProject.amenities || [],
    }));
  }, [selectedProject, selectedLocation, listingForm.use_project_context]);

  const toggleAmenity = (list: string[], a: string) =>
    list.includes(a) ? list.filter((x) => x !== a) : [...list, a];

  const num = (v: string) => (v ? Number(v) : undefined);

  const saveLocation = async () => {
    setLoading(true);
    try {
      const loc = await inventoryApi.createLocation(locForm);
      setLocations((prev) => [loc, ...prev]);
      setSelectedLocation(loc);
      setMessage("Location saved — continue to Project tab for builder inventory");
      setTab("project");
    } catch (e) {
      setMessage(String(e));
    } finally {
      setLoading(false);
    }
  };

  const saveProject = async () => {
    if (!selectedLocation) return;
    setLoading(true);
    try {
      const project = await inventoryApi.createProject({
        location_id: selectedLocation.id,
        name: projForm.name,
        builder_name: projForm.builder_name,
        rera_id: projForm.rera_id,
        possession_status: projForm.possession_status,
        description: projForm.description,
        amenities: projForm.amenities,
        extra_fields: {
          towers: projForm.towers.split(",").map((t) => t.trim()).filter(Boolean),
          total_units: projForm.total_units ? Number(projForm.total_units) : undefined,
        },
      });
      setSelectedProject(project);
      setProjects((prev) => [project, ...prev]);
      setMessage("Project saved — add units in Unit tab, or use Listing tab for seller/landlord");
      setTab("unit");
    } catch (e) {
      setMessage(String(e));
    } finally {
      setLoading(false);
    }
  };

  const saveUnit = async () => {
    if (!selectedProject) {
      setMessage("Select a location and save a project first");
      return;
    }
    if (!unitForm.bhk) {
      setMessage("Select BHK configuration");
      return;
    }
    setLoading(true);
    try {
      const option = await inventoryApi.createOption({
        project_id: selectedProject.id,
        configuration: unitForm.bhk,
        tower: unitForm.tower || undefined,
        availability_count: unitForm.availability_count ? Number(unitForm.availability_count) : undefined,
        stream_type: unitForm.stream_type,
      });
      await inventoryApi.createSpec({
        option_id: option.id,
        carpet_sqft: num(unitForm.carpet_sqft),
        built_up_sqft: num(unitForm.built_up_sqft),
        sale_price: unitForm.stream_type === "sales" ? num(unitForm.sale_price) : undefined,
        rent_price: unitForm.stream_type === "rental" ? num(unitForm.rent_price) : undefined,
        floor: unitForm.floor || undefined,
        facing: unitForm.facing || undefined,
        parking: unitForm.parking || undefined,
        furnishing: unitForm.furnishing || undefined,
        stream_type: unitForm.stream_type,
        unit_number: unitForm.unit_number || undefined,
        status: "available",
      });
      setMessage("Unit saved!");
      setUnitForm((f) => ({ ...f, unit_number: "", carpet_sqft: "", sale_price: "", rent_price: "" }));
    } catch (e) {
      setMessage(String(e));
    } finally {
      setLoading(false);
    }
  };

  const saveListing = async () => {
    const useCtx = listingForm.use_project_context && selectedProject;
    const projectName = useCtx ? selectedProject!.name : listingForm.project_name;
    const title = listingForm.title || projectName;
    if (!title) {
      setMessage("Project name is required");
      return;
    }
    if (contactMode === "new" && (!ownerForm.name.trim() || !ownerForm.phone.trim())) {
      setMessage("Owner name and phone are required");
      return;
    }
    if (contactMode === "new") {
      const phoneErr =
        phoneError(ownerForm.phone) ||
        (ownerForm.whatsapp
          ? phoneError(ownerForm.whatsapp, { required: false, label: "WhatsApp" })
          : null);
      if (phoneErr) {
        setMessage(phoneErr);
        return;
      }
    }
    if (listingFiles.length) {
      const mediaErr = validateMediaFiles(listingFiles);
      if (mediaErr) {
        setMessage(mediaErr);
        return;
      }
    }

    setLoading(true);
    try {
      let contactId = listingForm.contact_id || undefined;
      if (contactMode === "new") {
        const role = listingForm.stream_type === "sales" ? "seller" : "landlord";
        const contact = await contactsApi.create({
          name: ownerForm.name.trim(),
          phone: ownerForm.phone.trim(),
          email: ownerForm.email.trim() || undefined,
          whatsapp: ownerForm.whatsapp.trim() || undefined,
          roles: [role],
          stream_type: listingForm.stream_type,
          property_location: listingForm.location_text || undefined,
          asking_price: num(listingForm.total_amount) ?? num(listingForm.base_price),
          sqft: num(listingForm.sqft),
          preferred_bhk: listingForm.bhk || undefined,
        });
        contactId = contact.id;
        setListingContacts((prev) => [contact, ...prev]);
        setOwnerForm({ name: "", phone: "", email: "", whatsapp: "" });
        setContactMode("existing");
        setListingForm((f) => ({ ...f, contact_id: contact.id }));
      }

      const amenities = useCtx
        ? selectedProject!.amenities || []
        : listingForm.amenities;
      const price =
        listingForm.stream_type === "rental"
          ? num(listingForm.monthly_rent)
          : num(listingForm.total_amount) ?? num(listingForm.base_price);

      const listing = await listingsApi.create({
        title,
        project_name: projectName,
        builder_name: useCtx ? selectedProject!.builder_name || undefined : listingForm.builder_name || undefined,
        location_text: useCtx && selectedLocation
          ? `${selectedLocation.area}, ${selectedLocation.city}`
          : listingForm.location_text || undefined,
        latitude: listingForm.latitude ?? undefined,
        longitude: listingForm.longitude ?? undefined,
        property_type: listingForm.property_type || undefined,
        land_area_cent: num(listingForm.land_area_cent),
        launching_time: listingForm.launching_time || undefined,
        completion_time: listingForm.completion_time || undefined,
        total_floors: listingForm.total_floors ? Number(listingForm.total_floors) : undefined,
        parking_details: listingForm.parking_details || undefined,
        bhk: listingForm.bhk || undefined,
        sqft: num(listingForm.sqft),
        available_floors: listingForm.available_floors || undefined,
        amenities: amenities?.length ? amenities : undefined,
        base_price: num(listingForm.base_price),
        car_parking_price: num(listingForm.car_parking_price),
        gst_percent: num(listingForm.gst_percent),
        down_payment_percent: num(listingForm.down_payment_percent),
        utility_charge: num(listingForm.utility_charge),
        total_instalment: num(listingForm.total_instalment),
        total_amount: num(listingForm.total_amount),
        price_as_of_date: listingForm.price_as_of_date || undefined,
        monthly_rent: num(listingForm.monthly_rent),
        security_deposit: num(listingForm.security_deposit),
        maintenance: num(listingForm.maintenance),
        price,
        stream_type: listingForm.stream_type,
        contact_id: contactId,
        description: listingForm.description || undefined,
        status: "available",
      });
      setCreatedListingId(listing.id);
      for (let i = 0; i < listingFiles.length; i++) {
        await listingsApi.uploadMedia(listing.id, listingFiles[i], i);
      }
      setMessage(`Listing saved${contactId ? " and linked to People" : ""}`);
      setListingFiles([]);
    } catch (e) {
      setMessage(String(e));
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: Tab; label: string; hint: string }[] = [
    { id: "listing", label: "Listing", hint: "Seller / landlord" },
    { id: "location", label: "Location", hint: "Builder" },
    { id: "project", label: "Project", hint: "Builder" },
    { id: "unit", label: "Unit", hint: "Builder" },
  ];

  const showProjectFields = !listingForm.use_project_context || !selectedProject;

  return (
    <AppShell>
      <Link href="/listings" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600">
        ← Back to Properties
      </Link>
      <h1 className="mb-2 text-2xl font-bold">Add property</h1>
      <p className="mb-4 text-sm text-slate-600">
        Create a sale/rental listing with photos, or manage builder inventory (Location → Project → Unit).
      </p>

      {(selectedLocation || selectedProject) && (
        <Card className="mb-4 bg-slate-50 text-sm text-slate-700">
          {selectedLocation && <div>Location: {selectedLocation.area}, {selectedLocation.city}</div>}
          {selectedProject && <div>Project: {selectedProject.name}{selectedProject.builder_name ? ` · ${selectedProject.builder_name}` : ""}</div>}
        </Card>
      )}

      <div className="mb-4 flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-xl px-3 py-2 text-left ${tab === t.id ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            <div className="text-sm font-medium">{t.label}</div>
            <div className={`text-xs ${tab === t.id ? "text-emerald-100" : "text-slate-500"}`}>{t.hint}</div>
          </button>
        ))}
      </div>

      {message && <Card className="mb-4 bg-emerald-50 text-sm text-emerald-800">{message}</Card>}

      {tab === "location" && (
        <Card className="space-y-3">
          <GooglePlacesInput
            onSelect={(p) => setLocForm(p)}
            placeholder="Search with Google Places..."
            className="flex min-h-12 w-full rounded-xl border-2 border-slate-200 px-4"
          />
          <Input placeholder="Area" value={locForm.area} onChange={(e) => setLocForm({ ...locForm, area: e.target.value })} />
          <Input placeholder="City" value={locForm.city} onChange={(e) => setLocForm({ ...locForm, city: e.target.value })} />
          <Input placeholder="Pin code" value={locForm.pin_code || ""} onChange={(e) => setLocForm({ ...locForm, pin_code: e.target.value })} />
          <Button className="w-full" onClick={saveLocation} disabled={loading}>Save Location</Button>
          <div className="space-y-2 pt-2">
            {locations.map((l) => (
              <ListItem key={l.id} title={l.area} subtitle={l.city} onClick={() => setSelectedLocation(l)} active={selectedLocation?.id === l.id} />
            ))}
          </div>
        </Card>
      )}

      {tab === "project" && (
        <Card className="space-y-3">
          {!selectedLocation && <p className="text-sm text-amber-700">Save a location first.</p>}
          <Input placeholder="Project name *" value={projForm.name} onChange={(e) => setProjForm({ ...projForm, name: e.target.value })} />
          <Input placeholder="Builder name" value={projForm.builder_name} onChange={(e) => setProjForm({ ...projForm, builder_name: e.target.value })} />
          <Input placeholder="RERA ID" value={projForm.rera_id} onChange={(e) => setProjForm({ ...projForm, rera_id: e.target.value })} />
          <FieldLabel>Possession status</FieldLabel>
          <FormSelect
            value={projForm.possession_status}
            onChange={(v) => setProjForm({ ...projForm, possession_status: v })}
            options={POSSESSION_OPTIONS}
            placeholder="Possession status"
          />
          <Input placeholder="Towers (comma separated)" value={projForm.towers} onChange={(e) => setProjForm({ ...projForm, towers: e.target.value })} />
          <Input placeholder="Total units" type="number" value={projForm.total_units} onChange={(e) => setProjForm({ ...projForm, total_units: e.target.value })} />
          <Textarea placeholder="Description" value={projForm.description} onChange={(e) => setProjForm({ ...projForm, description: e.target.value })} />
          <FieldLabel>Amenities</FieldLabel>
          <AmenitiesChips
            selected={projForm.amenities}
            onToggle={(a) => setProjForm((f) => ({ ...f, amenities: toggleAmenity(f.amenities, a) }))}
          />
          <Button className="w-full" onClick={saveProject} disabled={loading || !selectedLocation || !projForm.name}>Save Project</Button>
          {projects.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              {projects.map((p) => (
                <ListItem key={p.id} title={p.name} subtitle={p.builder_name || undefined} onClick={() => setSelectedProject(p)} active={selectedProject?.id === p.id} />
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "unit" && (
        <Card className="space-y-3">
          {!selectedProject && <p className="text-sm text-amber-700">Save a project first.</p>}
          {selectedProject && <p className="text-sm text-slate-600">Project: {selectedProject.name}</p>}
          <FieldLabel>BHK *</FieldLabel>
          <FormSelect value={unitForm.bhk} onChange={(v) => setUnitForm({ ...unitForm, bhk: v })} options={BHK_OPTIONS} placeholder="Select BHK" required />
          <FieldLabel>Listing type</FieldLabel>
          <FormSelect value={unitForm.stream_type} onChange={(v) => setUnitForm({ ...unitForm, stream_type: v })} options={STREAM_OPTIONS} placeholder="Sale or rental" />
          <Input placeholder="Tower" value={unitForm.tower} onChange={(e) => setUnitForm({ ...unitForm, tower: e.target.value })} />
          <Input placeholder="Units available" type="number" value={unitForm.availability_count} onChange={(e) => setUnitForm({ ...unitForm, availability_count: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Carpet sq ft" type="number" value={unitForm.carpet_sqft} onChange={(e) => setUnitForm({ ...unitForm, carpet_sqft: e.target.value })} />
            <Input placeholder="Built-up sq ft" type="number" value={unitForm.built_up_sqft} onChange={(e) => setUnitForm({ ...unitForm, built_up_sqft: e.target.value })} />
          </div>
          {unitForm.stream_type === "sales" ? (
            <Input placeholder="Sale price (INR)" type="number" value={unitForm.sale_price} onChange={(e) => setUnitForm({ ...unitForm, sale_price: e.target.value })} />
          ) : (
            <Input placeholder="Rent / month (INR)" type="number" value={unitForm.rent_price} onChange={(e) => setUnitForm({ ...unitForm, rent_price: e.target.value })} />
          )}
          <FieldLabel>Facing</FieldLabel>
          <FormSelect value={unitForm.facing} onChange={(v) => setUnitForm({ ...unitForm, facing: v })} options={FACING_OPTIONS} placeholder="Facing" />
          <FieldLabel>Furnishing</FieldLabel>
          <FormSelect value={unitForm.furnishing} onChange={(v) => setUnitForm({ ...unitForm, furnishing: v })} options={FURNISHING_OPTIONS} placeholder="Furnishing" />
          <FieldLabel>Parking</FieldLabel>
          <FormSelect value={unitForm.parking} onChange={(v) => setUnitForm({ ...unitForm, parking: v })} options={PARKING_OPTIONS} placeholder="Parking" />
          <Input placeholder="Unit number" value={unitForm.unit_number} onChange={(e) => setUnitForm({ ...unitForm, unit_number: e.target.value })} />
          <Button className="w-full" onClick={saveUnit} disabled={loading || !selectedProject}>Save Unit</Button>
        </Card>
      )}

      {tab === "listing" && (
        <Card className="space-y-4">
          <FieldLabel>Listing type</FieldLabel>
          <FormSelect
            value={listingForm.stream_type}
            onChange={(v) => setListingForm({ ...listingForm, stream_type: v, contact_id: "" })}
            options={STREAM_OPTIONS}
            placeholder="Sale or rental"
          />

          {selectedProject && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={listingForm.use_project_context}
                onChange={(e) => setListingForm({ ...listingForm, use_project_context: e.target.checked })}
              />
              Use builder project &ldquo;{selectedProject.name}&rdquo; (skip duplicate project/location/amenities)
            </label>
          )}

          <div className="rounded-xl border border-slate-200 p-3 space-y-3">
            <div className="text-sm font-semibold">{listingForm.stream_type === "sales" ? "Seller" : "Landlord"}</div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setContactMode("existing")} className={`rounded-full px-3 py-1 text-sm ${contactMode === "existing" ? "bg-emerald-600 text-white" : "bg-slate-100"}`}>Existing</button>
              <button type="button" onClick={() => setContactMode("new")} className={`rounded-full px-3 py-1 text-sm ${contactMode === "new" ? "bg-emerald-600 text-white" : "bg-slate-100"}`}>Add new</button>
            </div>
            {contactMode === "existing" ? (
              <FormSelect
                value={listingForm.contact_id}
                onChange={(v) => setListingForm({ ...listingForm, contact_id: v })}
                options={listingContacts.map((c) => ({ value: c.id, label: `${c.name} · ${c.phone}` }))}
                placeholder={`Select ${listingForm.stream_type === "sales" ? "seller" : "landlord"} (optional)`}
              />
            ) : (
              <div className="space-y-2">
                <Input placeholder="Name *" value={ownerForm.name} onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })} />
                <div>
                  <Input
                    placeholder="Phone * (10 digits)"
                    inputMode="numeric"
                    maxLength={10}
                    value={ownerForm.phone}
                    onChange={(e) => setOwnerForm({ ...ownerForm, phone: digitsOnly(e.target.value) })}
                  />
                  {ownerForm.phone && phoneError(ownerForm.phone) && (
                    <p className="mt-1 text-sm text-red-600">{phoneError(ownerForm.phone)}</p>
                  )}
                </div>
                <div className="space-y-2">
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
                </div>
                <Input placeholder="Email" type="email" value={ownerForm.email} onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })} />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-3 space-y-3">
            <div className="text-sm font-semibold">Property</div>
            {showProjectFields ? (
              <>
                <Input placeholder="Project name *" value={listingForm.project_name} onChange={(e) => setListingForm({ ...listingForm, project_name: e.target.value })} />
                <Input placeholder="Builder" value={listingForm.builder_name} onChange={(e) => setListingForm({ ...listingForm, builder_name: e.target.value })} />
                <GooglePlacesInput
                  onSelect={(p: PlaceSelection) =>
                    setListingForm({
                      ...listingForm,
                      location_text: [p.area, p.city].filter(Boolean).join(", ") || listingForm.location_text,
                      latitude: p.latitude ?? null,
                      longitude: p.longitude ?? null,
                    })
                  }
                  placeholder="Search location..."
                  className="flex min-h-12 w-full rounded-xl border-2 border-slate-200 px-4"
                />
                <Input placeholder="Location" value={listingForm.location_text} onChange={(e) => setListingForm({ ...listingForm, location_text: e.target.value })} />
                <FieldLabel>Amenities</FieldLabel>
                <AmenitiesChips
                  selected={listingForm.amenities}
                  onToggle={(a) => setListingForm((f) => ({ ...f, amenities: toggleAmenity(f.amenities, a) }))}
                />
              </>
            ) : (
              <p className="text-sm text-slate-600">
                Using {selectedProject!.name} at {selectedLocation?.area}, {selectedLocation?.city}
              </p>
            )}
            <FieldLabel>Property type</FieldLabel>
            <FormSelect value={listingForm.property_type} onChange={(v) => setListingForm({ ...listingForm, property_type: v })} options={PROPERTY_TYPE_OPTIONS} placeholder="Property type" />
            <FieldLabel>BHK *</FieldLabel>
            <FormSelect value={listingForm.bhk} onChange={(v) => setListingForm({ ...listingForm, bhk: v })} options={BHK_OPTIONS} placeholder="Select BHK" />
            <Input placeholder="Sq ft" type="number" value={listingForm.sqft} onChange={(e) => setListingForm({ ...listingForm, sqft: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel>Total floors</FieldLabel>
                <FormSelect value={listingForm.total_floors} onChange={(v) => setListingForm({ ...listingForm, total_floors: v })} options={FLOOR_COUNT_OPTIONS} placeholder="Floors" />
              </div>
              <div>
                <FieldLabel>Available floors</FieldLabel>
                <FormSelect value={listingForm.available_floors} onChange={(v) => setListingForm({ ...listingForm, available_floors: v })} options={AVAILABLE_FLOOR_OPTIONS} placeholder="Available" />
              </div>
            </div>
            <FieldLabel>Parking</FieldLabel>
            <FormSelect value={listingForm.parking_details} onChange={(v) => setListingForm({ ...listingForm, parking_details: v })} options={PARKING_DETAIL_OPTIONS} placeholder="Parking details" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel>Launch</FieldLabel>
                <FormSelect value={listingForm.launching_time} onChange={(v) => setListingForm({ ...listingForm, launching_time: v })} options={LAUNCH_TIMELINE_OPTIONS} placeholder="Launch timeline" />
              </div>
              <div>
                <FieldLabel>Completion</FieldLabel>
                <FormSelect value={listingForm.completion_time} onChange={(v) => setListingForm({ ...listingForm, completion_time: v })} options={COMPLETION_TIMELINE_OPTIONS} placeholder="Completion" />
              </div>
            </div>
            <Input placeholder="Land area (cent)" type="number" value={listingForm.land_area_cent} onChange={(e) => setListingForm({ ...listingForm, land_area_cent: e.target.value })} />
          </div>

          <div className="rounded-xl border border-slate-200 p-3 space-y-3">
            <div className="text-sm font-semibold">Pricing</div>
            {listingForm.stream_type === "sales" ? (
              <>
                <Input placeholder="Basic / floor price (INR)" type="number" value={listingForm.base_price} onChange={(e) => setListingForm({ ...listingForm, base_price: e.target.value })} />
                <Input placeholder="Car parking (INR)" type="number" value={listingForm.car_parking_price} onChange={(e) => setListingForm({ ...listingForm, car_parking_price: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>GST</FieldLabel>
                    <FormSelect value={listingForm.gst_percent} onChange={(v) => setListingForm({ ...listingForm, gst_percent: v })} options={GST_OPTIONS} placeholder="GST %" />
                  </div>
                  <div>
                    <FieldLabel>Down payment</FieldLabel>
                    <FormSelect value={listingForm.down_payment_percent} onChange={(v) => setListingForm({ ...listingForm, down_payment_percent: v })} options={DOWN_PAYMENT_OPTIONS} placeholder="Down payment" />
                  </div>
                </div>
                <Input placeholder="Utility charge (INR)" type="number" value={listingForm.utility_charge} onChange={(e) => setListingForm({ ...listingForm, utility_charge: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Instalments</FieldLabel>
                    <FormSelect value={listingForm.total_instalment} onChange={(v) => setListingForm({ ...listingForm, total_instalment: v })} options={INSTALMENT_OPTIONS} placeholder="Instalments" />
                  </div>
                  <Input placeholder="Total amount (INR)" type="number" value={listingForm.total_amount} onChange={(e) => setListingForm({ ...listingForm, total_amount: e.target.value })} />
                </div>
                <Input placeholder="Price as of date" type="date" value={listingForm.price_as_of_date} onChange={(e) => setListingForm({ ...listingForm, price_as_of_date: e.target.value })} />
              </>
            ) : (
              <>
                <Input placeholder="Monthly rent (INR)" type="number" value={listingForm.monthly_rent} onChange={(e) => setListingForm({ ...listingForm, monthly_rent: e.target.value })} />
                <Input placeholder="Security deposit (INR)" type="number" value={listingForm.security_deposit} onChange={(e) => setListingForm({ ...listingForm, security_deposit: e.target.value })} />
                <Input placeholder="Maintenance / month (INR)" type="number" value={listingForm.maintenance} onChange={(e) => setListingForm({ ...listingForm, maintenance: e.target.value })} />
                <Input placeholder="Car parking (INR)" type="number" value={listingForm.car_parking_price} onChange={(e) => setListingForm({ ...listingForm, car_parking_price: e.target.value })} />
              </>
            )}
          </div>

          <Textarea placeholder="Notes" value={listingForm.description} onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Photos & videos</span>
            <p className="mb-2 text-xs text-slate-500">
              Images up to 25 MB (JPG, PNG, WebP, HEIC). Videos up to 50 MB (MP4, MOV, WebM). Max 12 files.
            </p>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm,.jpg,.jpeg,.png,.webp,.heic,.heif,.mp4,.mov,.webm"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                const err = validateMediaFiles(files);
                if (err) {
                  setMessage(err);
                  setListingFiles([]);
                } else {
                  setMessage("");
                  setListingFiles(files);
                }
                e.target.value = "";
              }}
            />
            {listingFiles.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">{listingFiles.length} file(s) selected</p>
            )}
          </label>
          {createdListingId && <p className="text-sm text-emerald-700">Last listing saved</p>}
          <Button className="w-full" onClick={saveListing} disabled={loading || !(listingForm.project_name || (listingForm.use_project_context && selectedProject)) || !listingForm.bhk}>
            Save Listing
          </Button>
        </Card>
      )}

      {loading && <LoadingSpinner />}
    </AppShell>
  );
}
