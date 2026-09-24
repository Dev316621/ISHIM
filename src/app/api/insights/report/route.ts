import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/app/api/_lib/helpers";
import {
  PRICE_BANDS,
  priceBand,
  searcherKey,
  tally,
} from "../_lib/insights";
import type { HabitEvent } from "@prisma/client";

/**
 * GET /api/insights/report — ADMIN.
 * Renter-habit & demand report for the last 30 days:
 * totals, top blocks / types / queries, price-band demand, 14-day daily
 * activity, most active searchers (anonymized when guests) and a
 * demand-vs-supply table per block.
 */
export async function GET() {
  try {
    const guard = await requireRole(["ADMIN"]);
    if (guard.error) return guard.error;

    const since = new Date(Date.now() - 30 * 86_400_000);
    const events = await db.habitEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });

    // ── Totals ──
    const count = (kind: string) => events.filter((e) => e.kind === kind).length;
    const identities = new Set(events.map(searcherKey));

    // ── Daily activity (last 14 days) ──
    const daily: { date: string; count: number }[] = [];
    for (let d = 13; d >= 0; d--) {
      const day = new Date(Date.now() - d * 86_400_000);
      const key = day.toISOString().slice(0, 10);
      daily.push({
        date: key,
        count: events.filter((e) => e.createdAt.toISOString().slice(0, 10) === key).length,
      });
    }

    // ── Top searchers ──
    const bySearcher = new Map<string, HabitEvent[]>();
    for (const ev of events) {
      const key = searcherKey(ev);
      const list = bySearcher.get(key) ?? [];
      list.push(ev);
      bySearcher.set(key, list);
    }
    const topKeys = [...bySearcher.entries()]
      .filter(([, list]) => list.length >= 3)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10);

    const userIds = new Set(
      topKeys.filter(([k]) => k.startsWith("u:")).map(([k]) => k.slice(2))
    );
    const users = await db.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, name: true, phone: true, role: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    const topSearchers = topKeys.map(([key, list]) => {
      const isUser = key.startsWith("u:");
      const u = isUser ? userById.get(key.slice(2)) : undefined;
      const blocks = tally(list, (e) => e.block, 1)[0]?.label;
      const types = tally(list, (e) => e.houseType, 1)[0]?.label;
      return {
        label: u
          ? `${u.name} (${u.phone.slice(-4).padStart(6, "•")})`
          : `Guest • ${(key.slice(2) || "??????").slice(0, 6)}`,
        role: u?.role ?? "GUEST",
        events: list.length,
        topBlock: blocks ?? "—",
        topType: types ?? "—",
        maxRent: Math.max(0, ...list.map((e) => e.rent)),
        lastActive: list[0]?.createdAt.toISOString() ?? "",
      };
    });

    // ── Demand vs supply per block ──
    const supplyRows = await db.property.groupBy({
      by: ["block"],
      _count: { _all: true },
      where: { status: "ACTIVE" },
    });
    const supply = new Map(supplyRows.map((r) => [r.block, r._count._all]));
    const demandBlocks = tally(events, (e) => e.block, 12);
    const allBlocks = new Set<string>([
      ...demandBlocks.map((d) => d.label),
      ...supply.keys(),
    ]);
    const demandVsSupply = [...allBlocks]
      .map((block) => ({
        block,
        demand: demandBlocks.find((d) => d.label === block)?.count ?? 0,
        supply: supply.get(block) ?? 0,
      }))
      .sort((a, b) => b.demand - a.demand || b.supply - a.supply)
      .slice(0, 12);

    // ── Price bands ──
    const priceBands = PRICE_BANDS.map((b) => ({
      label: b.label,
      count: events.filter((e) => priceBand(e.rent) === b.key).length,
    }));

    return NextResponse.json({
      windowDays: 30,
      totals: {
        events: events.length,
        searches: count("SEARCH"),
        views: count("VIEW"),
        saves: count("SAVE"),
        contacts: count("CONTACT"),
        uniqueSearchers: identities.size,
      },
      topBlocks: tally(events, (e) => e.block, 8),
      topTypes: tally(events, (e) => e.houseType, 6),
      topQueries: tally(events, (e) => e.query.trim(), 8),
      priceBands,
      daily,
      topSearchers,
      demandVsSupply,
    });
  } catch (err) {
    console.error("[insights/report] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
