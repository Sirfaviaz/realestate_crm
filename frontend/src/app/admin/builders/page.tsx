"use client";

import { useEffect, useState } from "react";
import { buildersApi, inventoryApi, type Builder, type Project } from "@/lib/api";
import { digitsOnly, isValidPhone, phoneError } from "@/lib/phone";
import { AppShell } from "@/components/app-shell";
import { Button, Card, Input, ListItem } from "@/components/ui";

export default function BuildersAdminPage() {
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    buildersApi.list().then(setBuilders);
    inventoryApi.projects().then(setProjects);
  }, []);

  const toggleProject = (id: string) => {
    setSelectedProjects((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = async () => {
    if (phone) {
      const err = phoneError(phone, { required: false });
      if (err) {
        setMessage(err);
        return;
      }
    }
    try {
      const b = await buildersApi.create({ name, email, phone, project_ids: selectedProjects });
      setBuilders((prev) => [b, ...prev]);
      setMessage(`Builder ${b.name} added`);
      setName("");
      setEmail("");
      setPhone("");
      setSelectedProjects([]);
    } catch (e) {
      setMessage(String(e));
    }
  };

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl font-bold">Builders</h1>
      {message && <Card className="mb-4 bg-emerald-50 text-sm">{message}</Card>}

      <Card className="mb-6 space-y-3">
        <Input placeholder="Builder name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div>
          <Input
            placeholder="Phone (10 digits)"
            inputMode="numeric"
            maxLength={10}
            value={phone}
            onChange={(e) => setPhone(digitsOnly(e.target.value))}
          />
          {phone && phoneError(phone, { required: false }) && (
            <p className="mt-1 text-sm text-red-600">{phoneError(phone, { required: false })}</p>
          )}
        </div>
        <div>
          <div className="mb-2 text-sm font-medium">Linked projects</div>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {projects.map((p) => (
              <label key={p.id} className="flex items-center gap-2 rounded-lg p-2 hover:bg-slate-50">
                <input type="checkbox" checked={selectedProjects.includes(p.id)} onChange={() => toggleProject(p.id)} />
                <span className="text-sm">{p.name}</span>
              </label>
            ))}
          </div>
        </div>
        <Button className="w-full" disabled={!!phone && !isValidPhone(phone)} onClick={save}>
          Add Builder
        </Button>
      </Card>

      <div className="space-y-2">
        {builders.map((b) => (
          <ListItem key={b.id} title={b.name} subtitle={`${b.email} · ${b.project_ids.length} projects`} />
        ))}
      </div>
    </AppShell>
  );
}
