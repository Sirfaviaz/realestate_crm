"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Calendar, Flame, Plus, Sparkles } from "lucide-react";
import { dashboardApi, type DashboardContact, type DashboardMatch } from "@/lib/api";
import { roleLabel } from "@/lib/contact-roles";
import { formatPrice } from "@/lib/utils";
import { formatVisitTime, whatsappLink } from "@/lib/whatsapp";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, EmptyState, LoadingSpinner } from "@/components/ui";

export default function HomePage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof dashboardApi.get>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.get().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppShell>
        <LoadingSpinner />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <EmptyState message="Could not load dashboard" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Today</h1>
      <p className="mb-6 text-slate-600">Follow-ups, site visits, and hot leads at a glance.</p>

      <Link href="/leads" className="mb-6 block">
        <Card className="flex items-center gap-4 bg-emerald-600 py-5 text-white hover:bg-emerald-700">
          <Plus className="h-9 w-9 shrink-0" />
          <div>
            <div className="text-lg font-semibold">Create Lead</div>
            <div className="text-sm opacity-90">Capture requirements — buyer, seller, renter, landlord</div>
          </div>
        </Card>
      </Link>

      <Section
        title="Matches to inform"
        icon={<Sparkles className="h-4 w-4 text-violet-500" />}
        badge={data.matches_to_inform?.length ?? 0}
        badgeClass="bg-violet-100 text-violet-700"
        empty="No new matches to share"
      >
        {(data.matches_to_inform ?? []).map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
      </Section>

      <Section
        title="Overdue"
        icon={<AlertCircle className="h-4 w-4 text-red-500" />}
        badge={data.overdue.length}
        badgeClass="bg-red-100 text-red-700"
        empty="No overdue follow-ups"
      >
        {data.overdue.map((c) => (
          <ContactCard key={c.id} contact={c} variant="overdue" />
        ))}
      </Section>

      <Section
        title="Follow-ups due"
        icon={<Calendar className="h-4 w-4 text-amber-500" />}
        badge={data.follow_ups_due.length}
        badgeClass="bg-amber-100 text-amber-700"
        empty="Nothing due in the next 24 hours"
      >
        {data.follow_ups_due.map((c) => (
          <ContactCard key={c.id} contact={c} />
        ))}
      </Section>

      <Section
        title="Site visits today"
        icon={<Calendar className="h-4 w-4 text-blue-500" />}
        badge={data.site_visits_today.length}
        badgeClass="bg-blue-100 text-blue-700"
        empty="No site visits scheduled today"
      >
        {data.site_visits_today.map((c) => (
          <ContactCard key={c.id} contact={c} showVisit />
        ))}
      </Section>

      <Section
        title="Hot leads"
        icon={<Flame className="h-4 w-4 text-orange-500" />}
        badge={data.hot_leads.length}
        badgeClass="bg-orange-100 text-orange-700"
        empty="No hot leads right now"
      >
        {data.hot_leads.map((c) => (
          <ContactCard key={c.id} contact={c} />
        ))}
      </Section>

      <h2 className="mb-3 font-semibold text-slate-900">Pipeline</h2>
      <div className="grid grid-cols-2 gap-3">
        <Card><div className="text-2xl font-bold">{data.role_counts.buyer ?? 0}</div><div className="text-sm text-slate-500">Buyers</div></Card>
        <Card><div className="text-2xl font-bold">{data.role_counts.seller ?? 0}</div><div className="text-sm text-slate-500">Sellers</div></Card>
        <Card><div className="text-2xl font-bold">{data.role_counts.renter ?? 0}</div><div className="text-sm text-slate-500">Renters</div></Card>
        <Card><div className="text-2xl font-bold">{data.role_counts.landlord ?? 0}</div><div className="text-sm text-slate-500">Landlords</div></Card>
      </div>
    </AppShell>
  );
}

function Section({
  title,
  icon,
  badge,
  badgeClass,
  empty,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge: number;
  badgeClass: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  const hasItems = Array.isArray(items) ? items.length > 0 : !!items;
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {badge > 0 && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>{badge}</span>}
      </div>
      {hasItems ? <div className="space-y-2">{children}</div> : <EmptyState message={empty} />}
    </div>
  );
}

function ContactCard({
  contact,
  variant,
  showVisit,
}: {
  contact: DashboardContact;
  variant?: "overdue";
  showVisit?: boolean;
}) {
  const role = contact.roles[0];
  const waCtx = showVisit && contact.site_visit_at
    ? {
        type: "site_visit" as const,
        name: contact.name,
        time: formatVisitTime(contact.site_visit_at),
        location: contact.site_visit_location || "TBD",
      }
    : { type: "follow_up" as const, name: contact.name, role };

  return (
    <Card className={variant === "overdue" ? "border-red-200 bg-red-50" : ""}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{contact.name}</div>
          <div className="text-sm text-slate-500">{contact.phone}</div>
          {showVisit && contact.site_visit_at && (
            <div className="mt-1 text-sm text-blue-700">
              {formatVisitTime(contact.site_visit_at)}
              {contact.site_visit_location ? ` · ${contact.site_visit_location}` : ""}
            </div>
          )}
          <div className="mt-1 flex gap-1">
            {contact.roles.map((r) => (
              <Badge key={r}>{roleLabel(r)}</Badge>
            ))}
            {contact.lead_score && <Badge className="capitalize">{contact.lead_score}</Badge>}
          </div>
        </div>
        <a
          href={whatsappLink(contact.whatsapp || contact.phone, waCtx)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white"
        >
          WhatsApp
        </a>
      </div>
    </Card>
  );
}

function MatchCard({ match }: { match: DashboardMatch }) {
  return (
    <Link href={`/leads/${match.requirement_id}`}>
      <Card className="border-violet-200 bg-violet-50/50 hover:border-violet-300">
        <div className="font-semibold">{match.contact_name}</div>
        <div className="text-sm text-slate-600">{match.title}</div>
        <div className="text-sm">{match.location}</div>
        {match.price != null && (
          <div className="text-sm font-medium">{formatPrice(match.price, match.requirement_role === "renter" ? "rental" : "sales")}</div>
        )}
        <div className="mt-1 flex gap-1">
          {match.requirement_role && <Badge>{roleLabel(match.requirement_role)}</Badge>}
          {match.matched_role && <Badge>{roleLabel(match.matched_role)}</Badge>}
          {match.bhk && <Badge>{match.bhk}</Badge>}
        </div>
      </Card>
    </Link>
  );
}
