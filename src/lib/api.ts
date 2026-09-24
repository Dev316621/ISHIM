// ─── iShim typed API helpers (bound to API CONTRACT v1) ───
import type {
  AdminEnquiryPage,
  AdminStats,
  AdminUser,
  AdBanner,
  AgentAccount,
  AgentClientLead,
  AgentInsights,
  AgentOwnerLink,
  AgentStage,
  AppSettings,
  ContentData,
  ContentPageDto,
  DirectoryResponse,
  EnquiryKind,
  EnquiryStatus,
  HelpArticleKey,
  InsightsReport,
  ListingMode,
  MarkRentedResponse,
  MatchResult,
  MoveInPayload,
  MyEnquiry,
  OwnerMoveIn,
  Payment,
  Property,
  PropertyFilters,
  PropertyPage,
  PropertyReviews,
  PropertyRatings,
  RatingTarget,
  RecommendResponse,
  Role,
  SuggestResponse,
  TenanciesResponse,
  Tenancy,
  TenancyStatus,
  User,
} from "./types";
import { getDeviceId } from "./device";
import { getSessionToken, setSessionToken } from "./session";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getSessionToken();
  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      // Anonymous habit-analytics identity (ignored when signed in).
      "X-Device-Id": getDeviceId(),
      // Session token fallback for cookie-blocked contexts (preview iframes).
      ...(token ? { "X-Session-Token": token } : {}),
    },
    ...opts,
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // no body
  }
  if (!res.ok) {
    const message =
      (body as { error?: string } | null)?.error ??
      `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}

function qs(params: Record<string, string | number | boolean | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ─── Auth ───

export const authApi = {
  me: () => api<{ user: User | null; token?: string | null }>("/api/auth/me"),
  googleStatus: () => api<{ configured: boolean }>("/api/auth/google/status"),
  googlePending: () =>
    fetch("/api/auth/google/pending", {
      headers: { "X-Device-Id": getDeviceId() },
    }).then(async (res) => {
      if (res.status === 204) return { error: null as string | null, message: null as string | null };
      const body = (await res.json().catch(() => ({}))) as {
        error?: string | null;
        message?: string | null;
      };
      return {
        error: body.error ?? null,
        message: body.message ?? null,
      };
    }),
  logout: () =>
    api<{ ok?: boolean }>("/api/auth/logout", { method: "POST" }).then((res) => {
      setSessionToken(null);
      return res;
    }),
  impersonate: (userId: string) =>
    api<{ token: string; restoreToken?: string | null; user?: User }>(
      "/api/auth/impersonate",
      {
        method: "POST",
        body: JSON.stringify({ userId }),
      }
    ),
  restore: (token: string) =>
    api<{ user: User; token?: string }>("/api/auth/restore", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
};

// ─── AI assistant (grounded on live listings + pricing; public) ───

export const assistantApi = {
  ask: (question: string, history: { role: "user" | "assistant"; content: string }[] = []) =>
    api<{ answer: string }>("/api/assistant", {
      method: "POST",
      body: JSON.stringify({ question, history }),
    }),
};

// ─── No-account listing intake (quick list → agent does the rest) ───

export interface ListingLeadItem {
  id: string;
  name: string;
  phone: string;
  mode: "HOME" | "BUSINESS";
  block: string;
  rent: number | null;
  details: string;
  photos: string[];
  status: "NEW" | "CLAIMED" | "LISTED" | "DISCARDED";
  claimedById: string | null;
  claimedBy: { name: string; role: string } | null;
  propertyId: string | null;
  source: string;
  createdAt: string;
}

export const leadsApi = {
  /** Public quick-list form — no account, no session needed. */
  submitQuick: (payload: {
    name: string;
    phone: string;
    mode: "HOME" | "BUSINESS";
    block?: string;
    rent?: number | null;
    details?: string;
    photos?: string[];
  }) =>
    api<{ lead: { id: string; name: string } }>("/api/leads/listing", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  /** Agent/admin worklist: ?status=OPEN (default) | NEW | CLAIMED | LISTED | DISCARDED | ALL. */
  list: (status?: string, skip = 0) =>
    api<{ items: ListingLeadItem[]; total: number; hasMore: boolean }>(
      `/api/leads/listing${qs({ status, skip })}`
    ),
  /** claim | release | discard | markListed | reopen */
  act: (
    id: string,
    action: "claim" | "release" | "discard" | "markListed" | "reopen",
    propertyId?: string
  ) =>
    api<{ lead: ListingLeadItem }>(`/api/leads/listing/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action, propertyId }),
    }),
};

