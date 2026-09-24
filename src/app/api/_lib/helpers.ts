import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Prisma, Property, User } from "@prisma/client";
import type { PropertyStatus } from "@/lib/types";
import { db } from "@/lib/db";

// ─── Generic small helpers ───────────────────────────────────────

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Parses a JSON body object; returns null on any failure. */
export async function getJsonBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function cleanStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Coerces to int; returns undefined for null/undefined/""/NaN. */
export function optionalInt(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

/** Coerces to boolean; returns undefined for null/undefined/"" or unrecognised values. */
export function toBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const s = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(s)) return true;
  if (["false", "0", "no", "off"].includes(s)) return false;
  return undefined;
}

/** Safely parses a JSON string that should be an array of strings. */
export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => (typeof v === "string" ? v.trim() : String(v ?? ""))).filter(Boolean);
  } catch {
    return [];
  }
}

/** Validates an array-of-strings body field. Returns null when the input is not an array. */
export function stringArrayOrNull(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((v) => (typeof v === "string" ? v.trim() : String(v ?? ""))).filter(Boolean);
}

// ─── Enums / canonical values ────────────────────────────────────

export const CANONICAL_HOUSE_TYPES = ["ASSAM_TYPE", "RCC", "KUTCHA", "APARTMENT"];
export const BUSINESS_TYPES = [
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
export const PROPERTY_MODES = ["HOME", "BUSINESS"];
export const KITCHEN_TYPES = ["SEPARATE", "SAME_ROOM"];
export const PROPERTY_STATUSES = ["PENDING", "ACTIVE", "RENTED", "HIDDEN", "REJECTED"];
export const AGENT_CLIENT_STAGES = ["NEW_LEAD", "SITE_VISIT", "NEGOTIATING", "CLOSED", "LOST"];
export const USER_ROLES = ["CLIENT", "OWNER", "AGENT", "ADMIN"];

// ─── App settings (Setting key/value rows) ───────────────────────

export type AppSettings = {
  successFee: number; // FLAT move-in success fee during the free period (₹499) — same for homes & business
  freeModelStartAt: string; // ISO — start of the 36-month free period (admin-set)
  freeModelMonths: number; // length of the everything-free window (36)
  standardClientFee: number; // legacy per-contact fee (unused by the flat model; kept for old clients)
  standardMoveInFee: number; // legacy post-trial owner move-in fee
  agentHelpFee: number; // POST-TRIAL agent-help charge — admin adds later (0 = to be announced)
  // Post-trial pricing model (admin adds amounts + details later; 0/empty = "to be announced"):
  webListingCharge: number; // web listing charge after the free trial
  commissionFee: number; // commission after the free trial
  postTrialNote: string; // free-text details shown on the pricing page
  // BUSINESS vertical (shops, offices, cafes…) — same free window, separate amounts
  bizSuccessFee: number; // business move-in fee DURING the free period (kept in sync = flat ₹499)
  bizStandardClientFee: number; // legacy business contact/listing fee
  bizStandardMoveInFee: number; // legacy post-trial business move-in fee
  bizAgentHelpFee: number; // business agent-help charge (0 = free)
  blocks: string[];
  amenities: string[];
  houseTypes: string[];
  /** Guest-UI translations (key → TK/MN text) managed in the admin Settings tab. */
  langOverrides: Record<string, { TK?: string; MN?: string }>;
  /** Ward/area photos (block name → image url) managed in the admin/agent Areas tab. */
  wardImages: Record<string, string>;
};

export type PricingPhase = "FREE" | "STANDARD";

/** Everything the public (and the pricing page) needs, incl. computed phase. */
export type PublicSettings = AppSettings & {
  phase: PricingPhase; // FREE = inside the 36-month window, STANDARD = after
  freeUntil: string; // ISO — when the free period ends
  daysLeft: number; // days remaining in the free period (0 once STANDARD)
};

export const DEFAULT_SETTINGS: AppSettings = {
  successFee: 499,
  freeModelStartAt: "2025-01-01T00:00:00.000Z",
  freeModelMonths: 36,
  standardClientFee: 0,
  standardMoveInFee: 0,
  agentHelpFee: 0,
  webListingCharge: 0,
  commissionFee: 0,
  postTrialNote: "",
  bizSuccessFee: 499,
  bizStandardClientFee: 0,
  bizStandardMoveInFee: 0,
  bizAgentHelpFee: 0,
  blocks: [
    "Hungpung",
    "Viewland",
    "Phungyo",
    "Phungwamee",
    "Mini Veng",
    "Halisahar",
    "Dungrei",
    "Old Bazaar",
    "TNL Ward",
    "Nungshang",
  ],
  amenities: [
    "Water Supply",
    "Parking",
    "Solar Heating",
    "Internet Ready",
    "Fully Furnished",
    "Semi Furnished",
    "Boundary Wall",
    "Garden",
    "Attached Bathroom",
    "Borewell",
  ],
  houseTypes: CANONICAL_HOUSE_TYPES,
  langOverrides: {},
  wardImages: {},
};

function settingInt(
  raw: string | undefined,
  fallback: number,
  min: number,
): number {
  const v = optionalInt(raw);
  return v !== undefined && v >= min ? v : fallback;
}

export async function readSettings(): Promise<AppSettings> {
  const rows = await db.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const blocks = parseJsonArray(map.get("blocks"));
  const amenities = parseJsonArray(map.get("amenities"));
  const houseTypes = parseJsonArray(map.get("houseTypes"));
  const startRaw = map.get("freeModelStartAt");
  const startMs = startRaw ? Date.parse(startRaw) : NaN;
  let langOverrides: Record<string, { TK?: string; MN?: string }> = {};
  try {
    const parsed: unknown = map.get("langOverrides") ? JSON.parse(map.get("langOverrides") as string) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      langOverrides = parsed as Record<string, { TK?: string; MN?: string }>;
    }
  } catch {
    // corrupt row — fall back to empty
  }
  let wardImages: Record<string, string> = {};
  try {
    const parsed: unknown = map.get("wardImages") ? JSON.parse(map.get("wardImages") as string) : {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      wardImages = parsed as Record<string, string>;
    }
  } catch {
    // corrupt row — fall back to empty
  }
  return {
    successFee: settingInt(map.get("successFee"), DEFAULT_SETTINGS.successFee, 0),
    freeModelStartAt:
      Number.isFinite(startMs) ? new Date(startMs).toISOString() : DEFAULT_SETTINGS.freeModelStartAt,
    freeModelMonths: settingInt(map.get("freeModelMonths"), DEFAULT_SETTINGS.freeModelMonths, 1),
    standardClientFee: settingInt(map.get("standardClientFee"), DEFAULT_SETTINGS.standardClientFee, 0),
    standardMoveInFee: settingInt(map.get("standardMoveInFee"), DEFAULT_SETTINGS.standardMoveInFee, 0),
    agentHelpFee: settingInt(map.get("agentHelpFee"), DEFAULT_SETTINGS.agentHelpFee, 0),
    webListingCharge: settingInt(map.get("webListingCharge"), DEFAULT_SETTINGS.webListingCharge, 0),
    commissionFee: settingInt(map.get("commissionFee"), DEFAULT_SETTINGS.commissionFee, 0),
    postTrialNote: map.get("postTrialNote") ?? DEFAULT_SETTINGS.postTrialNote,
    bizSuccessFee: settingInt(map.get("bizSuccessFee"), DEFAULT_SETTINGS.bizSuccessFee, 0),
    bizStandardClientFee: settingInt(map.get("bizStandardClientFee"), DEFAULT_SETTINGS.bizStandardClientFee, 0),
    bizStandardMoveInFee: settingInt(map.get("bizStandardMoveInFee"), DEFAULT_SETTINGS.bizStandardMoveInFee, 0),
    bizAgentHelpFee: settingInt(map.get("bizAgentHelpFee"), DEFAULT_SETTINGS.bizAgentHelpFee, 0),
    blocks: blocks.length ? blocks : DEFAULT_SETTINGS.blocks,
    amenities: amenities.length ? amenities : DEFAULT_SETTINGS.amenities,
    houseTypes: houseTypes.length ? houseTypes : DEFAULT_SETTINGS.houseTypes,
    langOverrides,
    wardImages,
  };
}

