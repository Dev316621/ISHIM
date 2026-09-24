// ─── iShim shared types (bound to API CONTRACT v1 in worklog.md) ───

export type Role = "CLIENT" | "OWNER" | "AGENT" | "ADMIN";

/** Site vertical: HOME = residential houses/apartments, BUSINESS = shops/offices/cafes… */
export type ListingMode = "HOME" | "BUSINESS";

export type PropertyStatus =
  | "PENDING"
  | "ACTIVE"
  | "RENTED"
  | "HIDDEN"
  | "REJECTED";

export type HouseType = "ASSAM_TYPE" | "RCC" | "KUTCHA" | "APARTMENT";

export type AgentStage =
  | "NEW_LEAD"
  | "SITE_VISIT"
  | "NEGOTIATING"
  | "CLOSED"
  | "LOST";

export interface User {
  id: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  name: string;
  role: Role;
  verified: boolean;
  banned: boolean;
  whatsappNumber?: string | null;
  idDoc?: string | null;
}

export type PricingPhase = "FREE" | "STANDARD";

export interface AppSettings {
  successFee: number; // FLAT move-in success fee during the free period (₹499) — same for homes & business
  freeModelStartAt: string; // ISO — start of the 36-month free period (admin-set)
  freeModelMonths: number; // length of the everything-free window (36)
  standardClientFee: number; // legacy per-contact fee (unused by the flat model)
  standardMoveInFee: number; // legacy post-trial owner move-in fee
  agentHelpFee: number; // POST-TRIAL agent-help charge — admin adds later (0 = to be announced)
  // Post-trial pricing (admin adds amounts + details later; 0/empty = "to be announced"):
  webListingCharge: number; // web listing charge after the free trial
  commissionFee: number; // commission after the free trial
  postTrialNote: string; // free-text details shown on the pricing page
  // BUSINESS vertical (shops, offices, cafes…) — same free window
  bizSuccessFee: number; // business move-in fee during the free period (kept flat with homes)
  bizStandardClientFee: number;
  bizStandardMoveInFee: number;
  bizAgentHelpFee: number;
  blocks: string[];
  amenities: string[];
  houseTypes: string[];
  /** Guest-UI translations (key → TK/MN text) managed in the admin Settings tab. */
  langOverrides: Record<string, { TK?: string; MN?: string }>;
  /** Ward/area photos (block name → image url) managed in the admin/agent Areas tab. */
  wardImages: Record<string, string>;
  // Computed by the server on GET/PATCH /api/settings:
  phase: PricingPhase; // FREE = inside the 36-month window, STANDARD = after
  freeUntil: string; // ISO — when the free period ends
  daysLeft: number; // days remaining in the free period (0 once STANDARD)
}

/**
 * The move-in success fee that applies right now for a vertical — launch fee
 * during the 36-month free period, standard fee after it. Homes and business
 * spaces have separately admin-set amounts. Mirrors the server helper.
 */
export function moveInFeeFor(
  s: AppSettings | null | undefined,
  mode: ListingMode = "HOME",
  now: Date = new Date(),
): number {
  if (!s) return mode === "BUSINESS" ? 1500 : 1000;
  let free: boolean;
  if (s.phase) {
    free = s.phase === "FREE";
  } else {
    const end = new Date(s.freeModelStartAt);
    if (Number.isFinite(end.getTime())) {
      end.setUTCMonth(end.getUTCMonth() + Math.max(1, s.freeModelMonths));
    }
    free = now < end;
  }
  if (mode === "BUSINESS") return free ? s.bizSuccessFee : s.bizStandardMoveInFee;
  return free ? s.successFee : s.standardMoveInFee;
}

/** After-free-period fee a client pays per contact/listing (per vertical). */
export function clientFeeFor(s: AppSettings | null | undefined, mode: ListingMode = "HOME"): number {
  if (!s) return mode === "BUSINESS" ? 499 : 249;
  return mode === "BUSINESS" ? s.bizStandardClientFee : s.standardClientFee;
}

/** Agent-help charge (per vertical, admin-set; 0 = free). */
export function agentHelpFeeFor(s: AppSettings | null | undefined, mode: ListingMode = "HOME"): number {
  if (!s) return 0;
  return mode === "BUSINESS" ? s.bizAgentHelpFee : s.agentHelpFee;
}

export interface PropertyOwnerInfo {
  verified: boolean;
  id?: string;
  name?: string;
  phone?: string;
}

