import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/app/api/_lib/helpers";
import { PRICE_BANDS, priceBand, tally } from "../_lib/insights";

/**
 * GET /api/insights/agent — AGENT (admins allowed too).
 * Anonymized platform demand snapshot plus a demand-vs-my-listings gap
 * analysis: which blocks/rents renters are searching for and where the
 * agent has no supply to meet that demand.
 */
export async function GET() {
  try {
    const guard = await requireRole(["AGENT", "ADMIN"]);
    if (guard.error) return guard.error;
    const agentId = guard.user.id;

    const since = new Date(Date.now() - 30 * 86_400_000);
    const events = await db.habitEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });

    const demand = {
      events: events.length,
      searches: events.filter((e) => e.kind === "SEARCH").length,
      contacts: events.filter((e) => e.kind === "CONTACT").length,
      topBlocks: tally(events, (e) => e.block, 8),
      topTypes: tally(events, (e) => e.houseType, 6),
      priceBands: PRICE_BANDS.map((b) => ({
        label: b.label,
        count: events.filter((e) => priceBand(e.rent) === b.key).length,
      })),
    };

    // My active listings (as listing agent or owner).
    const mine = await db.property.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ listedByAgentId: agentId }, { ownerId: agentId }],
      },
      select: { block: true, houseType: true, rent: true },
    });

    const myBlocks = new Map<string, number>();
    for (const p of mine) myBlocks.set(p.block, (myBlocks.get(p.block) ?? 0) + 1);

    const gaps = demand.topBlocks
      .map(({ label, count }) => ({
        block: label,
        demand: count,
        mine: myBlocks.get(label) ?? 0,
      }))
      .sort((a, b) => b.demand - b.mine * 2 - (a.demand - a.mine * 2))
      .slice(0, 6);

    return NextResponse.json({
      windowDays: 30,
      demand,
      myActiveListings: mine.length,
      gaps,
    });
  } catch (err) {
    console.error("[insights/agent] GET failed:", err);
    return jsonError("Something went wrong", 500);
  }
}
