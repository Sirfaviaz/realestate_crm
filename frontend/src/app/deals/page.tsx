"use client";

import { useEffect, useState } from "react";
import { contactsApi, dealsApi, type Deal, type Contact } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { Button, Card, LoadingSpinner } from "@/components/ui";

const STAGES = ["new", "contacted", "site_visit", "negotiation", "closed", "lost"];

export default function DealsPage() {
  const [stream, setStream] = useState<"sales" | "rental">("sales");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [d, allContacts] = await Promise.all([dealsApi.list(stream), contactsApi.list()]);
      setDeals(d);
      const map: Record<string, Contact> = {};
      for (const c of allContacts) map[c.id] = c;
      setContacts(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [stream]);

  const moveStage = async (deal: Deal, stage: string) => {
    await dealsApi.update(deal.id, { ...deal, stage });
    load();
  };

  const grouped = STAGES.reduce(
    (acc, stage) => {
      acc[stage] = deals.filter((d) => d.stage === stage);
      return acc;
    },
    {} as Record<string, Deal[]>
  );

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl font-bold">Pipeline</h1>
      <div className="mb-4 flex gap-2">
        {(["sales", "rental"] as const).map((s) => (
          <Button key={s} variant={stream === s ? "default" : "outline"} onClick={() => setStream(s)} className="capitalize">
            {s}
          </Button>
        ))}
      </div>
      {loading ? <LoadingSpinner /> : (
        <div className="space-y-4">
          {STAGES.map((stage) =>
            grouped[stage].length > 0 ? (
              <div key={stage}>
                <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">{stage.replace("_", " ")}</h2>
                <div className="space-y-2">
                  {grouped[stage].map((deal) => (
                    <Card key={deal.id}>
                      <div className="font-medium">{contacts[deal.contact_id]?.name || "Contact"}</div>
                      <div className="text-sm text-slate-500">{contacts[deal.contact_id]?.phone}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {STAGES.filter((s) => s !== deal.stage).slice(0, 3).map((s) => (
                          <button key={s} type="button" onClick={() => moveStage(deal, s)} className="rounded-lg bg-slate-100 px-2 py-1 text-xs capitalize">
                            → {s.replace("_", " ")}
                          </button>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : null
          )}
          {deals.length === 0 && <p className="text-center text-slate-500">No deals in this stream yet</p>}
        </div>
      )}
    </AppShell>
  );
}