export interface Property {
  id: string;
  title: string;
  description: string;
  block: string;
  mode?: ListingMode; // HOME (residential) | BUSINESS (shops, offices…)
  houseType: string;
  rent: number;
  deposit: number;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  photos: string[];
  featured?: boolean;
  negotiable?: boolean;
  whatsappClicks?: number;
  calls?: number;
  views?: number;
  contactRoute?: string;
  status?: PropertyStatus;
  rejectionReason?: string | null;
  kitchen?: string | null; // SEPARATE | SAME_ROOM
  areaSqft?: number | null;
  widthFt?: number | null;
  feePaid?: boolean;
  feeWaived?: boolean;
  feeAmount?: number | null;
  rentedAt?: string | null;
  listedByAgentId?: string | null;
  ownerId?: string;
  createdAt: string;
  updatedAt?: string;
  owner?: PropertyOwnerInfo;
}

export interface PropertyFilters {
  mode?: ListingMode;
  block?: string;
  /** Proximity: include the 3 nearest wards around `block`. */
  near?: boolean | 1;
  houseType?: string;
  minRent?: number;
  maxRent?: number;
  bedrooms?: number;
  q?: string;
  featured?: boolean;
  sort?: "newest" | "featured" | "price_asc" | "price_desc";
  /** Offset pagination — first page when omitted. */
  skip?: number;
  /** Page size (server clamps 1..60, default 24). */
  limit?: number;
}

/** Paginated listing response — one page plus the total needed for "Load more". */
export interface PropertyPage {
  items: Property[];
  /** Total ACTIVE listings matching the filters (server-side count). */
  total: number;
  /** True when more pages remain after this one. */
  hasMore: boolean;
}

/** Search scope: "" = Everything on iShim (both verticals), or one vertical. */
export type SearchScope = "" | "HOME" | "BUSINESS";

/** Search UI state (empty string = unset, undefined = unset numeric) */
export interface SearchFiltersView {
  block: string;
  houseType: string;
  minRent?: number;
  maxRent?: number;
  bedrooms?: number;
  q: string;
  scope: SearchScope;
  /** Proximity mode: include the nearest wards around `block`. */
  near?: boolean;
}

/** /api/agent/match returns flat property cards with match metadata added */
export interface MatchResult extends Property {
  score?: number;
  reason: string;
}