export async function upsertSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await readSettings();
  const next: AppSettings = {
    successFee: patch.successFee ?? current.successFee,
    freeModelStartAt: patch.freeModelStartAt ?? current.freeModelStartAt,
    freeModelMonths: patch.freeModelMonths ?? current.freeModelMonths,
    standardClientFee: patch.standardClientFee ?? current.standardClientFee,
    standardMoveInFee: patch.standardMoveInFee ?? current.standardMoveInFee,
    agentHelpFee: patch.agentHelpFee ?? current.agentHelpFee,
    webListingCharge: patch.webListingCharge ?? current.webListingCharge,
    commissionFee: patch.commissionFee ?? current.commissionFee,
    postTrialNote: patch.postTrialNote ?? current.postTrialNote,
    bizSuccessFee: patch.bizSuccessFee ?? current.bizSuccessFee,
    bizStandardClientFee: patch.bizStandardClientFee ?? current.bizStandardClientFee,
    bizStandardMoveInFee: patch.bizStandardMoveInFee ?? current.bizStandardMoveInFee,
    bizAgentHelpFee: patch.bizAgentHelpFee ?? current.bizAgentHelpFee,
    blocks: patch.blocks ?? current.blocks,
    amenities: patch.amenities ?? current.amenities,
    houseTypes: patch.houseTypes ?? current.houseTypes,
    langOverrides: patch.langOverrides ?? current.langOverrides,
    wardImages: patch.wardImages ?? current.wardImages,
  };
  const scalar: Array<[string, string]> = [
    ["successFee", String(next.successFee)],
    ["freeModelStartAt", next.freeModelStartAt],
    ["freeModelMonths", String(next.freeModelMonths)],
    ["standardClientFee", String(next.standardClientFee)],
    ["standardMoveInFee", String(next.standardMoveInFee)],
    ["agentHelpFee", String(next.agentHelpFee)],
    ["webListingCharge", String(next.webListingCharge)],
    ["commissionFee", String(next.commissionFee)],
    ["postTrialNote", next.postTrialNote],
    ["bizSuccessFee", String(next.bizSuccessFee)],
    ["bizStandardClientFee", String(next.bizStandardClientFee)],
    ["bizStandardMoveInFee", String(next.bizStandardMoveInFee)],
    ["bizAgentHelpFee", String(next.bizAgentHelpFee)],
  ];
  await db.$transaction([
    ...scalar.map(([key, value]) =>
      db.setting.upsert({ where: { key }, update: { value }, create: { key, value } }),
    ),
    db.setting.upsert({
      where: { key: "blocks" },
      update: { value: JSON.stringify(next.blocks) },
      create: { key: "blocks", value: JSON.stringify(next.blocks) },
    }),
    db.setting.upsert({
      where: { key: "amenities" },
      update: { value: JSON.stringify(next.amenities) },
      create: { key: "amenities", value: JSON.stringify(next.amenities) },
    }),
    db.setting.upsert({
      where: { key: "houseTypes" },
      update: { value: JSON.stringify(next.houseTypes) },
      create: { key: "houseTypes", value: JSON.stringify(next.houseTypes) },
    }),
    db.setting.upsert({
      where: { key: "langOverrides" },
      update: { value: JSON.stringify(next.langOverrides) },
      create: { key: "langOverrides", value: JSON.stringify(next.langOverrides) },
    }),
    db.setting.upsert({
      where: { key: "wardImages" },
      update: { value: JSON.stringify(next.wardImages) },
      create: { key: "wardImages", value: JSON.stringify(next.wardImages) },
    }),
  ]);
  return next;
}

