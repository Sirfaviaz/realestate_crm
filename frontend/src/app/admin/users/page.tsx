"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/contact-roles";
import { digitsOnly, isValidPhone, phoneError } from "@/lib/phone";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, Input, ListItem, LoadingSpinner } from "@/components/ui";

export default function AdminUsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (user && !isAdmin(user.role)) router.replace("/");
  }, [user, router]);

  const load = () => {
    setLoading(true);
    authApi.listUsers().then(setUsers).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAdmin(user?.role)) load();
  }, [user]);

  const create = async () => {
    if (form.phone) {
      const err = phoneError(form.phone, { required: false });
      if (err) {
        setFormError(err);
        return;
      }
    }
    setFormError(null);
    await authApi.createUser({ ...form, phone: form.phone || undefined, role: "user" });
    setForm({ name: "", email: "", phone: "", password: "" });
    setShowForm(false);
    load();
  };

  const toggleActive = async (u: User) => {
    await authApi.updateUser(u.id, { is_active: !u.is_active });
    load();
  };

  if (!isAdmin(user?.role)) return null;

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl font-bold">Users</h1>
      <Button className="mb-4 w-full" variant="outline" onClick={() => setShowForm(!showForm)}>
        + Create User
      </Button>
      {showForm && (
        <Card className="mb-4 space-y-3">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <div>
            <Input
              placeholder="Phone (10 digits)"
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: digitsOnly(e.target.value) })}
            />
            {form.phone && phoneError(form.phone, { required: false }) && (
              <p className="mt-1 text-sm text-red-600">{phoneError(form.phone, { required: false })}</p>
            )}
          </div>
          <Input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Button
            className="w-full"
            disabled={!!form.phone && !isValidPhone(form.phone)}
            onClick={create}
          >
            Create
          </Button>
        </Card>
      )}
      {loading ? <LoadingSpinner /> : (
        <div className="space-y-2">
          {users.map((u) => (
            <ListItem
              key={u.id}
              title={u.name}
              subtitle={u.email}
              right={
                <div className="flex items-center gap-2">
                  <Badge className="capitalize">{u.role}</Badge>
                  {!u.is_active && <Badge>Inactive</Badge>}
                  {u.id !== user?.id && (
                    <button
                      type="button"
                      onClick={() => toggleActive(u)}
                      className="text-xs text-slate-500 underline"
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </div>
              }
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