// ─── Area requests ("my area is not listed" → staff adds it) ────

export interface AreaRequestItem {
  id: string;
  name: string;
  nameKey: string;
  mode: "HOME" | "BUSINESS";
  note: string;
  requesterName: string;
  requesterPhone: string;
  leadId: string | null;
  source: string;
  status: "NEW" | "ADDED" | "DISCARDED";
  handledById: string | null;
  handledByName: string | null;
  blockName: string | null;
  createdAt: string;
}

export const areaApi = {
  /** Staff queue. ?status=NEW (default) | ADDED | DISCARDED | ALL */
  list: (status?: string) =>
    api<{ items: AreaRequestItem[]; total: number }>(`/api/area-requests${qs({ status })}`),
  /** add | discard | reopen — "add" appends the area to Settings and
   *  also returns fresh settings so the whole app updates instantly. */
  act: (id: string, action: "add" | "discard" | "reopen") =>
    api<{ request: AreaRequestItem; settings?: AppSettings }>(`/api/area-requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    }),
};

// ─── Areas & wards (staff: admin + agent) ───

export const areasApi = {
  /** Save the official ward list and/or their photos; returns fresh settings. */
  save: (payload: { blocks?: string[]; wardImages?: Record<string, string> }) =>
    api<AppSettings>("/api/areas", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};

// ─── Public ───

export const publicApi = {
  getSettings: () => api<AppSettings>("/api/settings"),
  getProperties: (filters: PropertyFilters = {}) =>
    api<PropertyPage>(
      `/api/properties${qs({
        mode: filters.mode,
        block: filters.block,
        near: filters.near ? 1 : undefined,
        houseType: filters.houseType,
        minRent: filters.minRent,
        maxRent: filters.maxRent,
        bedrooms: filters.bedrooms,
        q: filters.q,
        featured: filters.featured ? 1 : undefined,
        sort: filters.sort,
        skip: filters.skip,
        limit: filters.limit,
      })}`
    ),
  getProperty: (id: string) => api<Property>(`/api/properties/${id}`),
  contactProperty: (
    id: string,
    message?: string,
    method: "WHATSAPP" | "CALL" = "WHATSAPP",
    route?: "OWNER" | "AGENT"
  ) =>
    api<{
      waLink: string;
      telLink: string;
      method: "WHATSAPP" | "CALL";
      route: "OWNER" | "AGENT";
    }>(
      `/api/properties/${id}/contact`,
      {
        method: "POST",
        body: JSON.stringify({ message, method, route }),
      }
    ),
  /** Rating summaries: property + owner + agent (public). */
  getPropertyRatings: (id: string) =>
    api<PropertyRatings>(`/api/properties/${id}/ratings`),
  /** Agent enquiry / inspection visit booking (name + phone required). */
  createEnquiry: (
    id: string,
    payload: {
      kind: EnquiryKind;
      name: string;
      phone: string;
      message?: string;
      visitAt?: string;
      route?: "OWNER" | "AGENT";
    }
  ) =>
    api<{ enquiry: { id: string; kind: EnquiryKind; status: EnquiryStatus } }>(
      `/api/properties/${id}/enquiries`,
      { method: "POST", body: JSON.stringify(payload) }
    ),
  getAds: () => api<AdBanner[]>("/api/ads"),
  getBlockStats: (mode?: ListingMode) =>
    api<{ counts: Record<string, number>; total: number }>(
      `/api/properties/stats${qs({ mode })}`
    ),
  /** "For you" — habit-personalized ranking (empty profile until there is history). */
  getRecommended: (mode?: ListingMode) =>
    api<RecommendResponse>(`/api/insights/recommend${qs({ mode })}`),
  /** Public tenant feedback (owner ratings + remarks) for a home. */
  getPropertyReviews: (id: string) =>
    api<PropertyReviews>(`/api/properties/${id}/reviews`),
  /** "Know your Owners" — public directory of owner & agent profiles. */
  getDirectory: () => api<DirectoryResponse>("/api/directory"),
  /** Universal (Google-style) search — everything on iShim, both verticals. */
  searchSuggest: (q: string, scope?: "" | "HOME" | "BUSINESS") =>
    api<SuggestResponse>(
      `/api/search/suggest${qs({ q, scope: scope || undefined })}`
    ),
};

// ─── Habit analytics (fire-and-forget search tracking) ───────────

export const insightsApi = {
  trackSearch: (payload: {
    query?: string;
    block?: string;
    houseType?: string;
    minRent?: number;
    maxRent?: number;
  }) =>
    api<{ ok: boolean }>("/api/insights/track", {
      method: "POST",
      body: JSON.stringify(payload),
    }).catch(() => ({ ok: false })),
};

// ─── Client ───

export const clientApi = {
  getSaved: () => api<Property[]>("/api/saved"),
  toggleSaved: (propertyId: string) =>
    api<{ saved: boolean }>("/api/saved", {
      method: "POST",
      body: JSON.stringify({ propertyId }),
    }),

  // ─── Tenant stays: rate owner, remarks, staying/moved-out ───
  getTenancies: () => api<TenanciesResponse>("/api/tenancies"),
  createTenancy: (payload: {
    propertyId: string;
    status?: TenancyStatus;
    ownerRating?: number | null;
    remark?: string | null;
  }) =>
    api<Tenancy>("/api/tenancies", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTenancy: (
    id: string,
    payload: Partial<{
      status: TenancyStatus;
      ownerRating: number | null;
      remark: string | null;
    }>
  ) =>
    api<Tenancy>(`/api/tenancies/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteTenancy: (id: string) =>
    api<{ ok: boolean }>(`/api/tenancies/${id}`, { method: "DELETE" }),

  // ─── Rate the home or its agent (1 per user per target, upsert) ───
  rateProperty: (
    id: string,
    payload: { targetType: RatingTarget; rating: number; comment?: string }
  ) =>
    api<{
      rating: { id: string; rating: number; comment: string; updatedAt: string };
      summary: { avg: number | null; count: number };
    }>(`/api/properties/${id}/ratings`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// ─── Owner / Agent listings ───

export interface ListingPayload {
  title: string;
  description: string;
  block: string;
  mode: ListingMode; // HOME (residential) | BUSINESS (shops, offices…)
  houseType: string;
  rent: number;
  deposit: number;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  photos: string[];
  negotiable?: boolean;
  kitchen?: string; // SEPARATE | SAME_ROOM (optional, homes only)
  areaSqft?: number; // built-up size, optional
  widthFt?: number; // frontage width, optional
  ownerPhone?: string;
}

/** Cashfree UPI checkout — order creation / status polling. */
export const paymentsApi = {
  createOrder: (propertyId: string) =>
    api<{
      orderId: string;
      paymentSessionId: string;
      amount: number;
      mode: "sandbox" | "production";
      paid?: boolean;
    }>("/api/payments/cashfree/order", {
      method: "POST",
      body: JSON.stringify({ propertyId }),
    }),
  status: (orderId: string) =>
    api<{ status: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "MISSING"; amount?: number; property?: Property | null }>(
      `/api/payments/cashfree/status${qs({ orderId })}`
    ),
};

export const ownerApi = {
  getMyProperties: () => api<Property[]>("/api/my/properties"),
  createProperty: (payload: ListingPayload) =>
    api<{ property: Property }>("/api/properties", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateProperty: (id: string, payload: Partial<ListingPayload>) =>
    api<{ property: Property }>(`/api/properties/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  markRented: (id: string) =>
    api<MarkRentedResponse>(`/api/properties/${id}/mark-rented`, {
      method: "POST",
    }),
  payFee: (id: string) =>
    api<{ property: Property }>(`/api/properties/${id}/pay-fee`, {
      method: "POST",
    }),
  relist: (id: string) =>
    api<{ property: Property }>(`/api/properties/${id}/relist`, {
      method: "POST",
    }),
};

// ─── Enquiries inbox (owner / agent handler side) ───────────────────

export const enquiryApi = {
  getInbox: () => api<{ enquiries: MyEnquiry[] }>("/api/my/enquiries"),
  update: (
    id: string,
    payload: Partial<{ status: EnquiryStatus; visitAt: string | null }>
  ) =>
    api<{ enquiry: { id: string; status: EnquiryStatus; visitAt: string | null } }>(
      `/api/enquiries/${id}`,
      { method: "PATCH", body: JSON.stringify(payload) }
    ),
};

// ─── Successful move-ins (owner view; marked by admin / agents) ──────

export const moveInApi = {
  /** Owner dashboard: stays recorded across the owner's homes. */
  ownerList: () => api<OwnerMoveIn[]>("/api/owner/move-ins"),
  /** Admin / agent: record a tenant moving into a home. */
  mark: (payload: MoveInPayload) =>
    api<{
      tenancy: { id: string; status: string };
      tenant: { name: string; phone: string };
      property: { id: string; title: string };
    }>("/api/move-ins", { method: "POST", body: JSON.stringify(payload) }),
};

// ─── Agent CRM ───

export const agentApi = {
  getClients: () => api<AgentClientLead[]>("/api/agent/clients"),
  createClient: (payload: {
    name: string;
    phone: string;
    budgetMin?: number;
    budgetMax?: number;
    preferredBlock?: string;
    preferredType?: string;
    notes?: string;
  }) =>
    api<AgentClientLead>("/api/agent/clients", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateClient: (
    id: string,
    payload: Partial<{
      name: string;
      phone: string;
      budgetMin: number;
      budgetMax: number;
      preferredBlock: string;
      preferredType: string;
      stage: AgentStage;
      notes: string;
    }>
  ) =>
    api<AgentClientLead>(`/api/agent/clients/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  getOwners: () => api<AgentOwnerLink[]>("/api/agent/owners"),
  linkOwner: (phone: string) =>
    api<AgentOwnerLink>("/api/agent/owners", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),
  addOwnerNote: (agentOwnerId: string, text: string) =>
    api<{ note: { id: string; text: string; createdAt: string } }>(
      "/api/agent/owners/notes",
      { method: "POST", body: JSON.stringify({ agentOwnerId, text }) }
    ),
  match: (clientId: string) =>
    api<{
      client: AgentClientLead;
      matches: Array<MatchResult>;
    }>(`/api/agent/match${qs({ clientId })}`),
  getDemand: () => api<AgentInsights>("/api/insights/agent"),
  searchUsers: (q: string) =>
    api<{ users: AgentAccount[] }>(`/api/agent/users${qs({ q })}`),
};

// ─── Admin god-mode ───

export const adminApi = {
  getStats: (mode?: "HOME" | "BUSINESS") =>
    api<AdminStats>(`/api/admin/stats${qs({ mode })}`),
  getUsers: (q?: string) =>
    api<AdminUser[]>(`/api/admin/users${qs({ q })}`),
  /** Admin adds a staff member (AGENT/ADMIN) by their Google email. */
  addStaff: (payload: { name: string; phone: string; email: string; role: "AGENT" | "ADMIN" }) =>
    api<AdminUser>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  patchUser: (
    id: string,
    payload: Partial<{ role: Role; verified: boolean; banned: boolean; name: string }>
  ) =>
    api<AdminUser>(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  getProperties: (status?: string, mode?: "HOME" | "BUSINESS", skip = 0, limit?: number) =>
    api<PropertyPage>(`/api/admin/properties${qs({ status, mode, skip, limit })}`),
  patchProperty: (
    id: string,
    payload: Partial<{
      status: string;
      featured: boolean;
      feeWaived: boolean;
      rejectionReason: string;
      rent: number;
      block: string;
      title: string;
    }>
  ) =>
    api<Property>(`/api/admin/properties/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  getPayments: (mode?: "HOME" | "BUSINESS") =>
    api<Payment[]>(`/api/admin/payments${qs({ mode })}`),
  getEnquiries: (
    status?: string,
    kind?: string,
    mode?: "HOME" | "BUSINESS",
    q?: string,
    skip = 0,
    limit?: number
  ) =>
    api<AdminEnquiryPage>(
      `/api/admin/enquiries${qs({ status, kind, mode, q, skip, limit })}`
    ),
  patchSettings: (payload: Partial<AppSettings>) =>
    api<AppSettings>("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  /** Download the full Excel backup (ADMIN) — saves it to the device and returns row counts. */
  downloadBackup: async (): Promise<{
    listings: number;
    people: number;
    leads: number;
    enquiries: number;
    payments: number;
  }> => {
    const res = await fetch("/api/admin/export", {
      headers: {
        "X-Device-Id": getDeviceId(),
        "X-Session-Token": getSessionToken() ?? "",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      let message = "Could not build the backup file.";
      try {
        const data = (await res.json()) as { error?: string };
        if (data?.error) message = data.error;
      } catch {
        /* not JSON — keep default */
      }
      throw new ApiError(message, res.status);
    }
    let counts = { listings: 0, people: 0, leads: 0, enquiries: 0, payments: 0 };
    try {
      const raw = res.headers.get("X-Export-Counts");
      if (raw) counts = JSON.parse(decodeURIComponent(raw));
    } catch {
      /* decorative — ignore */
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ishim-backup-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return counts;
  },
  getAds: () => api<AdBanner[]>("/api/admin/ads"),
  createAd: (
    payload: Partial<Omit<AdBanner, "id">> & { title: string; image: string }
  ) =>
    api<{ ad: AdBanner }>("/api/admin/ads", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateAd: (id: string, payload: Partial<Omit<AdBanner, "id">>) =>
    api<{ ad: AdBanner }>(`/api/admin/ads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteAd: (id: string) =>
    api<{ ok: boolean }>(`/api/admin/ads/${id}`, { method: "DELETE" }),
  getInsights: () => api<InsightsReport>("/api/insights/report"),
  listContent: () =>
    api<{ pages: ContentPageDto[] }>("/api/admin/content"),
  upsertContent: (
    slug: HelpArticleKey,
    payload: { title: string; data: unknown; banner?: string }
  ) =>
    api<{ page: ContentPageDto }>(`/api/admin/content/${slug}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  resetContent: (slug: HelpArticleKey) =>
    api<{ ok: boolean }>(`/api/admin/content/${slug}`, { method: "DELETE" }),
  setContentVisible: (slug: HelpArticleKey, visible: boolean) =>
    api<{ page: { slug: HelpArticleKey; visible: boolean } }>(
      `/api/admin/content/${slug}`,
      { method: "PATCH", body: JSON.stringify({ visible }) }
    ),
};

// ─── Uploads ───

export async function uploadImage(file: File): Promise<string> {
  const token = getSessionToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", {
    method: "POST",
    body: form,
    headers: {
      "X-Device-Id": getDeviceId(),
      ...(token ? { "X-Session-Token": token } : {}),
    },
  });
  let body: { url?: string; error?: string } | null = null;
  try {
    body = await res.json();
  } catch {
    // no body
  }
  if (!res.ok || !body?.url) {
    throw new ApiError(body?.error ?? `Upload failed (${res.status})`, res.status);
  }
  return body.url;
}

// ─── CMS content (public read) ───

export const contentApi = {
  getOverrides: () =>
    api<{
      pages: Partial<Record<HelpArticleKey, ContentOverride>>;
      hidden?: HelpArticleKey[];
    }>("/api/content"),
};

export type ContentOverride = {
  title: string;
  banner: string;
  data: ContentData;
};