// ─── Pricing phase (36-month free model) ─────────────────────────

/** End of the everything-free window: start + freeModelMonths. */
export function freeUntilDate(s: Pick<AppSettings, "freeModelStartAt" | "freeModelMonths">): Date {
  const end = new Date(s.freeModelStartAt);
  if (Number.isFinite(end.getTime())) {
    end.setUTCMonth(end.getUTCMonth() + Math.max(1, s.freeModelMonths));
  }
  return end;
}

export function pricingPhase(s: AppSettings, now: Date = new Date()): PricingPhase {
  return now < freeUntilDate(s) ? "FREE" : "STANDARD";
}

/**
 * The move-in success fee that applies right now for the given vertical —
 * launch fee during the free period, standard fee after it. Homes and
 * business spaces have separately admin-set amounts.
 */
export function moveInFeeFor(
  s: AppSettings,
  mode: "HOME" | "BUSINESS" = "HOME",
  now: Date = new Date(),
): number {
  const free = pricingPhase(s, now) === "FREE";
  if (mode === "BUSINESS") return free ? s.bizSuccessFee : s.bizStandardMoveInFee;
  return free ? s.successFee : s.standardMoveInFee;
}

/** Fee a client pays to contact an owner / post a listing (per vertical). */
export function clientFeeFor(
  s: AppSettings,
  mode: "HOME" | "BUSINESS" = "HOME",
): number {
  return mode === "BUSINESS" ? s.bizStandardClientFee : s.standardClientFee;
}

