const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type User = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type Location = {
  id: string;
  area: string;
  city: string;
  state?: string | null;
  pin_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type Project = {
  id: string;
  location_id: string;
  name: string;
  builder_name?: string | null;
  rera_id?: string | null;
  possession_status?: string | null;
  possession_date?: string | null;
  amenities?: string[] | null;
  brochure_url?: string | null;
  description?: string | null;
  extra_fields?: Record<string, unknown> | null;
  is_draft?: boolean;
};

export type UnitOption = {
  id: string;
  project_id: string;
  configuration: string;
  tower?: string | null;
  availability_count?: number | null;
  stream_type: string;
};

export type UnitSpec = {
  id: string;
  option_id: string;
  carpet_sqft?: number | null;
  built_up_sqft?: number | null;
  super_built_up_sqft?: number | null;
  sale_price?: number | null;
  rent_price?: number | null;
  floor?: string | null;
  facing?: string | null;
  parking?: string | null;
  furnishing?: string | null;
  status: string;
  stream_type: string;
  unit_number?: string | null;
  notes?: string | null;
};

export type Contact = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  whatsapp?: string | null;
  roles: string[];
  stream_type: string;
  budget_min?: number | null;
  budget_max?: number | null;
  rent_budget?: number | null;
  preferred_locations?: string[] | null;
  preferred_bhk?: string | null;
  property_location?: string | null;
  asking_price?: number | null;
  sqft?: number | null;
  timeline_date?: string | null;
  urgency?: string | null;
  lead_score?: string | null;
  follow_up_at?: string | null;
  site_visit_at?: string | null;
  site_visit_location?: string | null;
  notes?: string | null;
  tenant_type?: string | null;
  occupant_count?: number | null;
  profession?: string | null;
  workplace_text?: string | null;
  workplace_lat?: number | null;
  workplace_lng?: number | null;
};

export type LocationAnchor = {
  name: string;
  lat: number;
  lng: number;
  radius_km?: number | null;
};

export type AvailableProperty = {
  source: string;
  listing_id?: string | null;
  spec_id?: string | null;
  title?: string | null;
  location?: string | null;
  bhk?: string | null;
  price?: number | null;
  property_type?: string | null;
  stream_type?: string | null;
  cover_url?: string | null;
  distance_km?: number | null;
  bucket: string;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
};

export type AvailableNowResponse = {
  within_radius: AvailableProperty[];
  within_10km: AvailableProperty[];
  in_city: AvailableProperty[];
  search_radius_km: number;
  anchors?: LocationAnchor[];
};

export type Deal = {
  id: string;
  stream_type: string;
  stage: string;
  contact_id: string;
  spec_id?: string | null;
  assigned_user_id?: string | null;
  requirement_summary?: string | null;
  follow_up_at?: string | null;
};

export type DashboardData = {
  overdue: DashboardContact[];
  follow_ups_due: DashboardContact[];
  site_visits_today: DashboardContact[];
  hot_leads: DashboardContact[];
  matches_to_inform: DashboardMatch[];
  role_counts: Record<string, number>;
};

export type DashboardMatch = {
  id: string;
  requirement_id: string;
  status: string;
  match_score?: number | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
  requirement_role?: string | null;
  matched_role?: string | null;
  matched_name?: string | null;
  title?: string | null;
  location?: string | null;
  bhk?: string | null;
  price?: number | null;
  property_type?: string | null;
};

export type LeadRequirement = {
  id: string;
  contact_id: string;
  role: string;
  stream_type: string;
  property_types?: string[] | null;
  preferred_locations?: string[] | null;
  location_anchors?: LocationAnchor[] | null;
  city?: string | null;
  search_radius_km?: number | null;
  bhk?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  rent_budget?: number | null;
  move_in_date?: string | null;
  urgency?: string | null;
  lead_score?: string | null;
  status: string;
  notes?: string | null;
  preferred_tenant_types?: string[] | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
  tenant_type?: string | null;
  occupant_count?: number | null;
  profession?: string | null;
  workplace_text?: string | null;
  match_count?: number;
  new_match_count?: number;
  created_at: string;
};

