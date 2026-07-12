"use client";

import { useEffect, useState } from "react";
import { buildersApi, type BuilderSubmission } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, EmptyState, LoadingSpinner } from "@/components/ui";

const STATUSES = ["acknowledged", "interested", "rejected", "site_visit", "converted"];

export default function BuilderPortalPage() {
  const [submissions, setSubmissions] = useState<BuilderSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    buildersApi.submissions().then(setSubmissions).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await buildersApi.updateSubmission(id, status);
    load();
  };

  return (
    <AppShell>
      <h1 className="mb-2 text-2xl font-bold">Assigned Leads</h1>
      <p className="mb-6 text-sm text-slate-600">Review and update lead status</p>

      {loading ? <LoadingSpinner /> : submissions.length === 0 ? (
        <EmptyState message="No leads assigned yet" />
      ) : (
        <div className="space-y-4">
          {submissions.map((s) => {
            const snap = s.snapshot || {};
            return (
              <Card key={s.id}>
                <div className="mb-2 flex items-center justify-between">
                  <Badge className="capitalize">{s.status}</Badge>
                  <span className="text-xs text-slate-500">
                    {s.email_sent_at ? new Date(s.email_sent_at).toLocaleDateString() : new Date(s.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="mb-1 text-lg font-semibold">{String(snap.contact_name || "Lead")}</div>
                <div className="mb-3 text-sm text-slate-600">
                  {String(snap.contact_phone || "")}
                  {snap.project_name ? ` · ${String(snap.project_name)}` : ""}
                </div>
                {snap.requirement_summary ? (
                  <p className="mb-3 text-sm text-slate-700">{String(snap.requirement_summary)}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((status) => (
                    <Button key={status} size="sm" variant={s.status === status ? "default" : "outline"} onClick={() => updateStatus(s.id, status)}>
                      {status.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