export interface AgentClientLead {
  id: string;
  agentId: string;
  name: string;
  phone: string;
  budgetMin: number;
  budgetMax: number;
  preferredBlock: string;
  preferredType: string;
  stage: AgentStage;
  notes: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OwnerNote {
  id: string;
  agentOwnerId: string;
  text: string;
  createdAt: string;
}

export interface AgentOwnerLink {
  link: { id: string; status: string; createdAt?: string };
  owner: User;
  properties: Property[];
  notes: OwnerNote[];
}

/** /api/insights/recommend — "For you" payload */
export interface RecommendResponse {
  properties: Property[];
  profile: {
    events: number;
    blocks: string[];
    houseTypes: string[];
    maxRent?: number;
    budget?: string;
  } | null;
  hint?: string;
}

export interface DemandSlice {
  label: string;
  count: number;
}

/** /api/insights/report — admin renter-habit & demand report (last 30 days) */
export interface InsightsReport {
  windowDays: number;
  totals: {
    events: number;
    searches: number;
    views: number;
    saves: number;
    contacts: number;
    uniqueSearchers: number;
  };
  topBlocks: DemandSlice[];
  topTypes: DemandSlice[];
  topQueries: DemandSlice[];
  priceBands: DemandSlice[];
  daily: { date: string; count: number }[];
  topSearchers: Array<{
    label: string;
    role: string;
    events: number;
    topBlock: string;
    topType: string;
    maxRent: number;
    lastActive: string;
  }>;
  demandVsSupply: Array<{ block: string; demand: number; supply: number }>;
}

/** /api/insights/agent — anonymized demand snapshot + supply gaps */
export interface AgentInsights {
  windowDays: number;
  demand: {
    events: number;
    searches: number;
    contacts: number;
    topBlocks: DemandSlice[];
    topTypes: DemandSlice[];
    priceBands: DemandSlice[];
  };
  myActiveListings: number;
  gaps: Array<{ block: string; demand: number; mine: number }>;
}

export interface AdminStats {
  users: {
    total: number;
    byRole: { CLIENT: number; OWNER: number; AGENT: number; ADMIN: number };
  };
  properties: {
    total: number;
    byStatus: {
      PENDING: number;
      ACTIVE: number;
      RENTED: number;
      HIDDEN: number;
      REJECTED: number;
    };
  };
  revenueTotal: number;
  paymentsCount: number;
  whatsappClicks: number;
  feeDueCount: number;
}

export interface AdminUser extends User {
  propertiesCount?: number;
  contactsCount?: number;
}

export interface Payment {
  id: string;
  propertyId: string;
  payerId: string;
  amount: number;
  kind: string;
  method: string;
  createdAt: string;
  property?: { id: string; title: string; mode?: ListingMode } | null;
  payer?: { id: string; name: string; phone: string } | null;
}

export interface MarkRentedResponse {
  fee: number;
  upiId: string;
  feePaid: boolean;
  feeWaived: boolean;
}

export interface RecentContact {
  propertyId: string;
  title: string;
  block: string;
  rent: number;
  at: string; // ISO date
}

// ─── Tenant stays: occupancy status + owner feedback ─────────────

export type TenancyStatus = "STAYING" | "MOVED_OUT";

/** Compact property reference used inside tenancy cards / pickers. */
export interface TenancyPropertyRef {
  id: string;
  title: string;
  block: string;
  rent: number;
  photos: string[];
  status?: PropertyStatus;
  contactedAt?: string; // only on "contacted" picker candidates
}

/** One of the user's stays (client profile "My stays"). */
export interface Tenancy {
  id: string;
  status: TenancyStatus;
  ownerRating: number | null; // 1..5 stars for the owner
  remark: string | null; // note for the next tenants
  updatedAt: string;
  property: TenancyPropertyRef;
}

/** GET /api/tenancies — stays + homes contacted but not yet marked. */
export interface TenanciesResponse {
  tenancies: Tenancy[];
  contacted: TenancyPropertyRef[];
}

/** GET /api/owner/move-ins — one successful move-in on the owner's homes. */
export interface OwnerMoveIn {
  id: string;
  status: TenancyStatus; // STAYING | MOVED_OUT
  ownerRating: number | null;
  remark: string | null;
  createdAt: string; // move-in date
  updatedAt: string;
  tenant: { name: string; phone: string };
  property: {
    id: string;
    title: string;
    block: string;
    photos: string[];
    rent: number;
    status?: PropertyStatus;
  };
}

/** POST /api/move-ins payload (admin / agent marking a move-in). */
export interface MoveInPayload {
  propertyId: string;
  tenantPhone: string;
  tenantName?: string;
}

/** GET /api/properties/[id]/reviews — public tenant feedback. */
export interface PropertyReviews {
  summary: { avg: number | null; count: number; staying: number };
  reviews: Array<{
    id: string;
    status: TenancyStatus;
    ownerRating: number | null;
    remark: string | null;
    updatedAt: string;
    tenant: string; // masked, e.g. "Ringson M."
  }>;
}

/** Carousel ad banner (public shape has admin fields trimmed by the API). */
export interface AdBanner {
  id: string;
  kicker: string;
  title: string;
  body: string;
  ctaLabel: string;
  action: "SEARCH" | "LIST" | "URL";
  actionUrl: string;
  image: string;
  active?: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Ratings: property + agent (owner ratings live on Tenancy) ───

export type RatingTarget = "PROPERTY" | "AGENT";

/** GET /api/properties/[id]/ratings — all rating summaries for the page. */
export interface PropertyRatings {
  property: {
    avg: number | null;
    count: number;
    ratings: Array<{
      id: string;
      rating: number;
      comment: string;
      user: string; // masked, e.g. "Ringson M."
      createdAt: string;
    }>;
  };
  owner: { avg: number | null; count: number };
  agent: { avg: number | null; count: number; name: string } | null;
  mine: {
    property: { rating: number; comment: string } | null;
    agent: { rating: number; comment: string } | null;
  };
}

// ─── Enquiries: agent-handled leads + inspection visit bookings ──

export type EnquiryKind = "GENERAL" | "VISIT";
export type EnquiryStatus = "NEW" | "CONTACTED" | "SCHEDULED" | "CLOSED";

/** One row in the owner/agent Enquiries inbox. */
export interface MyEnquiry {
  id: string;
  kind: EnquiryKind;
  channel: string; // AGENT | OWNER
  name: string;
  phone: string;
  message: string;
  visitAt: string | null; // ISO, VISIT only
  status: EnquiryStatus;
  createdAt: string;
  property: {
    id: string;
    title: string;
    block: string;
    photos: string[];
    rent: number;
    status?: PropertyStatus;
    mode?: ListingMode;
  };
}

/** One lead in the admin Leads tab — full visibility, both parties attached. */
export interface AdminEnquiry {
  id: string;
  kind: EnquiryKind;
  channel: string; // AGENT | OWNER (who handles the listing route)
  name: string;
  phone: string;
  message: string;
  visitAt: string | null; // ISO, VISIT only
  status: EnquiryStatus;
  createdAt: string;
  property: {
    id: string;
    title: string;
    block: string;
    photos: string[];
    rent: number;
    status?: PropertyStatus;
    mode?: ListingMode;
    owner?: { id: string; name: string; phone: string; verified: boolean } | null;
    handledByAgent: boolean;
  };
  handler?: { id: string; name: string; role: Role; phone: string } | null;
  requester?: { id: string; name: string; role: Role; phone: string } | null;
}

export interface AdminEnquiryPage {
  items: AdminEnquiry[];
  total: number;
  hasMore: boolean;
}

/** Minimal owner/client profile for the agent "log in as" search. */
export interface AgentAccount {
  id: string;
  name: string;
  phone: string;
  role: Role;
  verified: boolean;
}

// ─── Universal search (/api/search/suggest) ───────────────────

/** What selecting a PAGE suggestion does. */
export interface SuggestAction {
  view?: "directory" | "pricing" | "profile";
  help?: string; // HelpArticle key
  list?: boolean; // open the listing form
}

/** One row in the universal-search dropdown. */
export interface SuggestItem {
  type: "PLACE" | "PROPERTY" | "PERSON" | "TYPE" | "PAGE" | "NEARBY" | "FILTER";
  id: string;
  title: string;
  subtitle?: string;
  // PROPERTY rows
  image?: string;
  rent?: number;
  mode?: ListingMode;
  status?: string;
  houseType?: string;
  // PERSON rows
  role?: string;
  verified?: boolean;
  blocks?: string[];
  listings?: number;
  // PLACE rows
  count?: number;
  /** PLACE rows: nearest blocks (nearest-first) for the "near" experience. */
  near?: string[];
  // NEARBY rows — proximity search around a block
  /** NEARBY rows: the anchor block the search is around. */
  around?: string;
  // FILTER rows — structured quick-filters parsed out of the query
  minRent?: number;
  maxRent?: number;
  bedrooms?: number;
  availability?: boolean;
  // PAGE rows
  action?: SuggestAction;
}

export interface SuggestGroups {
  places: SuggestItem[];
  nearby: SuggestItem[];
  listings: SuggestItem[];
  people: SuggestItem[];
  types: SuggestItem[];
  filters: SuggestItem[];
  pages: SuggestItem[];
}

export interface SuggestResponse {
  q: string;
  scope: "ALL" | "HOME" | "BUSINESS";
  groups: SuggestGroups;
}

// ─── Directory ("Know your Owners" footer page) ──────────────────

/** One visible rental (ACTIVE or RENTED) inside a directory profile. */
export type DirectoryListing = Property;

/** GET /api/directory — one owner/agent profile in the public directory. */
export interface DirectoryProfile {
  id: string;
  name: string;
  role: "OWNER" | "AGENT";
  verified: boolean;
  phone: string;
  whatsapp: string | null;
  memberSince: string; // ISO date
  blocks: string[]; // blocks/wards where they currently list
  stats: { total: number; available: number; rented: number };
  /** For owners: the iShim agent who onboarded/maintains their listings. */
  managedBy: { name: string; verified: boolean } | null;
  listings: DirectoryListing[];
}

/** GET /api/directory payload. */
export interface DirectoryResponse {
  summary: {
    owners: number;
    agents: number;
    listings: number;
    available: number;
    successes: number; // rented across all profiles
  };
  profiles: DirectoryProfile[];
}

/** E.164-style digits for wa.me / tel: links (adds the 91 country code). */
export function normalizePhoneE164(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

/** "+91 98560 01101" display form for a stored phone / whatsapp number. */
export function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  const local = digits.slice(-10);
  if (local.length < 10) return raw;
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}

// ─── UI constants ───

export const HOUSE_TYPE_LABELS: Record<string, string> = {
  ASSAM_TYPE: "Assam-type",
  RCC: "RCC",
  KUTCHA: "Kutcha",
  APARTMENT: "Apartment",
};

/** Types for the BUSINESS vertical (shops, offices, cafes…). */
export const BUSINESS_TYPES: string[] = [
  "SHOP",
  "OFFICE",
  "CAFE",
  "RESTAURANT",
  "WAREHOUSE",
  "SHOWROOM",
  "WORKSHOP",
  "KIOSK",
  "OTHER",
];

export const BUSINESS_TYPE_LABELS: Record<string, string> = {
  SHOP: "Shop",
  OFFICE: "Office",
  CAFE: "Cafe",
  RESTAURANT: "Restaurant",
  WAREHOUSE: "Warehouse / Godown",
  SHOWROOM: "Showroom",
  WORKSHOP: "Workshop",
  KIOSK: "Stall / Kiosk",
  OTHER: "Other space",
};

export const MODE_LABELS: Record<ListingMode, string> = {
  HOME: "Homes",
  BUSINESS: "Business",
};

export const SCOPE_LABELS: Record<SearchScope, string> = {
  "": "Everything",
  HOME: "Homes",
  BUSINESS: "Business",
};

/** Label for a listing's type across both verticals. */
export function typeLabel(p: { mode?: string | null; houseType: string }): string {
  return p.mode === "BUSINESS"
    ? (BUSINESS_TYPE_LABELS[p.houseType] ?? p.houseType)
    : (HOUSE_TYPE_LABELS[p.houseType] ?? p.houseType);
}

export const KITCHEN_LABELS: Record<string, string> = {
  SEPARATE: "Separate kitchen",
  SAME_ROOM: "Kitchen + bed same room",
};

export const ROLE_LABELS: Record<Role, string> = {
  CLIENT: "Tenant",
  OWNER: "Owner",
  AGENT: "Agent",
  ADMIN: "Admin",
};

export const STAGE_LABELS: Record<AgentStage, string> = {
  NEW_LEAD: "New Lead",
  SITE_VISIT: "Site Visit",
  NEGOTIATING: "Negotiating",
  CLOSED: "Closed",
  LOST: "Lost",
};

export const STAGES: AgentStage[] = [
  "NEW_LEAD",
  "SITE_VISIT",
  "NEGOTIATING",
  "CLOSED",
  "LOST",
];

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  SCHEDULED: "Visit scheduled",
  CLOSED: "Closed",
};

export const STATUS_BADGE: Record<
  PropertyStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: "Awaiting approval",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  ACTIVE: {
    label: "Active",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  RENTED: {
    label: "Rented",
    className: "bg-muted text-muted-foreground border-border",
  },
  HIDDEN: {
    label: "Hidden",
    className: "bg-muted text-muted-foreground border-border",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

export function formatRent(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

// ─── Success-fee enforcement (Blueprint MVP patch #1) ───
// A listing marked rented stays live until the ₹1,000 success fee is paid.
// After 30 days unpaid the case becomes OVERDUE: the owner is reminded on
// WhatsApp and Admin may suspend the account.

export const FEE_DUE_WINDOW_DAYS = 30;

export interface FeeDueInfo {
  /** Days remaining in the 30-day window; negative once overdue. */
  daysLeft: number;
  /** 0 when within the window, otherwise days past the due date. */
  daysOverdue: number;
  dueDate: Date;
  overdue: boolean;
}

export function getFeeDueInfo(
  p: Pick<Property, "rentedAt" | "feePaid" | "feeWaived">
): FeeDueInfo | null {
  if (!p.rentedAt || p.feePaid || p.feeWaived) return null;
  const rented = new Date(p.rentedAt);
  if (Number.isNaN(rented.getTime())) return null;
  const dueDate = new Date(rented);
  dueDate.setDate(dueDate.getDate() + FEE_DUE_WINDOW_DAYS);
  const daysLeft = Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000);
  return {
    daysLeft,
    daysOverdue: daysLeft < 0 ? Math.abs(daysLeft) : 0,
    dueDate,
    overdue: daysLeft < 0,
  };
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

// ─── CMS content pages (admin-editable help / legal) ─────────────
export type {
  HelpArticleKey,
  ContentData,
  ContentPageDto,
  HowData,
  AboutData,
  ContactData,
  ContactRow,
  FaqData,
  FaqRow,
  SectionsData,
  SectionRow,
  StepRow,
} from "./default-content";