/** Agent-help charge (per vertical). */
export function agentHelpFeeFor(
  s: AppSettings,
  mode: "HOME" | "BUSINESS" = "HOME",
): number {
  return mode === "BUSINESS" ? s.bizAgentHelpFee : s.agentHelpFee;
}

/** Settings + computed pricing status, safe to return publicly. */
export function publicSettings(s: AppSettings, now: Date = new Date()): PublicSettings {
  const freeUntil = freeUntilDate(s);
  const msLeft = freeUntil.getTime() - now.getTime();
  return {
    ...s,
    phase: msLeft > 0 ? "FREE" : "STANDARD",
    freeUntil: freeUntil.toISOString(),
    daysLeft: msLeft > 0 ? Math.ceil(msLeft / 86_400_000) : 0,
  };
}

// ─── Property serialization ──────────────────────────────────────

export type PropertyWithVerifiedOwner = Prisma.PropertyGetPayload<{
  include: { owner: { select: { verified: true } } };
}>;

export type PropertyWithAdminOwner = Prisma.PropertyGetPayload<{
  include: { owner: { select: { id: true; name: true; phone: true; verified: true } } };
}>;

export const ownerVerifiedInclude = {
  owner: { select: { verified: true } },
} satisfies Prisma.PropertyInclude;

export const ownerAdminInclude = {
  owner: { select: { id: true, name: true, phone: true, verified: true } },
} satisfies Prisma.PropertyInclude;

/** Public listing card — exact shape from the API contract (owner: {verified} only). */
export function publicPropertyCard(p: PropertyWithVerifiedOwner) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    block: p.block,
    mode: p.mode,
    houseType: p.houseType,
    rent: p.rent,
    deposit: p.deposit,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    amenities: parseJsonArray(p.amenities),
    photos: parseJsonArray(p.photos),
    status: p.status as PropertyStatus,
    featured: p.featured,
    kitchen: p.kitchen,
    areaSqft: p.areaSqft,
    widthFt: p.widthFt,
    negotiable: p.negotiable,
    listedByAgentId: p.listedByAgentId,
    whatsappClicks: p.whatsappClicks,
    views: p.views,
    contactRoute: p.contactRoute,
    createdAt: p.createdAt,
    owner: { verified: p.owner.verified },
  };
}

/** Full property payload for owner/agent views — all fields + parsed arrays. */
export function fullProperty(p: Property) {
  return {
    id: p.id,
    ownerId: p.ownerId,
    listedByAgentId: p.listedByAgentId,
    title: p.title,
    description: p.description,
    block: p.block,
    mode: p.mode,
    houseType: p.houseType,
    rent: p.rent,
    deposit: p.deposit,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    amenities: parseJsonArray(p.amenities),
    photos: parseJsonArray(p.photos),
    status: p.status,
    rejectionReason: p.rejectionReason,
    featured: p.featured,
    kitchen: p.kitchen,
    areaSqft: p.areaSqft,
    widthFt: p.widthFt,
    negotiable: p.negotiable,
    whatsappClicks: p.whatsappClicks,
    calls: p.calls,
    views: p.views,
    contactRoute: p.contactRoute,
    feePaid: p.feePaid,
    feeWaived: p.feeWaived,
    feeAmount: p.feeAmount,
    rentedAt: p.rentedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** Admin property payload — full fields + owner {id, name, phone, verified}. */
export function adminPropertyCard(p: PropertyWithAdminOwner) {
  return {
    ...fullProperty(p),
    owner: {
      id: p.owner.id,
      name: p.owner.name,
      phone: p.owner.phone,
      verified: p.owner.verified,
    },
  };
}

// ─── Permissions ─────────────────────────────────────────────────

/**
 * Admin, the owner themself, the agent who listed it, or an agent linked to
 * the owner via AgentOwner — may manage the property.
 */
export async function canManageProperty(
  user: User,
  property: Pick<Property, "ownerId" | "listedByAgentId">
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (property.ownerId === user.id) return true;
  if (property.listedByAgentId && property.listedByAgentId === user.id) return true;
  const link = await db.agentOwner.findFirst({
    where: { agentId: user.id, ownerId: property.ownerId },
    select: { id: true },
  });
  return Boolean(link);
}