export type RequirementMatch = {
  id: string;
  requirement_id: string;
  listing_id?: string | null;
  spec_id?: string | null;
  matched_requirement_id?: string | null;
  match_score?: number | null;
  status: string;
  informed_at?: string | null;
  informed_via?: string | null;
  follow_up_at?: string | null;
  notes?: string | null;
  title?: string | null;
  location?: string | null;
  bhk?: string | null;
  price?: number | null;
  property_type?: string | null;
  cover_url?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
  requirement_role?: string | null;
  matched_role?: string | null;
  created_at: string;
};

export type DashboardContact = {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  roles: string[];
  lead_score?: string | null;
  urgency?: string | null;
  follow_up_at?: string | null;
  site_visit_at?: string | null;
  site_visit_location?: string | null;
};

export type Listing = {
  id: string;
  contact_id?: string | null;
  spec_id?: string | null;
  project_id?: string | null;
  stream_type: string;
  title: string;
  location_text?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  bhk?: string | null;
  sqft?: number | null;
  price?: number | null;
  status: string;
  property_type?: string | null;
  builder_name?: string | null;
  project_name?: string | null;
  land_area_cent?: number | null;
  launching_time?: string | null;
  completion_time?: string | null;
  total_floors?: number | null;
  parking_details?: string | null;
  available_floors?: string | null;
  amenities?: string[] | null;
  base_price?: number | null;
  car_parking_price?: number | null;
  gst_percent?: number | null;
  down_payment_percent?: number | null;
  utility_charge?: number | null;
  total_instalment?: number | null;
  total_amount?: number | null;
  price_as_of_date?: string | null;
  monthly_rent?: number | null;
  security_deposit?: number | null;
  description?: string | null;
  cover_url?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
  media?: ListingMedia[];
  created_at: string;
};

export type ListingMedia = {
  id: string;
  listing_id: string;
  file_path: string;
  media_type: string;
  sort_order: number;
  url?: string | null;
  created_at: string;
};

export type ImportPreview = {
  preview_id: string | null;
  valid_count: number;
  error_count: number;
  duplicate_count: number;
  valid: { row: number; data: Record<string, unknown>; existing_id?: string | null }[];
  errors: { row: number; errors: string[]; data: Record<string, unknown> }[];
  duplicates: { row: number; data: Record<string, unknown>; existing_id?: string | null }[];
};

export type Builder = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  project_ids: string[];
};

export type BuilderSubmission = {
  id: string;
  deal_id: string;
  builder_id: string;
  status: string;
  snapshot?: Record<string, unknown> | null;
  email_sent_at?: string | null;
  created_at: string;
};

export type SearchResult = {
  entity_type: string;
  id: string;
  title: string;
  subtitle?: string | null;
  meta?: Record<string, unknown> | null;
};

export type Activity = {
  id: string;
  deal_id?: string | null;
  contact_id?: string | null;
  activity_type: string;
  content: string;
  created_at: string;
};

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401 && typeof window !== "undefined") {
    const refresh = localStorage.getItem("refresh_token");
    if (refresh && !path.includes("/auth/refresh")) {
      try {
        const tokens = await api<TokenResponse>("/auth/refresh", {
          method: "POST",
          body: JSON.stringify({ refresh_token: refresh }),
        });
        localStorage.setItem("access_token", tokens.access_token);
        localStorage.setItem("refresh_token", tokens.refresh_token);
        return api<T>(path, options);
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail || res.statusText);
  }
  return res.json();
}

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_URL}${path.startsWith("/") ? path : `/listings/media/${path}`}`;
}

export const authApi = {
  login: (email: string, password: string) =>
    api<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => api<User>("/auth/me"),
  listUsers: () => api<User[]>("/auth/users"),
  createUser: (data: { email: string; password: string; name: string; phone?: string; role?: string }) =>
    api<User>("/auth/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: string, data: { is_active?: boolean; name?: string; phone?: string }) =>
    api<User>(`/auth/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

export const dashboardApi = {
  get: () => api<DashboardData>("/dashboard"),
};

