"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Home, Image, LogOut, PlusCircle, Upload, UserCircle, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/contact-roles";
import { whatsappLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const admin = isAdmin(user?.role);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-emerald-600">Real Estate CRM</div>
            <div className="text-sm text-slate-600">{user?.name}</div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-lg justify-around px-1 py-2">
          <NavLink href="/" icon={Home} label="Home" active={pathname === "/"} />
          <NavLink href="/leads" icon={PlusCircle} label="Leads" active={pathname.startsWith("/leads") || pathname.startsWith("/call")} />
          <NavLink href="/contacts" icon={UserCircle} label="People" active={pathname.startsWith("/contacts")} />
          <NavLink href="/listings" icon={Image} label="Listings" active={pathname.startsWith("/listings")} />
          <NavLink href="/admin/inventory" icon={Building2} label="Properties" active={pathname.startsWith("/admin/inventory")} />
          <NavLink href="/import" icon={Upload} label="Import" active={pathname.startsWith("/import")} />
          {admin && (
            <NavLink href="/admin/users" icon={Users} label="Users" active={pathname.startsWith("/admin/users")} />
          )}
        </div>
      </nav>
    </div>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-[52px] flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium",
        active ? "text-emerald-600" : "text-slate-500"
      )}
    >
      <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
      {label}
    </Link>
  );
}

export function QuickActionsFooter({
  phone,
  whatsapp,
  whatsappMessage,
  onNote,
  onFollowUp,
  onSendBuilder,
}: {
  phone?: string;
  whatsapp?: string;
  whatsappMessage?: string;
  onNote?: () => void;
  onFollowUp?: () => void;
  onSendBuilder?: () => void;
}) {
  const waPhone = whatsapp || phone;
  return (
    <div className="fixed bottom-16 left-0 right-0 z-10 border-t border-slate-200 bg-white px-4 py-2">
      <div className="mx-auto flex max-w-lg gap-2 overflow-x-auto">
        {phone && (
          <a href={`tel:${phone}`} className="flex min-h-11 shrink-0 items-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white">
            Call
          </a>
        )}
        {waPhone && (
          <a
            href={whatsappLink(waPhone, whatsappMessage ? { type: "custom", message: whatsappMessage } : undefined)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 shrink-0 items-center rounded-xl bg-green-600 px-4 text-sm font-medium text-white"
          >
            WhatsApp
          </a>
        )}
        {onNote && (
          <button type="button" onClick={onNote} className="min-h-11 shrink-0 rounded-xl border-2 border-slate-200 px-4 text-sm font-medium">
            Note
          </button>
        )}
        {onFollowUp && (
          <button type="button" onClick={onFollowUp} className="min-h-11 shrink-0 rounded-xl border-2 border-slate-200 px-4 text-sm font-medium">
            Follow-up
          </button>
        )}
        {onSendBuilder && (
          <button type="button" onClick={onSendBuilder} className="min-h-11 shrink-0 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white">
            To Builder
          </button>
        )}
      </div>
    </div>
  );
}
