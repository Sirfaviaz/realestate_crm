export type WhatsAppContext =
  | { type: "follow_up"; name: string; role?: string }
  | { type: "site_visit"; name: string; time: string; location: string }
  | { type: "listing"; title: string; location?: string }
  | {
      type: "match_found";
      name: string;
      title: string;
      location?: string;
      bhk?: string;
      propertyType?: string;
      price?: string;
    }
  | {
      type: "property_for_renter";
      name: string;
      location?: string;
      bhk?: string;
      propertyType?: string;
      price?: string;
      availableFrom?: string;
    }
  | {
      type: "tenant_for_landlord";
      name: string;
      tenantType?: string;
      occupants?: number;
      profession?: string;
      workplace?: string;
      budget?: string;
      moveIn?: string;
    }
  | { type: "custom"; message: string };

export function whatsappMessage(ctx: WhatsAppContext): string {
  switch (ctx.type) {
    case "follow_up":
      return `Hi ${ctx.name}, following up on your property ${ctx.role === "seller" || ctx.role === "landlord" ? "listing" : "search"}. Do you have a few minutes to chat?`;
    case "site_visit":
      return `Hi ${ctx.name}, reminder: site visit today at ${ctx.time} — ${ctx.location}. See you there!`;
    case "listing":
      return `Hi, I'm interested in ${ctx.title}${ctx.location ? ` in ${ctx.location}` : ""}. Could you share more details?`;
    case "match_found": {
      const parts = [
        ctx.bhk,
        ctx.propertyType,
        ctx.title,
        ctx.location ? `in ${ctx.location}` : null,
        ctx.price ? `at ${ctx.price}` : null,
      ].filter(Boolean);
      return `Hi ${ctx.name}, we found a property that matches your search: ${parts.join(" ")}. Are you interested?`;
    }
    case "property_for_renter": {
      const parts = [
        ctx.bhk,
        ctx.propertyType || "property",
        ctx.location ? `in ${ctx.location}` : null,
        ctx.price ? `at ${ctx.price}` : null,
      ].filter(Boolean);
      const lines = [
        `Hi ${ctx.name}, we have a ${parts.join(" ")} that may suit you.`,
      ];
      if (ctx.availableFrom) lines.push(`Available from: ${ctx.availableFrom}`);
      lines.push("Would you like more details or a visit?");
      return lines.join("\n");
    }
    case "tenant_for_landlord": {
      const lines = [`Hi, I have a prospective tenant for your property:`];
      lines.push(`Name: ${ctx.name}`);
      if (ctx.tenantType) lines.push(`Type: ${ctx.tenantType}`);
      if (ctx.occupants) lines.push(`Occupants: ${ctx.occupants}`);
      if (ctx.profession) lines.push(`Profession: ${ctx.profession}`);
      if (ctx.workplace) lines.push(`Works at/near: ${ctx.workplace}`);
      if (ctx.budget) lines.push(`Budget: ${ctx.budget}`);
      if (ctx.moveIn) lines.push(`Move-in: ${ctx.moveIn}`);
      lines.push("Would you consider this tenant?");
      return lines.join("\n");
    }
    case "custom":
      return ctx.message;
  }
}

export function whatsappLink(phone: string, ctx?: WhatsAppContext): string {
  const digits = phone.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  if (!ctx) return base;
  return `${base}?text=${encodeURIComponent(whatsappMessage(ctx))}`;
}

export function formatVisitTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function tenantTypeLabel(value: string | null | undefined): string {
  const map: Record<string, string> = {
    bachelor: "Bachelor",
    family: "Family",
    couple: "Couple",
    company: "Company",
  };
  return value ? map[value] || value : "";
}
