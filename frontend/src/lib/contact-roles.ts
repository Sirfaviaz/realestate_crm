export type ContactRoleKey = "buyer" | "seller" | "renter" | "landlord";
export type StreamType = "sales" | "rental";

export type ContactTypeConfig = {
  role: ContactRoleKey;
  stream: StreamType;
  label: string;
  shortLabel: string;
  description: string;
};

export const CONTACT_TYPES: ContactTypeConfig[] = [
  { role: "buyer", stream: "sales", label: "Buyer", shortLabel: "Buy", description: "Looking to purchase" },
  { role: "seller", stream: "sales", label: "Seller", shortLabel: "Sell", description: "Wants to sell property" },
  { role: "renter", stream: "rental", label: "Renter", shortLabel: "Rent", description: "Looking for a rental" },
  { role: "landlord", stream: "rental", label: "Landlord", shortLabel: "Let", description: "Wants to rent out" },
];

export const ROLE_LABELS: Record<string, string> = {
  buyer: "Buyer",
  seller: "Seller",
  renter: "Renter",
  landlord: "Landlord",
  lessee: "Renter",
  lessor: "Landlord",
};

export const URGENCY_OPTIONS = [
  { value: "urgent", label: "Urgent (0–30 days)" },
  { value: "soon", label: "Soon (1–3 mo)" },
  { value: "flexible", label: "Flexible (3–6 mo)" },
  { value: "browsing", label: "Browsing" },
];

export const TENANT_TYPES = [
  { value: "bachelor", label: "Bachelor" },
  { value: "family", label: "Family" },
  { value: "couple", label: "Couple" },
  { value: "company", label: "Company" },
];

export const RADIUS_OPTIONS = [
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
  { value: 0, label: "Whole city" },
];

export const PROPERTY_TYPES = [
  { value: "flat", label: "Flat" },
  { value: "house", label: "House" },
  { value: "villa", label: "Villa" },
  { value: "plot", label: "Plot" },
  { value: "commercial", label: "Commercial" },
  { value: "pg", label: "PG" },
];

export const LEAD_SCORE_OPTIONS = [
  { value: "hot", label: "Hot" },
  { value: "warm", label: "Warm" },
  { value: "cold", label: "Cold" },
];

export function getContactType(role: ContactRoleKey): ContactTypeConfig {
  return CONTACT_TYPES.find((t) => t.role === role)!;
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}

export function isAdmin(role: string | undefined): boolean {
  return role === "admin";
}

export function canManageInventory(_role: string | undefined): boolean {
  return true;
}

export function canManageBuilders(role: string | undefined): boolean {
  return role === "admin";
}
