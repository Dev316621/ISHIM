import type { HabitEvent, Property } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import type { NextRequest } from "next/server";

// ─── Price bands (shared by ranking + reports) ───────────────────

export const PRICE_BANDS = [
  { key: "u5", label: "Under ₹5k", max: 5000 },
  { key: "5to10", label: "₹5k – ₹10k", max: 10000 },
  { key: "10to20", label: "₹10k – ₹20k", max: 20000 },
  { key: "20p", label: "₹20k+", max: Infinity },
] as const;

export function priceBand(rent: number): string {
  const band = PRICE_BANDS.find((b) => rent < b.max);
  return band ? band.key : "20p";
}

export function bandLabel(key: string): string {
  return PRICE_BANDS.find((b) => b.key === key)?.label ?? key;
}

// ─── Identity (signed-in user or anonymous device) ───────────────

export interface Identity {
  userId: string | null;
  deviceId: string;
}

export function deviceFromReq(req: NextRequest): string {
  return (req.headers.get("x-device-id") ?? "").slice(0, 64);
}

export async function resolveIdentity(req: NextRequest): Promise<Identity> {
  const user = await getSessionUser();
  return { userId: user?.id ?? null, deviceId: deviceFromReq(req) };
}

/** Where-clause fragment matching this identity (user OR device). */
export function identityWhere(id: Identity) {
  return id.userId
    ? {
        OR: [
          { userId: id.userId },
          { deviceId: id.deviceId, NOT: { deviceId: "" } },
        ],
      }
    : { deviceId: id.deviceId, NOT: { deviceId: "" } };
}

// ─── Event recording (fire-and-forget safe) ──────────────────────

export interface EventInput {
  kind: "SEARCH" | "VIEW" | "SAVE" | "CONTACT";
  propertyId?: string | null;
  block?: string;
  houseType?: string;
  rent?: number;
  query?: string;
}

/** Creates a HabitEvent, denormalizing block/type/rent from the property when given. */
export async function recordEvent(identity: Identity, input: EventInput): Promise<void> {
  try {
    if (!identity.userId && !identity.deviceId) return; // nothing to attribute

    let block = input.block ?? "";
    let houseType = input.houseType ?? "";
    let rent = input.rent ?? 0;

    if (input.propertyId) {
      const prop = await db.property.findUnique({
        where: { id: input.propertyId },
        select: { block: true, houseType: true, rent: true },
      });
      if (prop) {
        block = prop.block;
        houseType = prop.houseType;
        rent = prop.rent;
      }
    }

    await db.habitEvent.create({
      data: {
        userId: identity.userId,
        deviceId: identity.deviceId,
        kind: input.kind,
        propertyId: input.propertyId ?? null,
        block,
        houseType,
        rent,
        query: (input.query ?? "").slice(0, 120),
      },
    });
  } catch (err) {
    // Analytics must never break the user-facing request.
    console.error("[insights] recordEvent failed:", err);
  }
}

// ─── Habit profile ("For you" algorithm) ─────────────────────────

/** Event kind weights — stronger intent counts more. */
const KIND_WEIGHT: Record<string, number> = {
  VIEW: 1,
  SEARCH: 2,
  SAVE: 3,
  CONTACT: 5,
};

/** Recency decay — 7d = 1.0, 30d = 0.5, older = 0.2. */
function recency(createdAt: Date, now: Date): number {
  const days = (now.getTime() - createdAt.getTime()) / 86_400_000;
  if (days <= 7) return 1;
  if (days <= 30) return 0.5;
  return 0.2;
}

function bump(map: Map<string, number>, key: string | undefined, by: number) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + by);
}

export interface HabitProfile {
  events: number;
  blocks: Map<string, number>;
  types: Map<string, number>;
  bands: Map<string, number>;
  maxRentSeen: number;
}

export function buildProfile(events: HabitEvent[]): HabitProfile | null {
  if (events.length === 0) return null;
  const now = new Date();
  const blocks = new Map<string, number>();
  const types = new Map<string, number>();
  const bands = new Map<string, number>();
  let maxRentSeen = 0;

  for (const ev of events) {
    const w = (KIND_WEIGHT[ev.kind] ?? 1) * recency(ev.createdAt, now);
    bump(blocks, ev.block, w);
    bump(types, ev.houseType, w);
    bump(bands, priceBand(ev.rent), w);
    if (ev.rent > maxRentSeen) maxRentSeen = ev.rent;
  }
  return { events: events.length, blocks, types, bands, maxRentSeen };
}

function norm(map: Map<string, number>): number {
  let sum = 0;
  for (const v of map.values()) sum += v;
  return sum > 0 ? sum : 1;
}

/**
 * Scores one property against the habit profile:
 * block affinity ×3 + type affinity ×2 + price-band affinity ×1.5,
 * plus featured (×1.5) and freshness (≤14d) boosts. 0 without a profile.
 */
export function scoreProperty(p: Property, profile: HabitProfile | null): number {
  if (!profile) return 0;
  const blockAff = (profile.blocks.get(p.block) ?? 0) / norm(profile.blocks);
  const typeAff = (profile.types.get(p.houseType) ?? 0) / norm(profile.types);
  const bandAff = (profile.bands.get(priceBand(p.rent)) ?? 0) / norm(profile.bands);
  const days = (Date.now() - p.createdAt.getTime()) / 86_400_000;
  const freshness = days <= 14 ? 1 : days <= 30 ? 0.4 : 0;
  return blockAff * 3 + typeAff * 2 + bandAff * 1.5 + (p.featured ? 1.5 : 0) + freshness;
}

/** Top labels of an affinity map, strongest first. */
export function topLabels(map: Map<string, number>, n: number): string[] {
  return [...map.entries()]
    .filter(([k, v]) => k && v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

// ─── Demand aggregation (admin / agent reports) ──────────────────

export interface DemandSlice {
  label: string;
  count: number;
}

export function tally(
  events: HabitEvent[],
  pick: (e: HabitEvent) => string,
  limit: number
): DemandSlice[] {
  const map = new Map<string, number>();
  for (const ev of events) {
    const key = pick(ev);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

/** Stable anonymous identity key for a searcher ("u:cxn…" / "d:8f2a…"). */
export function searcherKey(ev: HabitEvent): string {
  return ev.userId ? `u:${ev.userId}` : `d:${ev.deviceId}`;
}