export const inventoryApi = {
  locations: (q?: string) =>
    api<Location[]>(`/inventory/locations${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  nearbyLocations: (lat: number, lng: number, radiusKm = 5) =>
    api<Location[]>("/inventory/locations/nearby", {
      method: "POST",
      body: JSON.stringify({ latitude: lat, longitude: lng, radius_km: radiusKm }),
    }),
  createLocation: (data: Partial<Location>) =>
    api<Location>("/inventory/locations", { method: "POST", body: JSON.stringify(data) }),
  projects: (locationId?: string, q?: string) => {
    const params = new URLSearchParams();
    if (locationId) params.set("location_id", locationId);
    if (q) params.set("q", q);
    const qs = params.toString();
    return api<Project[]>(`/inventory/projects${qs ? `?${qs}` : ""}`);
  },
  getProject: (id: string) => api<Project & { location?: Location; options?: UnitOption[] }>(`/inventory/projects/${id}`),
  createProject: (data: Partial<Project>) =>
    api<Project>("/inventory/projects", { method: "POST", body: JSON.stringify(data) }),
  updateProject: (id: string, data: Partial<Project>) =>
    api<Project>(`/inventory/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  options: (projectId: string, streamType?: string, q?: string) => {
    const params = new URLSearchParams({ project_id: projectId });
    if (streamType) params.set("stream_type", streamType);
    if (q) params.set("q", q);
    return api<UnitOption[]>(`/inventory/options?${params}`);
  },
  createOption: (data: Partial<UnitOption>) =>
    api<UnitOption>("/inventory/options", { method: "POST", body: JSON.stringify(data) }),
  specs: (optionId: string, streamType?: string) => {
    const params = new URLSearchParams({ option_id: optionId });
    if (streamType) params.set("stream_type", streamType);
    return api<UnitSpec[]>(`/inventory/specs?${params}`);
  },
  getSpec: (id: string) =>
    api<UnitSpec & { option?: UnitOption; project?: Project; location?: Location }>(`/inventory/specs/${id}`),
  createSpec: (data: Partial<UnitSpec>) =>
    api<UnitSpec>("/inventory/specs", { method: "POST", body: JSON.stringify(data) }),
};

export const contactsApi = {
  list: (q?: string, streamType?: string, role?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (streamType) params.set("stream_type", streamType);
    if (role) params.set("role", role);
    const qs = params.toString();
    return api<Contact[]>(`/contacts${qs ? `?${qs}` : ""}`);
  },
  create: (data: Partial<Contact>) =>
    api<Contact>("/contacts", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Contact>) =>
    api<Contact>(`/contacts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  activities: (contactId: string) => api<Activity[]>(`/contacts/${contactId}/activities`),
  addActivity: (data: { contact_id?: string; deal_id?: string; activity_type?: string; content: string }) =>
    api<Activity>("/contacts/activities", { method: "POST", body: JSON.stringify(data) }),
};

export const dealsApi = {
  list: (streamType?: string, contactId?: string) => {
    const params = new URLSearchParams();
    if (streamType) params.set("stream_type", streamType);
    if (contactId) params.set("contact_id", contactId);
    const qs = params.toString();
    return api<Deal[]>(`/deals${qs ? `?${qs}` : ""}`);
  },
  create: (data: Partial<Deal>) =>
    api<Deal>("/deals", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Deal>) =>
    api<Deal>(`/deals/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  activities: (dealId: string) => api<Activity[]>(`/deals/${dealId}/activities`),
};

export const buildersApi = {
  list: () => api<Builder[]>("/builders"),
  create: (data: Partial<Builder> & { project_ids?: string[] }) =>
    api<Builder>("/builders", { method: "POST", body: JSON.stringify(data) }),
  sendLead: (dealId: string, builderId: string) =>
    api<BuilderSubmission>("/builders/submissions", {
      method: "POST",
      body: JSON.stringify({ deal_id: dealId, builder_id: builderId, consent_given: true }),
    }),
  submissions: () => api<BuilderSubmission[]>("/builders/submissions"),
  updateSubmission: (id: string, status: string, notes?: string) =>
    api<BuilderSubmission>(`/builders/submissions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, notes }),
    }),
};

export const searchApi = {
  global: (q: string, entity?: string, streamType?: string) => {
    const params = new URLSearchParams({ q });
    if (entity) params.set("entity", entity);
    if (streamType) params.set("stream_type", streamType);
    return api<SearchResult[]>(`/search?${params}`);
  },
};

export const listingsApi = {
  list: (params?: { stream_type?: string; contact_id?: string; q?: string; bhk?: string; min_price?: number; max_price?: number }) => {
    const qs = new URLSearchParams();
    if (params?.stream_type) qs.set("stream_type", params.stream_type);
    if (params?.contact_id) qs.set("contact_id", params.contact_id);
    if (params?.q) qs.set("q", params.q);
    if (params?.bhk) qs.set("bhk", params.bhk);
    if (params?.min_price != null) qs.set("min_price", String(params.min_price));
    if (params?.max_price != null) qs.set("max_price", String(params.max_price));
    const q = qs.toString();
    return api<Listing[]>(`/listings${q ? `?${q}` : ""}`);
  },
  get: (id: string) => api<Listing>(`/listings/${id}`),
  create: (data: Partial<Listing>) =>
    api<Listing>("/listings", { method: "POST", body: JSON.stringify(data) }),
  uploadMedia: (listingId: string, file: File, sortOrder = 0) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiUpload<ListingMedia>(`/listings/${listingId}/media?sort_order=${sortOrder}`, fd);
  },
};

export const importApi = {
  downloadTemplate: async (role: string) => {
    const token = getToken();
    const res = await fetch(`${API_URL}/import/contacts/${role}/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError(res.status, "Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${role}_template.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },
  preview: (role: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiUpload<ImportPreview>(`/import/contacts/${role}`, fd);
  },
  confirm: (previewId: string, updateDuplicates = false) =>
    api<{ created: number; updated: number; skipped: number; listings_created?: number }>("/import/contacts/confirm", {
      method: "POST",
      body: JSON.stringify({ preview_id: previewId, update_duplicates: updateDuplicates }),
    }),
};

export const requirementsApi = {
  list: (params?: { role?: string; status?: string; contact_id?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.role) qs.set("role", params.role);
    if (params?.status) qs.set("status", params.status);
    if (params?.contact_id) qs.set("contact_id", params.contact_id);
    if (params?.q) qs.set("q", params.q);
    const q = qs.toString();
    return api<LeadRequirement[]>(`/requirements${q ? `?${q}` : ""}`);
  },
  get: (id: string) => api<LeadRequirement>(`/requirements/${id}`),
  create: (data: Partial<LeadRequirement> & { contact_id: string; role: string; stream_type: string }) =>
    api<LeadRequirement>("/requirements", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<LeadRequirement>) =>
    api<LeadRequirement>(`/requirements/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  findMatches: (id: string) =>
    api<{ matches_found: number }>(`/requirements/${id}/find-matches`, { method: "POST" }),
  availableNow: (id: string) => api<AvailableNowResponse>(`/requirements/${id}/available-now`),
  matches: (id: string) => api<RequirementMatch[]>(`/requirements/${id}/matches`),
  informMatch: (requirementId: string, matchId: string, via: "call" | "whatsapp", notes?: string) =>
    api<RequirementMatch>(`/requirements/${requirementId}/matches/${matchId}/inform`, {
      method: "POST",
      body: JSON.stringify({ via, notes }),
    }),
  followUpMatch: (requirementId: string, matchId: string, follow_up_at: string, notes?: string) =>
    api<RequirementMatch>(`/requirements/${requirementId}/matches/${matchId}/follow-up`, {
      method: "POST",
      body: JSON.stringify({ follow_up_at, notes }),
    }),
  updateMatchStatus: (requirementId: string, matchId: string, status: string, notes?: string) =>
    api<RequirementMatch>(`/requirements/${requirementId}/matches/${matchId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, notes }),
    }),
  pendingMatches: () => api<RequirementMatch[]>("/matches/pending"),
};

export { ApiError };
