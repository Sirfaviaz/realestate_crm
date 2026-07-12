"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, MapPin, Navigation } from "lucide-react";
import {
  buildersApi,
  contactsApi,
  dealsApi,
  inventoryApi,
  type Contact,
  type Deal,
  type Location,
  type Project,
  type UnitOption,
  type UnitSpec,
} from "@/lib/api";
import {
  CONTACT_TYPES,
  getContactType,
  type ContactRoleKey,
  type ContactTypeConfig,
} from "@/lib/contact-roles";
import { formatPrice, formatSqft } from "@/lib/utils";
import { whatsappLink, whatsappMessage } from "@/lib/whatsapp";
import { AppShell, QuickActionsFooter } from "@/components/app-shell";
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
} from "@/components/ui";

export default function CallFlowPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [contactType, setContactType] = useState<ContactTypeConfig | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [nearby, setNearby] = useState(false);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [options, setOptions] = useState<UnitOption[]>([]);
  const [specs, setSpecs] = useState<UnitSpec[]>([]);

  const [contact, setContact] = useState<Contact | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [option, setOption] = useState<UnitOption | null>(null);
  const [spec, setSpec] = useState<UnitSpec | null>(null);
  const [deal, setDeal] = useState<Deal | null>(null);

  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showNewContact, setShowNewContact] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const stream = contactType?.stream ?? "sales";

  const loadContacts = useCallback(async (q?: string) => {
    if (!contactType) return;
    setLoading(true);
    try {
      setContacts(await contactsApi.list(q, contactType.stream, contactType.role));
    } finally {
      setLoading(false);
    }
  }, [contactType]);

  const loadLocations = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      if (nearby && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          const items = await inventoryApi.nearbyLocations(pos.coords.latitude, pos.coords.longitude, 5);
          setLocations(items);
          setLoading(false);
        }, () => {
          inventoryApi.locations(q).then(setLocations).finally(() => setLoading(false));
        });
      } else {
        setLocations(await inventoryApi.locations(q));
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, [nearby]);

  useEffect(() => {
    if (step === 1) loadContacts(query || undefined);
  }, [step, query, loadContacts]);

  useEffect(() => {
    if (step === 2) loadLocations(query || undefined);
  }, [step, query, loadLocations]);

  useEffect(() => {
    if (step === 3 && location) {
      setLoading(true);
      inventoryApi.projects(location.id, query || undefined).then(setProjects).finally(() => setLoading(false));
    }
  }, [step, location, query]);

  useEffect(() => {
    if (step === 4 && project && contactType) {
      setLoading(true);
      inventoryApi.options(project.id, contactType.stream, query || undefined).then(setOptions).finally(() => setLoading(false));
    }
  }, [step, project, query, contactType]);

  useEffect(() => {
    if (step === 5 && option && contactType) {
      setLoading(true);
      inventoryApi.specs(option.id, contactType.stream).then(setSpecs).finally(() => setLoading(false));
    }
  }, [step, option, contactType]);

  const pickContactType = (role: ContactRoleKey) => {
    setContactType(getContactType(role));
    setQuery("");
    setStep(1);
  };

  const selectContact = async (c: Contact) => {
    if (!contactType) return;
    setContact(c);
    const deals = await dealsApi.list(contactType.stream, c.id);
    if (deals[0]) {
      setDeal(deals[0]);
    } else {
      const d = await dealsApi.create({ stream_type: contactType.stream, contact_id: c.id, stage: "contacted" });
      setDeal(d);
    }
    setQuery("");
    setStep(2);
  };

  const createContact = async () => {
    if (!newName || !newPhone || !contactType) return;
    const c = await contactsApi.create({
      name: newName,
      phone: newPhone,
      roles: [contactType.role],
      stream_type: contactType.stream,
    });
    await selectContact(c);
    setShowNewContact(false);
  };

  const selectLocation = (loc: Location) => {
    setLocation(loc);
    setQuery("");
    setStep(3);
  };

  const selectProject = (proj: Project) => {
    setProject(proj);
    setQuery("");
    setStep(4);
  };

  const selectOption = (opt: UnitOption) => {
    setOption(opt);
    setQuery("");
    setStep(5);
  };

  const selectSpec = async (s: UnitSpec) => {
    setSpec(s);
    if (deal && contactType) {
      await dealsApi.update(deal.id, { stream_type: contactType.stream, contact_id: deal.contact_id, spec_id: s.id });
    }
  };

  const saveNote = async () => {
    if (!noteText || !contact) return;
    await contactsApi.addActivity({
      contact_id: contact.id,
      deal_id: deal?.id,
      activity_type: "note",
      content: noteText,
    });
    setNoteText("");
    setShowNote(false);
  };

  const sendToBuilder = async () => {
    if (!deal) return;
    const list = await buildersApi.list();
    const matching = list.find((b) => b.project_ids.includes(project?.id || ""));
    const builder = matching || list[0];
    if (!builder) {
      alert("No builders configured. Ask admin to add builders.");
      return;
    }
    await buildersApi.sendLead(deal.id, builder.id);
    alert(`Lead sent to ${builder.name}`);
  };

  const goBack = () => {
    if (step === 0) router.push("/");
    else if (step === 1) {
      setContactType(null);
      setQuery("");
      setStep(0);
    } else {
      setQuery("");
      setStep(step - 1);
    }
  };

  const titles = [
    "Who are you calling?",
    `Select ${contactType?.label ?? "Contact"}`,
    "Select Location",
    "Select Project",
    "Select Option",
    "Unit Specs",
  ];

  return (
    <AppShell>
      <button type="button" onClick={goBack} className="mb-3 flex items-center gap-1 text-sm text-slate-600">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      <StepHeader step={step + 1} total={6} title={titles[step]} />

      {contact && step > 1 && (
        <Card className="mb-4 bg-emerald-50">
          <div className="text-sm text-slate-600">
            On call with {contactType?.label}
          </div>
          <div className="font-semibold">{contact.name}</div>
          <div className="text-sm text-slate-500">{contact.phone}</div>
        </Card>
      )}

      {step > 0 && step < 5 && (
        <SearchBar value={query} onChange={setQuery} placeholder={`Search ${titles[step].toLowerCase()}...`} />
      )}

      {step === 0 && (
        <div className="grid grid-cols-2 gap-3">
          {CONTACT_TYPES.map((type) => (
            <button
              key={type.role}
              type="button"
              onClick={() => pickContactType(type.role)}
              className="rounded-2xl border-2 border-slate-200 bg-white p-4 text-left transition-colors hover:border-emerald-400 active:bg-emerald-50 min-h-[100px]"
            >
              <div className="text-lg font-bold text-slate-900">{type.label}</div>
              <div className="mt-1 text-sm text-slate-500">{type.description}</div>
            </button>
          ))}
        </div>
      )}

      {step === 1 && contactType && (
        <>
          <Button className="mb-3 w-full" variant="outline" onClick={() => setShowNewContact(!showNewContact)}>
            + New {contactType.label}
          </Button>
          {showNewContact && (
            <Card className="mb-3 space-y-3">
              <Input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input placeholder="Phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} type="tel" />
              <Button className="w-full" onClick={createContact}>Save & Continue</Button>
            </Card>
          )}
          {loading ? <LoadingSpinner /> : (
            <div className="space-y-2">
              {contacts.map((c) => (
                <ListItem key={c.id} title={c.name} subtitle={c.phone} onClick={() => selectContact(c)} />
              ))}
              {contacts.length === 0 && <EmptyState message="No contacts found" />}
            </div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <Button className="mb-3 w-full" variant={nearby ? "default" : "outline"} onClick={() => setNearby(!nearby)}>
            <Navigation className="h-4 w-4" /> {nearby ? "Showing Nearby" : "Show Nearby"}
          </Button>
          {loading ? <LoadingSpinner /> : (
            <div className="space-y-2">
              {locations.map((loc) => (
                <ListItem
                  key={loc.id}
                  title={loc.area}
                  subtitle={`${loc.city}${loc.pin_code ? ` · ${loc.pin_code}` : ""}`}
                  onClick={() => selectLocation(loc)}
                  right={<MapPin className="h-5 w-5 text-slate-400" />}
                />
              ))}
              {locations.length === 0 && <EmptyState message="No locations found" />}
            </div>
          )}
        </>
      )}

      {step === 3 && (
        loading ? <LoadingSpinner /> : (
          <div className="space-y-2">
            {projects.map((p) => (
              <ListItem key={p.id} title={p.name} subtitle={p.builder_name || undefined} onClick={() => selectProject(p)} />
            ))}
            {projects.length === 0 && <EmptyState message="No projects in this location" />}
          </div>
        )
      )}

      {step === 4 && (
        loading ? <LoadingSpinner /> : (
          <div className="space-y-2">
            {options.map((o) => (
              <ListItem
                key={o.id}
                title={o.configuration}
                subtitle={[o.tower, o.availability_count != null ? `${o.availability_count} available` : null].filter(Boolean).join(" · ") || undefined}
                onClick={() => selectOption(o)}
              />
            ))}
            {options.length === 0 && <EmptyState message="No options in this project" />}
          </div>
        )
      )}

      {step === 5 && (
        loading ? <LoadingSpinner /> : (
          <div className="space-y-3 pb-20">
            {specs.map((s) => (
              <Card
                key={s.id}
                className={spec?.id === s.id ? "border-2 border-emerald-500" : ""}
                onClick={() => selectSpec(s)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-bold">{formatPrice(s.sale_price || s.rent_price, stream)}</div>
                    <div className="text-sm text-slate-600">{formatSqft(s.carpet_sqft || s.built_up_sqft)}</div>
                  </div>
                  <Badge>{s.status}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-600">
                  {s.floor && <span>Floor: {s.floor}</span>}
                  {s.facing && <span>Facing: {s.facing}</span>}
                  {s.parking && <span>Parking: {s.parking}</span>}
                  {s.furnishing && <span>{s.furnishing}</span>}
                </div>
              </Card>
            ))}
            {specs.length === 0 && <EmptyState message="No units available" />}
          </div>
        )
      )}

      {showNote && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/40 p-4">
          <Card className="w-full max-w-lg">
            <h3 className="mb-2 font-semibold">Add Note</h3>
            <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="What did they say?" />
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setShowNote(false)}>Cancel</Button>
              <Button className="flex-1" onClick={saveNote}>Save</Button>
            </div>
          </Card>
        </div>
      )}

      {contact && step >= 2 && (
        <QuickActionsFooter
          phone={contact.phone}
          whatsapp={contact.whatsapp || contact.phone}
          whatsappMessage={whatsappMessage({
            type: "follow_up",
            name: contact.name,
            role: contactType?.role,
          })}
          onNote={() => setShowNote(true)}
          onSendBuilder={contactType?.role === "buyer" ? sendToBuilder : undefined}
        />
      )}
    </AppShell>
  );
}
